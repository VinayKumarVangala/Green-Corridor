import { createClient } from "@supabase/supabase-js";
import {
  findNearestAvailableAmbulance,
  dispatchWithFallback,
} from "./ambulanceDispatch";
import {
  calculateFullMissionRoute,
  selectBestHospital,
} from "./routeOptimizer";
import {
  getAffectedJunctions,
  predictRouteTraffic,
} from "./trafficPredictor";
import {
  notifyAllStakeholders,
  sendHospitalEscalation,
  type AssignmentContext,
} from "./coordinationManager";
import {
  registerJobHandler,
  enqueueJob,
} from "./jobProcessor";
import {
  recordFirstAssignment,
  recordHospitalAlternatives,
} from "../analytics/incidentRecorder";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-key";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ==========================================
// Register Job Handlers on Module Load
// ==========================================
registerJobHandler("PROCESS_EMERGENCY", async (data) => {
  await processEmergencyPipeline(data.requestId);
});

registerJobHandler("MONITOR_ASSIGNMENT", async (data) => {
  await monitorActiveAssignment(data.assignmentId);
});

registerJobHandler("HOSPITAL_ESCALATION", async (data) => {
  await sendHospitalEscalation(data as { assignmentId: string; hospitalId: string; vehicleNumber: string; minutes: number });
});

registerJobHandler("REROUTE_CHECK", async (data) => {
  const { assignmentId, currentLat, currentLng, destLat, destLng } = data;
  // Inline reroute: call the recalculate-route logic directly
  const { generateAlternativeRoutes } = await import("./routeOptimizer");
  const { notifyJunctions, updateHospitalEta } = await import("./coordinationManager");

  const alternatives = await generateAlternativeRoutes(currentLat, currentLng, destLat, destLng);
  if (!alternatives.length) return;

  const best = alternatives[0];

  const { data: activeAlerts } = await supabase
    .from("junction_alerts")
    .select("junction_id")
    .eq("assignment_id", assignmentId)
    .eq("status", "pending");

  const oldJunctionIds = (activeAlerts ?? []).map((a: any) => a.junction_id);

  const { data: assignment } = await supabase
    .from("ambulance_assignments")
    .select("hospital_id, ambulance_drivers(vehicle_number), emergency_requests(emergency_type)")
    .eq("id", assignmentId)
    .single();

  const vehicleNumber = (assignment?.ambulance_drivers as any)?.vehicle_number ?? "AMB";
  const emergencyType = (assignment?.emergency_requests as any)?.emergency_type ?? "General";

  await notifyJunctions(assignmentId, vehicleNumber, emergencyType, best.route, oldJunctionIds);

  if (assignment?.hospital_id) {
    const { data: tracking } = await supabase
      .from("route_tracking")
      .select("estimated_arrival")
      .eq("assignment_id", assignmentId)
      .order("last_updated", { ascending: false })
      .limit(1)
      .maybeSingle();

    const oldEta = tracking?.estimated_arrival
      ? Math.max(0, (new Date(tracking.estimated_arrival).getTime() - Date.now()) / 1000)
      : best.route.duration;

    await updateHospitalEta(assignmentId, assignment.hospital_id, vehicleNumber, best.route.duration, oldEta);
  }

  await supabase.from("route_tracking").upsert(
    {
      assignment_id: assignmentId,
      route_data: { polyline: best.route.polyline, steps: best.route.steps, duration: best.route.duration },
      estimated_arrival: new Date(Date.now() + best.route.duration * 1000).toISOString(),
      last_updated: new Date().toISOString(),
    },
    { onConflict: "assignment_id" }
  );

  console.log(`[Engine] REROUTE_CHECK complete for ${assignmentId}: new ETA ${Math.round(best.route.duration / 60)}m`);
});

// ==========================================
// Public API: Trigger Emergency Processing
// ==========================================
export function triggerEmergencyProcessing(requestId: string): string {
  return enqueueJob("PROCESS_EMERGENCY", { requestId }, { maxAttempts: 3 });
}

export function triggerAssignmentMonitoring(assignmentId: string): string {
  return enqueueJob("MONITOR_ASSIGNMENT", { assignmentId }, { delayMs: 30_000 });
}

