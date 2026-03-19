import { NextResponse } from "next/server";
import { detectRushHour, getTrafficFactor } from "@/lib/ai/routeOptimizer";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const destLat = searchParams.get("destLat");
  const destLng = searchParams.get("destLng");

  if (!lat || !lng || !destLat || !destLng) {
    return NextResponse.json(
      { error: "Missing lat/lng or destLat/destLng parameters" },
      { status: 400 }
    );
  }

  try {
    const rushHour = detectRushHour();
    const trafficFactor = await getTrafficFactor(
      parseFloat(lat), parseFloat(lng),
      parseFloat(destLat), parseFloat(destLng)
    );

    return NextResponse.json({
      success: true,
      data: {
        trafficFactor,
        rushHourProfile: rushHour
      }
    });
  } catch (error: any) {
    console.error("[API:AI] Traffic prediction error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
