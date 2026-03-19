import { NextResponse } from "next/server";
import { triggerEmergencyProcessing } from "@/lib/ai/engine";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { requestId } = body;

    if (!requestId) {
      return NextResponse.json(
        { error: "Request ID is required" },
        { status: 400 }
      );
    }

    // Trigger the asynchronous dispatch pipeline
    const jobId = triggerEmergencyProcessing(requestId);

    return NextResponse.json({
      success: true,
      message: "Emergency dispatch pipeline triggered.",
      jobId,
    });
  } catch (error: any) {
    console.error("[API:AI] Dispatch error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
