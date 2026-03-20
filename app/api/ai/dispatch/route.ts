import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { triggerEmergencyProcessing } from "@/lib/ai/engine";
import { getJobStatus } from "@/lib/ai/jobProcessor";
import { handleApiError } from "@/lib/errors/handleApiError";
import { ValidationError, NotFoundError, ConflictError } from "@/lib/errors/AppError";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-key"
);

export async function POST(request: Request) {
  try {
    const { requestId } = await request.json();

    if (!requestId || typeof requestId !== "string") {
      throw new ValidationError("requestId is required");
    }

    // Validate the emergency request exists and is in a dispatchable state
    const { data: emergencyRequest, error } = await supabase
      .from("emergency_requests")
      .select("id, status, emergency_type, lat, lng")
      .eq("id", requestId)
      .single();

    if (error || !emergencyRequest) {
      throw new NotFoundError("Emergency request", { requestId });
    }

    if (!["pending", "assigned"].includes(emergencyRequest.status)) {
      throw new ConflictError(`Request is already in status: ${emergencyRequest.status}`, { requestId });
    }

    // Idempotency: check if an active assignment already exists
    const { data: existingAssignment } = await supabase
      .from("ambulance_assignments")
      .select("id, status")
      .eq("emergency_request_id", requestId)
      .in("status", ["assigned", "accepted", "picked_up", "en_route"])
      .maybeSingle();

    if (existingAssignment) {
      return NextResponse.json({
        success: true,
        message: "Assignment already active.",
        assignmentId: existingAssignment.id,
        assignmentStatus: existingAssignment.status,
        alreadyDispatched: true,
      });
    }

    // Trigger the async AI dispatch pipeline
    const jobId = triggerEmergencyProcessing(requestId);

    await supabase.from("audit_logs").insert({
      action: "AI_DISPATCH_TRIGGERED",
      entity_id: requestId,
      entity_type: "emergency_request",
      details: { jobId, emergencyType: emergencyRequest.emergency_type },
    });

    return NextResponse.json({
      success: true,
      message: "AI dispatch pipeline triggered.",
      jobId,
      // Caller can poll GET /api/ai/dispatch?jobId=... to check progress
      pollUrl: `/api/ai/dispatch?jobId=${jobId}`,
    });
  } catch (error: any) {
    return handleApiError(error, "/api/ai/dispatch");
  }
}

// Job status polling endpoint
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");
  const requestId = searchParams.get("requestId");

  if (jobId) {
    const job = getJobStatus(jobId);
    if (!job) {
      return NextResponse.json({ error: "Job not found (may have expired)" }, { status: 404 });
    }
    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      attempts: job.attempts,
      error: job.error,
    });
  }

  if (requestId) {
    // Return the current assignment for this request
    const { data: assignment } = await supabase
      .from("ambulance_assignments")
      .select("id, status, ambulance_driver_id, assigned_at, accepted_at")
      .eq("emergency_request_id", requestId)
      .order("assigned_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({ assignment: assignment ?? null });
  }

  return NextResponse.json({ error: "Provide jobId or requestId" }, { status: 400 });
}
