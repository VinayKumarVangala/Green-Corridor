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
  console.log(`[AI Engine] Job Received: PROCESS_EMERGENCY for ${data.requestId}`);
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
  console.log(`[AI Engine] Public Trigger for request ${requestId}`);
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
  console.log(`[AI Engine] Core Pipeline: ${requestId}`);
  console.log(`${"=".repeat(60)}\n`);

  // 1. Fetch request details
  console.log(`[AI Engine] Fetching request ${requestId} details...`);
  const { data: request, error } = await supabase
    .from("emergency_requests")
    .select("id, emergency_type, lat, lng, requester_name, requester_phone")
    .eq("id", requestId)
    .single();

  if (error || !request) {
    console.error(`[AI Engine] FAILED TO FETCH: ${error?.message}`);
    throw new Error(`Emergency request ${requestId} not found`);
  }

  const pickupLat = request.lat;
  const pickupLng = request.lng;
  const emergencyType = request.emergency_type || "General";

  console.log(`[AI Engine] PHASE 1: Searching for nearest available ambulances around ${pickupLat}, ${pickupLng}`);
  const candidates = await findNearestAvailableAmbulance(pickupLat, pickupLng);

  if (candidates.length === 0) {
    console.error(`[AI Engine] NO AMBULANCES DETECTED. Marking request as failed.`);
    await supabase
      .from("emergency_requests")
      .update({ status: "no_ambulance" })
      .eq("id", requestId);
    return;
  }

  console.log(`[AI Engine] Found ${candidates.length} candidates. Top candidate: ${candidates[0].vehicleNumber}`);

  // 2. Select optimal hospital
  console.log(`[AI Engine] PHASE 2: Finding best hospital for ${emergencyType}...`);
  const hospitals = await selectBestHospital(pickupLat, pickupLng, emergencyType);
  const selectedHospital = hospitals[0];
  
  if (selectedHospital) {
    console.log(`[AI Engine] Selected Hospital: ${selectedHospital.name} (${selectedHospital.distance}km)`);
  }

  // Record alternatives (analytics)
  await recordHospitalAlternatives(
    requestId,
    hospitals.slice(0, 5).map((h, i) => ({ id: h.id, name: h.name, distance: h.distance, score: h.score, selected: i === 0 }))
  ).catch(e => console.error("[AI Engine] recordHospitalAlternatives failed:", e.message));

  // 3. Dispatch with fallback chain - This is where the wait/poll happens
  console.log(`[AI Engine] PHASE 3: Initiating dispatch sequence with fallback (candidates: ${candidates.length})`);
  const dispatchResult = await dispatchWithFallback(requestId, candidates);

  if (!dispatchResult.success) {
    console.error(`[AI Engine] DISPATCH FAILED. Escalating.`);
    return;
  }

  const driverCandidate = candidates.find((c) => c.id === dispatchResult.assignedDriverId);
  if (!driverCandidate) {
    console.error(`[AI Engine] Driver not found in candidate list after acceptance: ${dispatchResult.assignedDriverId}`);
    return;
  }

  console.log(`[AI Engine] DISPATCH CONFIRMED: ${driverCandidate.vehicleNumber}`);

  // 4. Calculate full mission route
  console.log(`[AI Engine] PHASE 4: Calculating route to hospital via pickup location...`);
  const hospitalLat = selectedHospital?.id ? (await getHospitalCoords(selectedHospital.id)).lat : pickupLat;
  const hospitalLng = selectedHospital?.id ? (await getHospitalCoords(selectedHospital.id)).lng : pickupLng;
  const missionRoute = await calculateFullMissionRoute(
    driverCandidate.lat, driverCandidate.lng,
    pickupLat, pickupLng,
    hospitalLat, hospitalLng
  );

  console.log(`[AI Engine] Route calculation complete. ETA: ${Math.round(missionRoute.totalDuration / 60)} minutes total.`);

  // 5. Identify affected junctions & predict traffic
  console.log(`[AI Engine] PHASE 5: Analyzing traffic junctions along the route...`);
  const routePoints = [
    { lat: driverCandidate.lat, lng: driverCandidate.lng },
    { lat: pickupLat, lng: pickupLng },
    { lat: hospitalLat, lng: hospitalLng },
  ];

  const junctionIds = await getAffectedJunctions(routePoints);
  console.log(`[AI Engine] Detected ${junctionIds.length} junctions for green corridor activation.`);

  // 6. Stakeholder Coordination
  console.log(`[AI Engine] PHASE 6: Notifying all stakeholders (Hospital, Traffic, Citizen)...`);
  
  // Need to fetch assignment ID to track coordination
  const { data: assignment } = await supabase
    .from("ambulance_assignments")
    .select("id")
    .eq("emergency_request_id", requestId)
    .eq("ambulance_driver_id", dispatchResult.assignedDriverId)
    .eq("status", "accepted")
    .maybeSingle();

  const assignmentId = assignment?.id ?? dispatchResult.assignedDriverId;

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

  console.log(`[AI Engine] Coordination Success: ${notified} stakeholders reached (Junctions alerted: ${alertedJunctions.length})`);
  console.log(`${"=".repeat(60)}\n`);

  // 7. Monitoring
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

  if (["accepted", "picked_up"].includes(data.status)) {
    console.log(`[AI Engine] Monitoring Assignment ${assignmentId}: Current Status ${data.status}. Re-checking in 30s.`);
    enqueueJob("MONITOR_ASSIGNMENT", { assignmentId }, { delayMs: 30_000 });
  } else {
    console.log(`[AI Engine] Monitoring Assignment ${assignmentId}: MISSION ENDED (${data.status}).`);
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
