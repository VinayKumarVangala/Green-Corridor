import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enqueueJob } from "@/lib/ai/jobProcessor";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-key"
);

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? "";

// Congestion levels that warrant proactive rerouting
const REROUTE_THRESHOLD = new Set(["heavy", "gridlock"]);

/**
 * POST /api/ai/webhooks/traffic
 *
 * Called by external traffic systems or traffic police officers
 * to report congestion at a junction.
 *
 * Body: { junctionId, congestionLevel, secret?, reportedBy? }
 *   congestionLevel: "light" | "moderate" | "heavy" | "gridlock"
 *
 * Side effects:
 *   - Logs to audit_logs
 *   - If heavy/gridlock: finds active ambulance assignments routing through
 *     this junction and enqueues REROUTE_CHECK jobs for each
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { junctionId, congestionLevel, secret, reportedBy } = body;

    // Shared-secret auth
    if (WEBHOOK_SECRET && secret !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!junctionId || !congestionLevel) {
      return NextResponse.json({ error: "junctionId and congestionLevel are required" }, { status: 400 });
    }

    const validLevels = ["light", "moderate", "heavy", "gridlock"];
    if (!validLevels.includes(congestionLevel)) {
      return NextResponse.json(
        { error: `Invalid congestionLevel. Must be one of: ${validLevels.join(", ")}` },
        { status: 400 }
      );
    }

    // 1. Verify junction exists
    const { data: junction } = await supabase
      .from("traffic_junctions")
      .select("id, name")
      .eq("id", junctionId)
      .single();

    if (!junction) {
      return NextResponse.json({ error: "Junction not found" }, { status: 404 });
    }

    // 2. Log the report
    await supabase.from("audit_logs").insert({
      action: "EXTERNAL_TRAFFIC_REPORT",
      entity_id: junctionId,
      entity_type: "traffic_junction",
      details: {
        junctionName: junction.name,
        congestionLevel,
        reportedBy: reportedBy ?? "external_system",
        timestamp: new Date().toISOString(),
      },
    });

    // 3. If heavy/gridlock, find active assignments routing through this junction
    //    and enqueue reroute checks for each
    let affectedAssignments = 0;
    const enqueuedJobs: string[] = [];

    if (REROUTE_THRESHOLD.has(congestionLevel)) {
      const { data: activeAlerts } = await supabase
        .from("junction_alerts")
        .select("assignment_id, expected_arrival")
        .eq("junction_id", junctionId)
        .eq("status", "pending")
        .gte("expected_arrival", new Date().toISOString());

      if (activeAlerts && activeAlerts.length > 0) {
        // Fetch driver locations for each affected assignment
        const assignmentIds = [...new Set(activeAlerts.map((a) => a.assignment_id))];

        const { data: assignments } = await supabase
          .from("ambulance_assignments")
          .select(`
            id, emergency_request_id, hospital_id,
            ambulance_drivers ( current_lat, current_lng ),
            hospitals ( lat, lng )
          `)
          .in("id", assignmentIds)
          .in("status", ["accepted", "picked_up", "en_route"]);

        for (const a of assignments ?? []) {
          const driver = a.ambulance_drivers as any;
          const hospital = a.hospitals as any;

          if (!driver?.current_lat || !hospital?.lat) continue;

          // Enqueue a reroute check — the handler will recalculate and notify if better route found
          const jobId = enqueueJob(
            "REROUTE_CHECK",
            {
              assignmentId: a.id,
              currentLat: driver.current_lat,
              currentLng: driver.current_lng,
              destLat: hospital.lat,
              destLng: hospital.lng,
              reason: `Junction ${junction.name} reported ${congestionLevel}`,
            },
            { maxAttempts: 2 }
          );

          enqueuedJobs.push(jobId);
          affectedAssignments++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      junctionId,
      junctionName: junction.name,
      congestionLevel,
      affectedAssignments,
      rerouteJobsEnqueued: enqueuedJobs.length,
    });
  } catch (error: any) {
    console.error("[API:Webhook:Traffic] Error:", error);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}
