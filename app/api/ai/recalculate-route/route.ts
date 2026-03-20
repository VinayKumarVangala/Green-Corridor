import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateAlternativeRoutes } from "@/lib/ai/routeOptimizer";
import { notifyJunctions, updateHospitalEta } from "@/lib/ai/coordinationManager";
import { recordRouteChange } from "@/lib/analytics/incidentRecorder";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-key"
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { assignmentId, currentLat, currentLng, destLat, destLng } = body;

    if (!assignmentId || currentLat == null || currentLng == null || destLat == null || destLng == null) {
      return NextResponse.json(
        { error: "assignmentId, currentLat, currentLng, destLat, destLng are required" },
        { status: 400 }
      );
    }

    // 1. Fetch assignment context (vehicle number, hospital, emergency type, request id)
    const { data: assignment, error: assignErr } = await supabase
      .from("ambulance_assignments")
      .select(`
        id, status, hospital_id,
        ambulance_driver_id,
        emergency_request_id,
        ambulance_drivers ( vehicle_number ),
        emergency_requests ( emergency_type )
      `)
      .eq("id", assignmentId)
      .single();

    if (assignErr || !assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    if (!["accepted", "picked_up", "en_route"].includes(assignment.status)) {
      return NextResponse.json(
        { error: `Assignment is not active (status: ${assignment.status})` },
        { status: 409 }
      );
    }

    const vehicleNumber = (assignment.ambulance_drivers as any)?.vehicle_number ?? "AMB";
    const emergencyType = (assignment.emergency_requests as any)?.emergency_type ?? "General";

    // 2. Fetch current active junction IDs for this assignment (to cancel on reroute)
    const { data: activeAlerts } = await supabase
      .from("junction_alerts")
      .select("junction_id")
      .eq("assignment_id", assignmentId)
      .eq("status", "pending");

    const oldJunctionIds = (activeAlerts ?? []).map((a: any) => a.junction_id);

    // 3. Fetch current route ETA for delta comparison
    const { data: currentTracking } = await supabase
      .from("route_tracking")
      .select("estimated_arrival")
      .eq("assignment_id", assignmentId)
      .order("last_updated", { ascending: false })
      .limit(1)
      .maybeSingle();

    const oldEtaSeconds = currentTracking?.estimated_arrival
      ? Math.max(0, (new Date(currentTracking.estimated_arrival).getTime() - Date.now()) / 1000)
      : null;

    // 4. Calculate alternative routes from current position
    const alternatives = await generateAlternativeRoutes(
      parseFloat(currentLat), parseFloat(currentLng),
      parseFloat(destLat), parseFloat(destLng)
    );

    if (!alternatives || alternatives.length === 0) {
      return NextResponse.json({ error: "Route recalculation failed" }, { status: 500 });
    }

    const best = alternatives[0]; // Already sorted by score, best first

    // 5. Persist new route to route_tracking (upsert by assignment_id)
    const newArrivalTime = new Date(Date.now() + best.route.duration * 1000).toISOString();

    await supabase.from("route_tracking").upsert(
      {
        assignment_id: assignmentId,
        route_data: {
          polyline: best.route.polyline,
          steps: best.route.steps,
          distance: best.route.distance,
          duration: best.route.duration,
          score: best.route.score,
          trafficFactor: best.route.trafficFactor,
          label: best.label,
          recalculatedAt: new Date().toISOString(),
        },
        estimated_arrival: newArrivalTime,
        last_updated: new Date().toISOString(),
      },
      { onConflict: "assignment_id" }
    );

    // 6. Notify junctions (cancels old, creates new)
    const newJunctionIds = await notifyJunctions(
      assignmentId,
      vehicleNumber,
      emergencyType,
      best.route,
      oldJunctionIds
    );

    // 7. Notify hospital of ETA change if significant (> 2 min delta)
    if (assignment.hospital_id && oldEtaSeconds !== null) {
      await updateHospitalEta(
        assignmentId,
        assignment.hospital_id,
        vehicleNumber,
        best.route.duration,
        oldEtaSeconds
      );
    }

    // 8. Record route change in incident analytics
    const cancelledCount = oldJunctionIds.filter((id) => !newJunctionIds.includes(id)).length;
    await recordRouteChange(
      assignment.emergency_request_id,
      assignmentId,
      "manual_recalculation",
      "api_request",
      { distance: 0, duration: oldEtaSeconds ?? 0, score: 0, polyline: "" },
      { distance: best.route.distance, duration: best.route.duration, score: best.route.score, polyline: best.route.polyline },
      oldEtaSeconds && oldEtaSeconds > 0
        ? Math.round(((oldEtaSeconds - best.route.duration) / oldEtaSeconds) * 100)
        : 0,
      cancelledCount,
      newJunctionIds.length
    );

    // 9. Audit log
    await supabase.from("audit_logs").insert({
      action: "ROUTE_RECALCULATED",
      entity_id: assignmentId,
      entity_type: "ambulance_assignment",
      details: {
        newDurationMinutes: Math.round(best.route.duration / 60),
        newDistanceKm: Math.round(best.route.distance / 100) / 10,
        trafficFactor: best.route.trafficFactor,
        score: best.route.score,
        junctionsAlerted: newJunctionIds.length,
        junctionsCancelled: oldJunctionIds.filter((id) => !newJunctionIds.includes(id)).length,
      },
    });

    return NextResponse.json({
      success: true,
      route: {
        label: best.label,
        durationMinutes: Math.round(best.route.duration / 60),
        distanceKm: Math.round(best.route.distance / 100) / 10,
        score: best.route.score,
        trafficFactor: best.route.trafficFactor,
        polyline: best.route.polyline,
        steps: best.route.steps,
        estimatedArrival: newArrivalTime,
      },
      junctions: {
        alerted: newJunctionIds.length,
        cancelled: oldJunctionIds.filter((id) => !newJunctionIds.includes(id)).length,
        activeIds: newJunctionIds,
      },
    });
  } catch (error: any) {
    console.error("[API:AI:RecalculateRoute] Error:", error);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}
