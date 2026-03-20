import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@/auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-key"
);

/**
 * GET /api/analytics/export/[incidentId]?format=json|csv
 *
 * Exports comprehensive incident data for post-incident analysis.
 * Admin-only access.
 */
export async function GET(
  request: Request,
  { params }: { params: { incidentId: string } }
): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized - Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") ?? "json";
    const incidentId = params.incidentId;

    // 1. Fetch main incident analytics
    const { data: incident, error: incidentError } = await supabase
      .from("incident_analytics")
      .select(`
        *,
        emergency_requests (
          id, emergency_type, lat, lng, address, requester_name, requester_phone, status, created_at
        ),
        ambulance_drivers (
          id, vehicle_number, employee_id
        ),
        hospitals (
          id, name, address, lat, lng
        )
      `)
      .or(`id.eq.${incidentId},emergency_request_id.eq.${incidentId}`)
      .single();

    if (incidentError || !incident) {
      return NextResponse.json({ error: "Incident not found" }, { status: 404 });
    }

    // 2. Fetch driver decisions
    const { data: driverDecisions } = await supabase
      .from("driver_decisions")
      .select(`
        *,
        ambulance_drivers (vehicle_number, employee_id)
      `)
      .eq("incident_id", incident.id)
      .order("attempt_number", { ascending: true });

    // 3. Fetch route changes
    const { data: routeChanges } = await supabase
      .from("route_changes")
      .select("*")
      .eq("incident_id", incident.id)
      .order("change_number", { ascending: true });

    // 4. Fetch junction clearance log
    const { data: junctionClearance } = await supabase
      .from("junction_clearance_log")
      .select(`
        *,
        traffic_junctions (id, name, lat, lng)
      `)
      .eq("incident_id", incident.id)
      .order("alert_created_at", { ascending: true });

    // 5. Fetch related API calls
    const { data: apiCalls } = await supabase
      .from("api_call_log")
      .select("endpoint, method, status_code, response_time_ms, created_at")
      .eq("incident_id", incident.id)
      .order("created_at", { ascending: true });

    // 6. Assemble comprehensive export
    const exportData = {
      incident: {
        id: incident.id,
        emergency_request_id: incident.emergency_request_id,
        emergency_type: (incident.emergency_requests as any)?.emergency_type,
        location: {
          lat: (incident.emergency_requests as any)?.lat,
          lng: (incident.emergency_requests as any)?.lng,
          address: (incident.emergency_requests as any)?.address,
        },
        requester: {
          name: (incident.emergency_requests as any)?.requester_name,
          phone: (incident.emergency_requests as any)?.requester_phone,
        },
      },
      timeline: {
        request_created: incident.request_created_at,
        first_assignment: incident.first_assignment_at,
        driver_accepted: incident.driver_accepted_at,
        pickup_confirmed: incident.pickup_confirmed_at,
        hospital_arrived: incident.hospital_arrived_at,
        incident_closed: incident.incident_closed_at,
      },
      durations: {
        dispatch_seconds: incident.dispatch_duration,
        acceptance_seconds: incident.acceptance_duration,
        pickup_seconds: incident.pickup_duration,
        transport_seconds: incident.transport_duration,
        total_seconds: incident.total_duration,
        total_minutes: incident.total_duration ? Math.round(incident.total_duration / 60) : null,
      },
      assignment: {
        total_attempts: incident.total_dispatch_attempts,
        declined_count: incident.declined_count,
        timeout_count: incident.timeout_count,
        final_driver: {
          id: incident.final_driver_id,
          vehicle_number: (incident.ambulance_drivers as any)?.vehicle_number,
          employee_id: (incident.ambulance_drivers as any)?.employee_id,
        },
      },
      route: {
        initial: {
          distance_meters: incident.initial_route_distance,
          duration_seconds: incident.initial_route_duration,
        },
        final: {
          distance_meters: incident.final_route_distance,
          duration_seconds: incident.final_route_duration,
        },
        changes_count: incident.route_changes_count,
        alternatives_considered: incident.route_alternatives,
      },
      traffic: {
        avg_traffic_factor: incident.traffic_factor_avg,
        rush_hour_severity: incident.rush_hour_severity,
        total_delay_seconds: incident.total_delay_seconds,
        delay_causes: incident.delay_causes,
      },
      junctions: {
        alerted: incident.junctions_alerted,
        cleared: incident.junctions_cleared,
        avg_clearance_time_seconds: incident.avg_clearance_time,
        clearance_log: junctionClearance?.map((j) => ({
          junction_name: (j.traffic_junctions as any)?.name,
          alert_created: j.alert_created_at,
          expected_arrival: j.expected_arrival,
          actual_arrival: j.actual_arrival,
          cleared_at: j.cleared_at,
          clearance_time_seconds: j.clearance_time_seconds,
          status: j.status,
        })),
      },
      hospital: {
        id: incident.hospital_id,
        name: (incident.hospitals as any)?.name,
        address: (incident.hospitals as any)?.address,
        prep_time_seconds: incident.hospital_prep_time,
        capacity_at_arrival: incident.hospital_capacity_at_arrival,
        candidates_considered: incident.hospital_candidates,
        feedback: incident.hospital_feedback,
      },
      ambulance_candidates: incident.ambulance_candidates,
      driver_decisions: driverDecisions?.map((d) => ({
        attempt: d.attempt_number,
        driver_vehicle: (d.ambulance_drivers as any)?.vehicle_number,
        decision: d.decision,
        decision_time_seconds: d.decision_time_seconds,
        decline_reason: d.decline_reason,
        distance_km: d.driver_distance_km,
        score: d.driver_score,
      })),
      route_changes: routeChanges?.map((r) => ({
        change_number: r.change_number,
        reason: r.reason,
        triggered_by: r.triggered_by,
        old_route: r.old_route,
        new_route: r.new_route,
        improvement_percent: r.improvement_percent,
        junctions_cancelled: r.junctions_cancelled,
        junctions_added: r.junctions_added,
        timestamp: r.created_at,
      })),
      performance: {
        response_efficiency: incident.response_efficiency,
        route_efficiency: incident.route_efficiency,
        coordination_score: incident.stakeholder_coordination_score,
      },
      api_calls: apiCalls?.map((a) => ({
        endpoint: a.endpoint,
        method: a.method,
        status: a.status_code,
        response_time_ms: a.response_time_ms,
        timestamp: a.created_at,
      })),
      metadata: {
        exported_at: new Date().toISOString(),
        exported_by: session.user.id,
      },
    };

    // 7. Return in requested format
    if (format === "csv") {
      const csv = convertToCSV(exportData);
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="incident_${incidentId}_${Date.now()}.csv"`,
        },
      });
    }

    return NextResponse.json(exportData, {
      headers: {
        "Content-Disposition": `attachment; filename="incident_${incidentId}_${Date.now()}.json"`,
      },
    });
  } catch (error: any) {
    console.error("[API:Analytics:Export] Error:", error);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}

function convertToCSV(data: any): string {
  const rows: string[] = [];

  // Header
  rows.push("Section,Key,Value");

  // Flatten the nested object
  function flatten(obj: any, prefix = ""): void {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === "object" && !Array.isArray(value)) {
        flatten(value, fullKey);
      } else if (Array.isArray(value)) {
        rows.push(`${prefix},${key},${JSON.stringify(value).replace(/"/g, '""')}`);
      } else {
        rows.push(`${prefix},${key},"${String(value ?? "").replace(/"/g, '""')}"`);
      }
    }
  }

  flatten(data);
  return rows.join("\n");
}
