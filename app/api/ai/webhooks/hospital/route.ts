import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { triggerEmergencyProcessing } from "@/lib/ai/engine";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-key"
);

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? "";

/**
 * POST /api/ai/webhooks/hospital
 *
 * Called by hospital ERP / bed management systems to sync capacity.
 *
 * Body: { hospitalId, status, availableBeds?, secret }
 *
 * Side effects:
 *   - Updates hospitals.capacity_status
 *   - If status → "critical": flags all active assignments routed to this
 *     hospital for re-dispatch by re-triggering the AI engine on their requests
 *   - Audit logged
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { hospitalId, status, availableBeds, secret } = body;

    // Shared-secret auth (simple but effective for internal webhooks)
    if (WEBHOOK_SECRET && secret !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hospitalId || !status) {
      return NextResponse.json({ error: "hospitalId and status are required" }, { status: 400 });
    }

    const validStatuses = ["available", "busy", "critical"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` }, { status: 400 });
    }

    // 1. Fetch current status before update (for change detection)
    const { data: hospital } = await supabase
      .from("hospitals")
      .select("id, name, capacity_status")
      .eq("id", hospitalId)
      .single();

    if (!hospital) {
      return NextResponse.json({ error: "Hospital not found" }, { status: 404 });
    }

    const previousStatus = hospital.capacity_status;

    // 2. Update capacity
    const { error: updateError } = await supabase
      .from("hospitals")
      .update({ capacity_status: status })
      .eq("id", hospitalId);

    if (updateError) throw updateError;

    // 3. If hospital just became critical, find active assignments routed there
    //    and re-trigger dispatch so the AI engine selects a different hospital
    let rerouted = 0;
    if (status === "critical" && previousStatus !== "critical") {
      const { data: activeAssignments } = await supabase
        .from("ambulance_assignments")
        .select("id, emergency_request_id")
        .eq("hospital_id", hospitalId)
        .in("status", ["assigned", "accepted", "en_route"]);

      if (activeAssignments && activeAssignments.length > 0) {
        for (const a of activeAssignments) {
          // Re-trigger the full AI pipeline — it will select the next best hospital
          triggerEmergencyProcessing(a.emergency_request_id);
          rerouted++;
        }
      }
    }

    // 4. Audit log
    await supabase.from("audit_logs").insert({
      action: "HOSPITAL_CAPACITY_WEBHOOK",
      entity_id: hospitalId,
      entity_type: "hospital",
      details: {
        hospitalName: hospital.name,
        previousStatus,
        newStatus: status,
        availableBeds: availableBeds ?? "unknown",
        assignmentsRerouted: rerouted,
      },
    });

    return NextResponse.json({
      success: true,
      hospitalId,
      previousStatus,
      newStatus: status,
      assignmentsRerouted: rerouted,
    });
  } catch (error: any) {
    console.error("[API:Webhook:Hospital] Error:", error);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}
