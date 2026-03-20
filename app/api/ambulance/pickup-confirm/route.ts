import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { createClient } from "@supabase/supabase-js"
import { recordPickup } from "@/lib/analytics/incidentRecorder"
import { notifyHospital } from "@/lib/ai/coordinationManager"

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
    const { assignmentId } = await req.json()

    if (!assignmentId) {
      return NextResponse.json({ error: "assignmentId is required" }, { status: 400 })
    }

    // 1. Fetch assignment details
    const { data: assignment, error: fetchError } = await supabase
      .from("ambulance_assignments")
      .select(`
        id, emergency_request_id, hospital_id, status, ambulance_driver_id,
        ambulance_drivers ( vehicle_number ),
        emergency_requests ( emergency_type )
      `)
      .eq("id", assignmentId)
      .eq("ambulance_driver_id", session.user.id)
      .single()

    if (fetchError || !assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 })
    }

    // 2. Update assignment status to picked_up
    const pickupTime = new Date().toISOString()
    const { error: updateError } = await supabase
      .from("ambulance_assignments")
      .update({ status: "picked_up", pickup_time: pickupTime })
      .eq("id", assignmentId)

    if (updateError) throw updateError

    // 3. Update emergency request status
    await supabase
      .from("emergency_requests")
      .update({ status: "picked_up" })
      .eq("id", assignment.emergency_request_id)

    // 4. Notify hospital with current ETA from route_tracking
    if (assignment.hospital_id) {
      const { data: tracking } = await supabase
        .from("route_tracking")
        .select("estimated_arrival")
        .eq("assignment_id", assignmentId)
        .order("last_updated", { ascending: false })
        .limit(1)
        .maybeSingle()

      const etaSeconds = tracking?.estimated_arrival
        ? Math.max(60, Math.round((new Date(tracking.estimated_arrival).getTime() - Date.now()) / 1000))
        : 600 // fallback 10 min

      const vehicleNumber = (assignment.ambulance_drivers as any)?.vehicle_number ?? "AMB"
      const emergencyType = (assignment.emergency_requests as any)?.emergency_type ?? "General"

      await notifyHospital(assignmentId, assignment.hospital_id, vehicleNumber, emergencyType, etaSeconds)
    }

    // 5. Record pickup in incident analytics
    await recordPickup(assignment.emergency_request_id, assignmentId)

    // 6. Audit log
    await supabase.from("audit_logs").insert({
      action: "PATIENT_PICKED_UP",
      user_id: session.user.id,
      entity_id: assignmentId,
      entity_type: "ambulance_assignment",
      details: {
        requestId: assignment.emergency_request_id,
        hospitalId: assignment.hospital_id,
        pickupTime,
      },
    })

    return NextResponse.json({ success: true, status: "picked_up" })
  } catch (error) {
    console.error("Pickup Confirmation Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
