import { NextResponse } from "next/server";
import { selectBestHospital } from "@/lib/ai/routeOptimizer";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { lat, lng, emergencyType } = body;

    if (!lat || !lng || !emergencyType) {
      return NextResponse.json(
        { error: "Missing required parameters (lat, lng, emergencyType)" },
        { status: 400 }
      );
    }

    const hospitals = await selectBestHospital(lat, lng, emergencyType);

    return NextResponse.json({
      success: true,
      recommendations: hospitals
    });
  } catch (error: any) {
    console.error("[API:AI] Hospital recommend error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