// ==========================================
// Core Pipeline: Process Emergency
// ==========================================
async function processEmergencyPipeline(requestId: string): Promise<void> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`[AI Engine] Processing Emergency: ${requestId}`);
  console.log(`${"=".repeat(60)}\n`);

  // 1. Fetch request details
  const { data: request, error } = await supabase
    .from("emergency_requests")
    .select("id, emergency_type, lat, lng, requester_name, requester_phone")
    .eq("id", requestId)
    .single();

  if (error || !request) {
    throw new Error(`Emergency request ${requestId} not found`);
  }

  const pickupLat = request.lat;
  const pickupLng = request.lng;
  const emergencyType = request.emergency_type || "General";

  console.log(`[AI Engine] Emergency Type: ${emergencyType}`);
  console.log(`[AI Engine] Location: ${pickupLat}, ${pickupLng}`);

  // 2. Find nearest available ambulances
  console.log(`[AI Engine] PHASE 1: Finding nearest ambulances...`);
  const candidates = await findNearestAvailableAmbulance(pickupLat, pickupLng);

  if (candidates.length === 0) {
    console.error(`[AI Engine] NO AMBULANCES AVAILABLE. Escalating immediately.`);
    await supabase
      .from("emergency_requests")
      .update({ status: "no_ambulance" })
      .eq("id", requestId);
    return;
  }

  console.log(`[AI Engine] Found ${candidates.length} candidates within range.`);
  candidates.slice(0, 3).forEach((c, i) => {
    console.log(`  ${i + 1}. ${c.vehicleNumber} — ${c.distance}km — Score: ${c.score}`);
  });

  // 3. Select optimal hospital
  console.log(`[AI Engine] PHASE 2: Selecting optimal hospital...`);
  const hospitals = await selectBestHospital(pickupLat, pickupLng, emergencyType);

  const selectedHospital = hospitals[0];
  if (selectedHospital) {
    console.log(`[AI Engine] Best Hospital: ${selectedHospital.name} (${selectedHospital.distance}km, ETA: ${Math.round(selectedHospital.estimatedArrival / 60)}m)`);
  }

  // Record hospital alternatives for analytics
  await recordHospitalAlternatives(
    requestId,
    hospitals.slice(0, 5).map((h, i) => ({ id: h.id, name: h.name, distance: h.distance, score: h.score, selected: i === 0 }))
  );

  // 4. Dispatch with fallback chain
  console.log(`[AI Engine] PHASE 3: Dispatching ambulance...`);
  const dispatchResult = await dispatchWithFallback(requestId, candidates);

  if (!dispatchResult.success) {
    console.error(`[AI Engine] Dispatch FAILED. Escalated to supervisor.`);
    return;
  }

  const driverCandidate = candidates.find((c) => c.id === dispatchResult.assignedDriverId);
  if (!driverCandidate) return;

  console.log(`[AI Engine] DISPATCH SUCCESS: ${driverCandidate.vehicleNumber}`);

  // 5. Calculate full mission route
  console.log(`[AI Engine] PHASE 4: Calculating mission route...`);
  const hospitalLat = selectedHospital?.id ? (await getHospitalCoords(selectedHospital.id)).lat : pickupLat;
  const hospitalLng = selectedHospital?.id ? (await getHospitalCoords(selectedHospital.id)).lng : pickupLng;
  const missionRoute = await calculateFullMissionRoute(
    driverCandidate.lat, driverCandidate.lng,
    pickupLat, pickupLng,
    hospitalLat, hospitalLng
  );

  console.log(`[AI Engine] Total Mission Duration: ${Math.round(missionRoute.totalDuration / 60)} minutes`);

  // 6. Identify affected junctions & predict traffic
  console.log(`[AI Engine] PHASE 5: Traffic analysis & stakeholder coordination...`);
  const routePoints = [
    { lat: driverCandidate.lat, lng: driverCandidate.lng },
    { lat: pickupLat, lng: pickupLng },
    { lat: hospitalLat, lng: hospitalLng },
  ];

  const junctionIds = await getAffectedJunctions(routePoints);
  console.log(`[AI Engine] ${junctionIds.length} junctions on route.`);

  if (junctionIds.length > 0) {
    const traffic = await predictRouteTraffic(junctionIds);
    const heavyCount = traffic.filter((t) => t.predicted === "heavy" || t.predicted === "gridlock").length;
    console.log(`[AI Engine] Traffic Alert: ${heavyCount} congested junctions detected.`);
  }

  // 7. Fetch the actual assignment ID created by dispatchWithFallback
  const { data: assignment } = await supabase
    .from("ambulance_assignments")
    .select("id")
    .eq("emergency_request_id", requestId)
    .eq("ambulance_driver_id", dispatchResult.assignedDriverId)
    .eq("status", "accepted")
    .maybeSingle();

  const assignmentId = assignment?.id ?? dispatchResult.assignedDriverId;

  // Record first assignment and ambulance candidates for analytics
  await recordFirstAssignment(
    requestId,
    assignmentId,
    candidates.slice(0, 5).map((c, i) => ({ id: c.id, distance: c.distance, score: c.score, selected: c.id === dispatchResult.assignedDriverId }))
  );

  // 8. Notify all stakeholders
  const ctx: AssignmentContext = {
    assignmentId,
    requestId,
    hospitalId: selectedHospital?.id,
    vehicleNumber: driverCandidate.vehicleNumber,
    emergencyType,
    etaToPickup: missionRoute.toPickup?.duration ?? 0,
    etaToHospital: missionRoute.toHospital?.duration ?? 0,
    route: missionRoute.toPickup,
  };

  const { notified, errors, junctionIds: alertedJunctions } = await notifyAllStakeholders(ctx, junctionIds);

  console.log(`[AI Engine] Stakeholders Notified: ${notified} | Errors: ${errors} | Junctions: ${alertedJunctions.length}`);
  console.log(`\n${"=".repeat(60)}`);
  console.log(`[AI Engine] Emergency ${requestId} FULLY PROCESSED`);
  console.log(`${"=".repeat(60)}\n`);

  // 9. Schedule continuous monitoring
  triggerAssignmentMonitoring(assignmentId);
}

// ==========================================
// Active Assignment Monitoring
// ==========================================
async function monitorActiveAssignment(assignmentId: string): Promise<void> {
  const { data } = await supabase
    .from("ambulance_assignments")
    .select("status")
    .eq("id", assignmentId)
    .single();

  if (!data) return;

  // If still active, re-schedule monitoring
  if (["accepted", "picked_up"].includes(data.status)) {
    console.log(`[AI Engine] Assignment ${assignmentId} still active (${data.status}). Re-checking in 30s.`);
    enqueueJob("MONITOR_ASSIGNMENT", { assignmentId }, { delayMs: 30_000 });
  } else {
    console.log(`[AI Engine] Assignment ${assignmentId} completed with status: ${data.status}`);
  }
}

// ==========================================
// Helper: Get Hospital Coordinates
// ==========================================
async function getHospitalCoords(hospitalId: string): Promise<{ lat: number; lng: number }> {
  const { data } = await supabase
    .from("hospitals")
    .select("lat, lng")
    .eq("id", hospitalId)
    .single();

  return { lat: data?.lat || 0, lng: data?.lng || 0 };
}
