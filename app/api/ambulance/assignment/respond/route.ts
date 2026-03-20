import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { createClient } from "@supabase/supabase-js"
import { recordDriverDecision } from "@/lib/analytics/incidentRecorder"
import { triggerEmergencyProcessing } from "@/lib/ai/engine"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-key"
)

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== "ambulance_driver") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { assignmentId, action, reason } = await req.json()

    if (!["accepted", "declined", "timeout"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    // 1. Fetch assignment to get request ID and driver distance
    const { data: assignment, error: fetchError } = await supabase
      .from("ambulance_assignments")
      .select(`
        id, emergency_request_id, ambulance_driver_id, assigned_at,
        ambulance_drivers ( current_lat, current_lng ),
        emergency_requests ( lat, lng )
      `)
      .eq("id", assignmentId)
      .eq("ambulance_driver_id", session.user.id)
      .single()

    if (fetchError || !assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 })
    }

    const respondedAt = new Date().toISOString()
    const decisionTimeSecs = Math.round(
      (new Date(respondedAt).getTime() - new Date(assignment.assigned_at).getTime()) / 1000
    )

    // 2. Update assignment status
    const statusUpdate: any = { status: action }
    if (action === "accepted") statusUpdate.accepted_at = respondedAt
    if (action === "declined") statusUpdate.declined_at = respondedAt

    const { error: updateError } = await supabase
      .from("ambulance_assignments")
      .update(statusUpdate)
      .eq("id", assignmentId)

    if (updateError) throw updateError

    // 3. Update driver status
    if (action === "accepted") {
      await supabase
        .from("ambulance_drivers")
        .update({ current_status: "busy" })
        .eq("id", session.user.id)
    }

    // 4. Record driver decision in analytics
    const driver = assignment.ambulance_drivers as any
    const request = assignment.emergency_requests as any
    let driverDistanceKm: number | undefined
    if (driver?.current_lat && request?.lat) {
      const { haversineDistance } = await import("@/lib/ai/ambulanceDispatch")
      driverDistanceKm = Math.round(
        haversineDistance(driver.current_lat, driver.current_lng, request.lat, request.lng) * 100
      ) / 100
    }

    await recordDriverDecision(
      assignment.emergency_request_id,
      assignmentId,
      session.user.id,
      action as "accepted" | "declined" | "timeout",
      decisionTimeSecs,
      reason,
      driverDistanceKm
    )

    // 5. Trigger AI reassignment on decline/timeout
    if (action === "declined" || action === "timeout") {
      triggerEmergencyProcessing(assignment.emergency_request_id)
    }

    // 6. Audit log
    await supabase.from("audit_logs").insert({
      action: `ASSIGNMENT_${action.toUpperCase()}`,
      user_id: session.user.id,
      entity_id: assignmentId,
      entity_type: "ambulance_assignment",
      details: { reason, decisionTimeSecs },
    })

    return NextResponse.json({ success: true, status: action })
  } catch (error) {
    console.error("Assignment Response Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
