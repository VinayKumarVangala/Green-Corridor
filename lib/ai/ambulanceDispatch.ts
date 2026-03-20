import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-key";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ==========================================
// Haversine Distance Calculator (km)
// ==========================================
function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ==========================================
// Nearest Ambulance Detection
// ==========================================
export interface AmbulanceCandidate {
  id: string;
  name: string;
  vehicleNumber: string;
  lat: number;
  lng: number;
  distance: number;
  acceptanceRate: number;
  score: number;
}

export async function findNearestAvailableAmbulance(
  lat: number,
  lng: number,
  radiusKm: number = 15
): Promise<AmbulanceCandidate[]> {
  // Query all available drivers
  const { data: drivers, error } = await supabase
    .from("ambulance_drivers")
    .select("id, profile_id, vehicle_number, current_status, current_lat, current_lng")
    .eq("current_status", "available");

  if (error || !drivers) {
    console.error("Failed to query drivers:", error);
    return [];
  }

  // Calculate distance and score for each driver
  const candidates: AmbulanceCandidate[] = drivers
    .map((d) => {
      const distance = haversineDistance(lat, lng, d.current_lat || 0, d.current_lng || 0);
      // Score: lower is better. Weighted by distance (70%) and inverse acceptance rate (30%).
      const acceptanceRate = 0.8; // Default; extend schema to track this if needed
      const score = distance * 0.7 + (1 - acceptanceRate) * radiusKm * 0.3;
      return {
        id: d.id,
        name: d.vehicle_number || "Unknown",
        vehicleNumber: d.vehicle_number || "N/A",
        lat: d.current_lat || 0,
        lng: d.current_lng || 0,
        distance: Math.round(distance * 100) / 100,
        acceptanceRate,
        score: Math.round(score * 100) / 100,
      };
    })
    .filter((c) => c.distance <= radiusKm)
    .sort((a, b) => a.score - b.score);

  return candidates;
}

// ==========================================
// Dispatch with Fallback Chain
// ==========================================
const DISPATCH_TIMEOUT_MS = 10_000; // 10 seconds per driver
const MAX_ATTEMPTS = 3;

export async function dispatchWithFallback(
  requestId: string,
  candidates: AmbulanceCandidate[]
): Promise<{ success: boolean; assignedDriverId?: string; escalated?: boolean }> {
  const attemptsToTry = candidates.slice(0, MAX_ATTEMPTS);

  for (let i = 0; i < attemptsToTry.length; i++) {
    const candidate = attemptsToTry[i];
    console.log(`[Dispatch] Attempt ${i + 1}/${MAX_ATTEMPTS}: Trying ${candidate.vehicleNumber}`);

    // 1. Create assignment with 'pending' status
    const { data: assignment, error: assignErr } = await supabase
      .from("ambulance_assignments")
      .insert({
        emergency_request_id: requestId,
        ambulance_driver_id: candidate.id,
        status: "assigned",
        assigned_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (assignErr) {
      console.error(`[Dispatch] Failed to create assignment for ${candidate.id}:`, assignErr);
      continue;
    }

    // 2. Notify driver via Supabase Realtime (insert triggers the subscription)
    // The driver's NotificationManager will pick this up automatically.

    // 3. Wait for response (poll for status change)
    const accepted = await waitForDriverResponse(assignment.id, DISPATCH_TIMEOUT_MS);

    if (accepted) {
      console.log(`[Dispatch] Driver ${candidate.vehicleNumber} ACCEPTED`);
      // Update request status
      await supabase
        .from("emergency_requests")
        .update({ status: "dispatched" })
        .eq("id", requestId);
      return { success: true, assignedDriverId: candidate.id };
    }

    // Driver didn't respond or declined — mark as timed out
    console.log(`[Dispatch] Driver ${candidate.vehicleNumber} did not respond. Trying next...`);
    await supabase
      .from("ambulance_assignments")
      .update({ status: "declined", declined_at: new Date().toISOString() })
      .eq("id", assignment.id);
  }

  // All attempts exhausted — escalate
  console.warn(`[Dispatch] All ${MAX_ATTEMPTS} attempts failed for request ${requestId}. ESCALATING.`);
  await escalateToSupervisor(requestId);
  return { success: false, escalated: true };
}

// ==========================================
// Poll for Driver Response
// ==========================================
async function waitForDriverResponse(assignmentId: string, timeoutMs: number): Promise<boolean> {
  const pollInterval = 2000; // 2 seconds
  const maxPolls = Math.ceil(timeoutMs / pollInterval);

  for (let i = 0; i < maxPolls; i++) {
    await sleep(pollInterval);

    const { data } = await supabase
      .from("ambulance_assignments")
      .select("status")
      .eq("id", assignmentId)
      .single();

    if (data?.status === "accepted") return true;
    if (data?.status === "declined") return false;
  }

  return false; // Timeout
}

// ==========================================
// Supervisor Escalation
// ==========================================
async function escalateToSupervisor(requestId: string): Promise<void> {
  await supabase.from("audit_logs").insert({
    action: "DISPATCH_ESCALATION",
    details: {
      requestId,
      reason: `All ${MAX_ATTEMPTS} dispatch attempts failed. Manual intervention required.`,
      timestamp: new Date().toISOString(),
    },
  });

  // In production, this would trigger a push notification to a supervisor dashboard
  console.error(`[ESCALATION] Emergency ${requestId} requires manual dispatch. All automated attempts failed.`);
}

// ==========================================
// Utility
// ==========================================
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { haversineDistance };
