import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-key"
);

// ==========================================
// Incident Lifecycle Recording
// ==========================================

/**
 * Initializes an incident analytics record when an emergency request is created.
 * Called from /api/emergency/request after the request is inserted.
 */
export async function initializeIncident(requestId: string): Promise<void> {
  try {
    const { data: request } = await supabase
      .from("emergency_requests")
      .select("created_at")
      .eq("id", requestId)
      .single();

    await supabase.from("incident_analytics").insert({
      emergency_request_id: requestId,
      request_created_at: request?.created_at ?? new Date().toISOString(),
    });

    console.log(`[Analytics] Incident initialized: ${requestId}`);
  } catch (error) {
    console.error("[Analytics] Failed to initialize incident:", error);
  }
}

/**
 * Records the first assignment attempt (dispatch phase complete).
 */
export async function recordFirstAssignment(
  requestId: string,
  assignmentId: string,
  candidates: Array<{ id: string; distance: number; score: number; selected: boolean }>
): Promise<void> {
  try {
    const { data: request } = await supabase
      .from("emergency_requests")
      .select("created_at")
      .eq("id", requestId)
      .single();

    const { data: assignment } = await supabase
      .from("ambulance_assignments")
      .select("assigned_at")
      .eq("id", assignmentId)
      .single();

    const dispatchDuration = request && assignment
      ? Math.round((new Date(assignment.assigned_at).getTime() - new Date(request.created_at).getTime()) / 1000)
      : null;

    await supabase
      .from("incident_analytics")
      .update({
        first_assignment_at: assignment?.assigned_at,
        dispatch_duration: dispatchDuration,
        total_dispatch_attempts: 1,
        ambulance_candidates: candidates,
      })
      .eq("emergency_request_id", requestId);

    console.log(`[Analytics] First assignment recorded: ${requestId} → ${assignmentId}`);
  } catch (error) {
    console.error("[Analytics] Failed to record first assignment:", error);
  }
}

/**
 * Records a driver decision (accept/decline/timeout).
 */
export async function recordDriverDecision(
  requestId: string,
  assignmentId: string,
  driverId: string,
  decision: "accepted" | "declined" | "timeout",
  decisionTimeSeconds: number,
  declineReason?: string,
  driverDistance?: number,
  driverScore?: number
): Promise<void> {
  try {
    // Get incident ID
    const { data: incident } = await supabase
      .from("incident_analytics")
      .select("id, total_dispatch_attempts, declined_count, timeout_count")
      .eq("emergency_request_id", requestId)
      .single();

    if (!incident) return;

    // Insert driver decision log
    await supabase.from("driver_decisions").insert({
      incident_id: incident.id,
      assignment_id: assignmentId,
      driver_id: driverId,
      attempt_number: incident.total_dispatch_attempts,
      decision,
      decision_time_seconds: decisionTimeSeconds,
      decline_reason: declineReason,
      driver_distance_km: driverDistance,
      driver_score: driverScore,
    });

    // Update incident analytics
    const updates: any = {};
    if (decision === "accepted") {
      const { data: assignment } = await supabase
        .from("ambulance_assignments")
        .select("accepted_at")
        .eq("id", assignmentId)
        .single();

      updates.driver_accepted_at = assignment?.accepted_at;
      updates.final_driver_id = driverId;

      const { data: firstAssignment } = await supabase
        .from("incident_analytics")
        .select("first_assignment_at")
        .eq("emergency_request_id", requestId)
        .single();

      if (firstAssignment?.first_assignment_at && assignment?.accepted_at) {
        updates.acceptance_duration = Math.round(
          (new Date(assignment.accepted_at).getTime() - new Date(firstAssignment.first_assignment_at).getTime()) / 1000
        );
      }
    } else if (decision === "declined") {
      updates.declined_count = (incident.declined_count ?? 0) + 1;
    } else if (decision === "timeout") {
      updates.timeout_count = (incident.timeout_count ?? 0) + 1;
    }

    await supabase
      .from("incident_analytics")
      .update(updates)
      .eq("id", incident.id);

    console.log(`[Analytics] Driver decision recorded: ${decision} by ${driverId}`);
  } catch (error) {
    console.error("[Analytics] Failed to record driver decision:", error);
  }
}

/**
 * Records pickup confirmation.
 */
export async function recordPickup(requestId: string, assignmentId: string): Promise<void> {
  try {
    const { data: assignment } = await supabase
      .from("ambulance_assignments")
      .select("pickup_time, accepted_at")
      .eq("id", assignmentId)
      .single();

    const pickupDuration = assignment?.accepted_at && assignment?.pickup_time
      ? Math.round((new Date(assignment.pickup_time).getTime() - new Date(assignment.accepted_at).getTime()) / 1000)
      : null;

    await supabase
      .from("incident_analytics")
      .update({
        pickup_confirmed_at: assignment?.pickup_time,
        pickup_duration: pickupDuration,
      })
      .eq("emergency_request_id", requestId);

    console.log(`[Analytics] Pickup recorded: ${requestId}`);
  } catch (error) {
    console.error("[Analytics] Failed to record pickup:", error);
  }
}

/**
 * Records hospital arrival and finalizes the incident.
 */
