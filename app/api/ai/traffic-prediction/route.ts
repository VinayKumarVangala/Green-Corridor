import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { detectRushHour, getTrafficFactor } from "@/lib/ai/routeOptimizer";
import { predictRouteTraffic } from "@/lib/ai/trafficPredictor";
import { haversineDistance } from "@/lib/ai/ambulanceDispatch";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-key"
);

/**
 * GET /api/ai/traffic-prediction
 *
 * Query params:
 *   lat, lng           — centre of area to query (required)
 *   destLat, destLng   — destination for route-level traffic factor (optional)
 *   radiusKm           — search radius in km (default: 5)
 *
 * Returns:
 *   - rushHourProfile
 *   - trafficFactor (route-level, if destLat/destLng provided)
 *   - per-junction congestion predictions within radius
 *   - summary: counts by congestion level
 *   - shouldReroute: true if any junction is heavy/gridlock
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const destLat = searchParams.get("destLat");
  const destLng = searchParams.get("destLng");
  const radiusKm = parseFloat(searchParams.get("radiusKm") ?? "5");

  if (!lat || !lng) {
    return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });
  }

  const centerLat = parseFloat(lat);
  const centerLng = parseFloat(lng);

  try {
    const rushHour = detectRushHour();

    // 1. Route-level traffic factor (only if destination provided)
    let trafficFactor: number | null = null;
    if (destLat && destLng) {
      trafficFactor = await getTrafficFactor(
        centerLat, centerLng,
        parseFloat(destLat), parseFloat(destLng)
      );
    }

    // 2. Find all junctions within radius
    const { data: junctions } = await supabase
      .from("traffic_junctions")
      .select("id, name, lat, lng");

    const nearbyJunctions = (junctions ?? []).filter(
      (j) => haversineDistance(centerLat, centerLng, j.lat || 0, j.lng || 0) <= radiusKm
    );

    // 3. Per-junction congestion predictions
    const junctionIds = nearbyJunctions.map((j) => j.id);
    const predictions = junctionIds.length > 0
      ? await predictRouteTraffic(junctionIds)
      : [];

    // 4. Fetch active alert counts per junction (how many ambulances currently routing through)
    const { data: activeAlerts } = junctionIds.length > 0
      ? await supabase
          .from("junction_alerts")
          .select("junction_id")
          .in("junction_id", junctionIds)
          .eq("status", "pending")
          .gte("expected_arrival", new Date().toISOString())
      : { data: [] };

    const alertCountByJunction = (activeAlerts ?? []).reduce<Record<string, number>>((acc, a) => {
      acc[a.junction_id] = (acc[a.junction_id] ?? 0) + 1;
      return acc;
    }, {});

    // 5. Merge predictions with junction metadata
    const junctionData = predictions.map((pred) => {
      const junction = nearbyJunctions.find((j) => j.id === pred.junctionId);
      return {
        junctionId: pred.junctionId,
        name: junction?.name ?? pred.junctionId,
        lat: junction?.lat ?? 0,
        lng: junction?.lng ?? 0,
        distanceKm: junction
          ? Math.round(haversineDistance(centerLat, centerLng, junction.lat || 0, junction.lng || 0) * 100) / 100
          : null,
        congestion: pred.predicted,
        confidence: pred.confidence,
        activeAmbulances: alertCountByJunction[pred.junctionId] ?? 0,
      };
    }).sort((a, b) => (a.distanceKm ?? 99) - (b.distanceKm ?? 99));

    // 6. Summary
    const summary = {
      total: junctionData.length,
      light: junctionData.filter((j) => j.congestion === "light").length,
      moderate: junctionData.filter((j) => j.congestion === "moderate").length,
      heavy: junctionData.filter((j) => j.congestion === "heavy").length,
      gridlock: junctionData.filter((j) => j.congestion === "gridlock").length,
    };

    const shouldReroute = summary.heavy + summary.gridlock > 0;

    return NextResponse.json({
      success: true,
      rushHour,
      trafficFactor,
      radiusKm,
      summary,
      shouldReroute,
      junctions: junctionData,
    });
  } catch (error: any) {
    console.error("[API:AI:TrafficPrediction] Error:", error);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}
