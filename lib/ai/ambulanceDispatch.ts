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
  radiusKm: number = 25 // Increased radius
): Promise<AmbulanceCandidate[]> {
  console.log(`[Dispatch] Searching for available drivers within ${radiusKm}km...`);
  
  const { data: drivers, error } = await supabase
    .from("ambulance_drivers")
    .select("id, profile_id, vehicle_number, current_status, current_lat, current_lng")
    .eq("current_status", "available");

  if (error || !drivers) {
    console.error("[Dispatch] Error querying drivers:", error?.message);
    return [];
  }

  console.log(`[Dispatch] Found ${drivers.length} drivers with 'available' status.`);

  const candidates: AmbulanceCandidate[] = drivers
    .map((d) => {
      const distance = haversineDistance(lat, lng, d.current_lat || 0, d.current_lng || 0);
      const acceptanceRate = 0.8; 
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

  console.log(`[Dispatch] ${candidates.length} candidates after distance filter.`);
  return candidates;
}

// ==========================================
// Dispatch with Fallback Chain
// ==========================================
const DISPATCH_TIMEOUT_MS = 15_000; // Increased to 15s
const MAX_ATTEMPTS = 3;

export async function dispatchWithFallback(
  requestId: string,
  candidates: AmbulanceCandidate[]
): Promise<{ success: boolean; assignedDriverId?: string; escalated?: boolean }> {
  const attemptsToTry = candidates.slice(0, MAX_ATTEMPTS);

  for (let i = 0; i < attemptsToTry.length; i++) {
    const candidate = attemptsToTry[i];
    console.log(`[Dispatch] Chain Step ${i + 1}/${MAX_ATTEMPTS}: Notifying ${candidate.vehicleNumber} (${candidate.id})`);

    // 1. Create assignment
    const { data: assignment, error: assignErr } = await supabase
      .from("ambulance_assignments")
      .insert({
        emergency_request_id: requestId,
        ambulance_driver_id: candidate.id,
        status: "pending",
        assigned_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (assignErr) {
      console.error(`[Dispatch] Failed to create assignment for ${candidate.id}:`, assignErr.message);
      continue;
    }

    console.log(`[Dispatch] Realtime Assignment Created: ${assignment.id}. Waiting ${DISPATCH_TIMEOUT_MS/1000}s for response...`);

    // 2. Poll for response
    const accepted = await waitForDriverResponse(assignment.id, DISPATCH_TIMEOUT_MS);

    if (accepted) {
      console.log(`[Dispatch] Driver ${candidate.vehicleNumber} successfully accepted mission.`);
      
      await supabase
        .from("emergency_requests")
        .update({ status: "assigned" }) // Corrected to 'assigned' 
        .eq("id", requestId);
        
      return { success: true, assignedDriverId: candidate.id };
    }

    // Driver didn't respond or declined
    console.log(`[Dispatch] No response from ${candidate.vehicleNumber}. Attempting next candidate...`);
    await supabase
      .from("ambulance_assignments")
      .update({ status: "declined", declined_at: new Date().toISOString() })
      .eq("id", assignment.id);
  }

  // All attempts exhausted
  console.warn(`[Dispatch] CRITICAL: All ${MAX_ATTEMPTS} attempts failed! Escalating to supervisor.`);
  await escalateToSupervisor(requestId);
  return { success: false, escalated: true };
}

// ==========================================
// Poll for Driver Response
// ==========================================
async function waitForDriverResponse(assignmentId: string, timeoutMs: number): Promise<boolean> {
  const pollInterval = 1500; // Poll faster
  const maxPolls = Math.ceil(timeoutMs / pollInterval);

  for (let i = 0; i < maxPolls; i++) {
    await sleep(pollInterval);

    const { data, error } = await supabase
      .from("ambulance_assignments")
      .select("status")
      .eq("id", assignmentId)
      .single();

    if (error) {
        console.error(`[Dispatch] Polling error for ${assignmentId}:`, error.message);
        continue;
    }

    if (data?.status === "accepted") {
        console.log(`[Dispatch] Polling detected ACCEPTANCE for ${assignmentId}`);
        return true;
    }
    if (data?.status === "declined" || data?.status === "timeout") {
        console.log(`[Dispatch] Polling detected ${data.status.toUpperCase()} for ${assignmentId}`);
        return false;
    }
    
    process.stdout.write("."); // Progress dot
  }

  console.log(`\n[Dispatch] TIMEOUT reached for assignment ${assignmentId}`);
  return false; 
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
  console.error(`[ESCALATION] Emergency ${requestId} escalated. Check Supabase audit_logs.`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { haversineDistance };