export async function recordArrival(
  requestId: string,
  assignmentId: string,
  hospitalId: string
): Promise<void> {
  try {
    const { data: assignment } = await supabase
      .from("ambulance_assignments")
      .select("pickup_time")
      .eq("id", assignmentId)
      .single();

    const { data: hospital } = await supabase
      .from("hospitals")
      .select("capacity_status")
      .eq("id", hospitalId)
      .single();

    const arrivalTime = new Date().toISOString();
    const transportDuration = assignment?.pickup_time
      ? Math.round((new Date(arrivalTime).getTime() - new Date(assignment.pickup_time).getTime()) / 1000)
      : null;

    const { data: incident } = await supabase
      .from("incident_analytics")
      .select("request_created_at")
      .eq("emergency_request_id", requestId)
      .single();

    const totalDuration = incident?.request_created_at
      ? Math.round((new Date(arrivalTime).getTime() - new Date(incident.request_created_at).getTime()) / 1000)
      : null;

    await supabase
      .from("incident_analytics")
      .update({
        hospital_arrived_at: arrivalTime,
        incident_closed_at: arrivalTime,
        transport_duration: transportDuration,
        total_duration: totalDuration,
        hospital_id: hospitalId,
        hospital_capacity_at_arrival: hospital?.capacity_status ?? "unknown",
      })
      .eq("emergency_request_id", requestId);

    console.log(`[Analytics] Arrival recorded: ${requestId} → ${hospitalId} (${totalDuration}s total)`);
  } catch (error) {
    console.error("[Analytics] Failed to record arrival:", error);
  }
}

/**
 * Records route alternatives considered during dispatch.
 */
export async function recordRouteAlternatives(
  requestId: string,
  routes: Array<{ label: string; score: number; distance: number; duration: number; selected: boolean }>
): Promise<void> {
  try {
    await supabase
      .from("incident_analytics")
      .update({ route_alternatives: routes })
      .eq("emergency_request_id", requestId);
  } catch (error) {
    console.error("[Analytics] Failed to record route alternatives:", error);
  }
}

/**
 * Records hospital alternatives considered during dispatch.
 */
export async function recordHospitalAlternatives(
  requestId: string,
  hospitals: Array<{ id: string; name: string; distance: number; score: number; selected: boolean }>
): Promise<void> {
  try {
    await supabase
      .from("incident_analytics")
      .update({ hospital_candidates: hospitals })
      .eq("emergency_request_id", requestId);
  } catch (error) {
    console.error("[Analytics] Failed to record hospital alternatives:", error);
  }
}

/**
 * Records a route change event.
 */
export async function recordRouteChange(
  requestId: string,
  assignmentId: string,
  reason: string,
  triggeredBy: string,
  oldRoute: { distance: number; duration: number; score: number; polyline: string },
  newRoute: { distance: number; duration: number; score: number; polyline: string },
  improvementPercent: number,
  junctionsCancelled: number,
  junctionsAdded: number
): Promise<void> {
  try {
    const { data: incident } = await supabase
      .from("incident_analytics")
      .select("id, route_changes_count")
      .eq("emergency_request_id", requestId)
      .single();

    if (!incident) return;

    await supabase.from("route_changes").insert({
      incident_id: incident.id,
      assignment_id: assignmentId,
      change_number: (incident.route_changes_count ?? 0) + 1,
      reason,
      triggered_by: triggeredBy,
      old_route: oldRoute,
      new_route: newRoute,
      improvement_percent: improvementPercent,
      junctions_cancelled: junctionsCancelled,
      junctions_added: junctionsAdded,
    });

    await supabase
      .from("incident_analytics")
      .update({
        route_changes_count: (incident.route_changes_count ?? 0) + 1,
        final_route_distance: newRoute.distance,
        final_route_duration: newRoute.duration,
      })
      .eq("id", incident.id);

    console.log(`[Analytics] Route change recorded: ${reason} (${improvementPercent}% improvement)`);
  } catch (error) {
    console.error("[Analytics] Failed to record route change:", error);
  }
}

/**
 * Records junction clearance data.
 */
export async function recordJunctionClearance(
  requestId: string,
  junctionId: string,
  alertCreatedAt: string,
  expectedArrival: string,
  status: "pending" | "cleared" | "cancelled",
  cancelledReason?: string
): Promise<void> {
  try {
    const { data: incident } = await supabase
      .from("incident_analytics")
      .select("id")
      .eq("emergency_request_id", requestId)
      .single();

    if (!incident) return;

    await supabase.from("junction_clearance_log").insert({
      incident_id: incident.id,
      junction_id: junctionId,
      alert_created_at: alertCreatedAt,
      expected_arrival: expectedArrival,
      status,
      cancelled_reason: cancelledReason,
    });
  } catch (error) {
    console.error("[Analytics] Failed to record junction clearance:", error);
  }
}

/**
 * Records hospital feedback.
 */
export async function recordHospitalFeedback(
  requestId: string,
  feedback: { rating: number; comments: string; issues: string[] }
): Promise<void> {
  try {
    await supabase
      .from("incident_analytics")
      .update({ hospital_feedback: feedback })
      .eq("emergency_request_id", requestId);

    console.log(`[Analytics] Hospital feedback recorded: ${requestId}`);
  } catch (error) {
    console.error("[Analytics] Failed to record hospital feedback:", error);
  }
}

/**
 * Logs an API call for performance tracking.
 */
export async function logApiCall(
  endpoint: string,
  method: string,
  statusCode: number,
  userId: string | null,
  userRole: string | null,
  ipAddress: string,
  requestBody: any,
  responseTimeMs: number,
  incidentId?: string
): Promise<void> {
  try {
    await supabase.from("api_call_log").insert({
      endpoint,
      method,
      status_code: statusCode,
      user_id: userId,
      user_role: userRole,
      ip_address: ipAddress,
      request_body: requestBody,
      response_time_ms: responseTimeMs,
      incident_id: incidentId,
    });
  } catch (error) {
    // Silent fail — don't break the request if logging fails
    console.error("[Analytics] Failed to log API call:", error);
  }
}
