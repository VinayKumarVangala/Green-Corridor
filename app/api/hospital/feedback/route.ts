import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { createClient } from "@supabase/supabase-js"
import { recordHospitalFeedback } from "@/lib/analytics/incidentRecorder"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-key"
)

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user || session.user.role !== "hospital_staff") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { assignmentId, feedback, rating, issues } = await req.json()

    if (!assignmentId) {
      return NextResponse.json({ error: "assignmentId is required" }, { status: 400 })
    }

    // Resolve emergency_request_id from assignment
    const { data: assignment } = await supabase
      .from("ambulance_assignments")
      .select("emergency_request_id")
      .eq("id", assignmentId)
      .single()

    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 })
    }

    // Record feedback into incident_analytics
    await recordHospitalFeedback(assignment.emergency_request_id, {
      rating: rating ?? null,
      comments: feedback ?? "",
      issues: issues ?? [],
    })

    // Audit log
    await supabase.from("audit_logs").insert({
      action: "HOSPITAL_FEEDBACK_SUBMITTED",
      user_id: session.user.id,
      entity_id: assignmentId,
      entity_type: "ambulance_assignment",
      details: { rating, issues },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Hospital Feedback Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
