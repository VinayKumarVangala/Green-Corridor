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
} from "./coordinationManager";
import {
  registerJobHandler,
  enqueueJob,
} from "./jobProcessor";

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
    .select("*, citizen_profiles(*)")
    .eq("id", requestId)
    .single();

  if (error || !request) {
    throw new Error(`Emergency request ${requestId} not found`);
  }

  const pickupLat = request.latitude;
  const pickupLng = request.longitude;
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

  // 7. Notify all stakeholders
  const { notified, errors } = await notifyAllStakeholders(
    {
      id: requestId,
      hospital_id: selectedHospital?.id,
      driver_id: dispatchResult.assignedDriverId,
      vehicle_number: driverCandidate.vehicleNumber,
      emergency_type: emergencyType,
      eta: missionRoute.toPickup?.duration || 0,
    },
    junctionIds
  );

  console.log(`[AI Engine] Stakeholders Notified: ${notified} | Errors: ${errors}`);
  console.log(`\n${"=".repeat(60)}`);
  console.log(`[AI Engine] Emergency ${requestId} FULLY PROCESSED`);
  console.log(`${"=".repeat(60)}\n`);

  // 8. Schedule continuous monitoring
  triggerAssignmentMonitoring(requestId);
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
    .select("latitude, longitude")
    .eq("id", hospitalId)
    .single();

  return { lat: data?.latitude || 0, lng: data?.longitude || 0 };
}
