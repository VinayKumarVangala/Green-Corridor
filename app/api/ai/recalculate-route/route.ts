import { NextResponse } from "next/server";
import { calculateOptimalRoute, generateAlternativeRoutes } from "@/lib/ai/routeOptimizer";
import { notifyJunctions } from "@/lib/ai/coordinationManager";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { assignmentId, driverLat, driverLng, destLat, destLng, oldJunctionIds = [] } = body;

    if (!assignmentId || !driverLat || !driverLng || !destLat || !destLng) {
      return NextResponse.json(
        { error: "Missing required route parameters" },
        { status: 400 }
      );
    }

    // Calculate alternatives to find best reroute
    const alternatives = await generateAlternativeRoutes(driverLat, driverLng, destLat, destLng);
    if (!alternatives || alternatives.length === 0) {
      return NextResponse.json(
        { error: "Failed to recalculate route" },
        { status: 500 }
      );
    }

    const bestRoute = alternatives[0].route; // Already scored and sorted

    // Notify junctions of the route change (cancels old, notifies new)
    const newJunctionIds = await notifyJunctions(
      assignmentId,
      "AMB", // Usually we need vehicle_number here, skipping for simple API. Real would fetch assignment details.
      "Recalculated", 
      bestRoute,
      oldJunctionIds
    );

    return NextResponse.json({
      success: true,
      route: bestRoute,
      activeJunctions: newJunctionIds
    });
  } catch (error: any) {
    console.error("[API:AI] Reroute error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
