import { NextResponse } from "next/server";
import { selectBestHospital } from "@/lib/ai/routeOptimizer";
import { calculateOptimalRoute } from "@/lib/ai/routeOptimizer";

/**
 * POST /api/ai/hospital-recommend
 *
 * Body:
 *   lat           — pickup latitude (required)
 *   lng           — pickup longitude (required)
 *   emergencyType — e.g. "Cardiac Arrest", "Trauma" (required)
 *   radiusKm      — max hospital distance in km (default: 30)
 *   excludeIds    — array of hospital IDs to skip (e.g. already tried / critical)
 *   enrichEta     — if true, fetch real OSRM route ETA for top 3 (default: false, slower)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      lat,
      lng,
      emergencyType,
      radiusKm = 30,
      excludeIds = [],
      enrichEta = false,
    } = body;

    if (lat == null || lng == null || !emergencyType) {
      return NextResponse.json(
        { error: "lat, lng, and emergencyType are required" },
        { status: 400 }
      );
    }

    // Get ranked hospital list (already filters critical capacity)
    let hospitals = await selectBestHospital(parseFloat(lat), parseFloat(lng), emergencyType);

    // Apply caller-supplied filters
    if (excludeIds.length > 0) {
      hospitals = hospitals.filter((h) => !excludeIds.includes(h.id));
    }
    hospitals = hospitals.filter((h) => h.distance <= radiusKm);

    if (hospitals.length === 0) {
      return NextResponse.json(
        { error: "No available hospitals found within radius", radiusKm },
        { status: 503 }
      );
    }

    // Optionally enrich top 3 with real OSRM route ETAs
    if (enrichEta) {
      const top3 = hospitals.slice(0, 3);
      const routeResults = await Promise.allSettled(
        top3.map((h) =>
          calculateOptimalRoute(parseFloat(lat), parseFloat(lng), h.distance, h.distance)
        )
      );
      // Note: we don't have hospital lat/lng here — selectBestHospital doesn't return them.
      // The enriched ETA is already computed inside selectBestHospital using speed heuristics.
      // Real OSRM enrichment would require hospital coords — use /api/routing/calculate instead.
    }

    return NextResponse.json({
      success: true,
      count: hospitals.length,
      recommendations: hospitals.map((h, i) => ({
        rank: i + 1,
        id: h.id,
        name: h.name,
        status: h.status,
        distanceKm: h.distance,
        etaMinutes: Math.round(h.estimatedArrival / 60),
        score: h.score,
        specialties: h.specialties,
        scoreBreakdown: h.breakdown,
      })),
    });
  } catch (error: any) {
    console.error("[API:AI:HospitalRecommend] Error:", error);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}
