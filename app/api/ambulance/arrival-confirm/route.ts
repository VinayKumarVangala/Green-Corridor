import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { createClient } from "@supabase/supabase-js"
import { recordArrival } from "@/lib/analytics/incidentRecorder"
import { markHospitalArrived } from "@/lib/ai/coordinationManager"
import { stopRouteMonitoring } from "@/lib/ai/routeMonitor"

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

    // 1. Fetch assignment to get request and hospital IDs
    const { data: assignment, error: fetchError } = await supabase
      .from("ambulance_assignments")
      .select("id, emergency_request_id, hospital_id, status, ambulance_driver_id")
      .eq("id", assignmentId)
      .eq("ambulance_driver_id", session.user.id)
      .single()

    if (fetchError || !assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 })
    }

    // 2. Update assignment status to arrived
    const { error: updateError } = await supabase
      .from("ambulance_assignments")
      .update({ status: "arrived" })
      .eq("id", assignmentId)

    if (updateError) throw updateError

    // 3. Set driver back to available
    await supabase
      .from("ambulance_drivers")
      .update({ current_status: "available" })
      .eq("id", session.user.id)

    // 4. Update emergency request status
    await supabase
      .from("emergency_requests")
      .update({ status: "arrived" })
      .eq("id", assignment.emergency_request_id)

    // 5. Mark hospital notification as arrived
    if (assignment.hospital_id) {
      await markHospitalArrived(assignmentId, assignment.hospital_id, session.user.id)
    }

    // 6. Stop route monitoring
    stopRouteMonitoring(assignmentId)

    // 7. Record arrival in incident analytics
    if (assignment.hospital_id) {
      await recordArrival(assignment.emergency_request_id, assignmentId, assignment.hospital_id)
    }

    // 8. Audit log
    await supabase.from("audit_logs").insert({
      action: "HOSPITAL_ARRIVAL_CONFIRMED",
      user_id: session.user.id,
      entity_id: assignmentId,
      entity_type: "ambulance_assignment",
      details: {
        requestId: assignment.emergency_request_id,
        hospitalId: assignment.hospital_id,
      },
    })

    return NextResponse.json({ success: true, status: "arrived" })
  } catch (error) {
    console.error("Arrival Confirmation Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
