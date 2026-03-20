import { NextResponse } from "next/server";
import {
  calculateOptimalRoute,
  generateAlternativeRoutes,
  selectBestHospital,
  calculateFullMissionRoute,
  detectRushHour,
  getAdaptiveWeights,
} from "@/lib/ai/routeOptimizer";
import { handleApiError, safeRouteCalc } from "@/lib/errors/handleApiError";
import { ValidationError } from "@/lib/errors/AppError";

export const dynamic = "force-dynamic";

/**
 * POST /api/routing/calculate
 *
 * Body variants:
 *   1. Point-to-point:  { start, end }
 *   2. Full mission:    { start, pickup, hospital }
 *   3. With hospital selection: { start, pickup, emergencyType }
 *   4. Alternatives:   { start, end, alternatives: true }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { start, end, pickup, hospital, emergencyType, alternatives = false } = body;

    if (!start?.lat || !start?.lng) {
      throw new ValidationError("start.lat and start.lng are required");
    }

    const weights = await getAdaptiveWeights();
    const rushHour = detectRushHour();

    // ── Mode 1: Full mission with auto hospital selection ──────────────────
    if (pickup && emergencyType && !hospital) {
      const hospitals = await selectBestHospital(pickup.lat, pickup.lng, emergencyType);
      if (hospitals.length === 0) {
        return NextResponse.json({ error: "No available hospitals found" }, { status: 503 });
      }

      const best = hospitals[0];
      const toPickup = await safeRouteCalc(
        () => calculateOptimalRoute(start.lat, start.lng, pickup.lat, pickup.lng, weights),
        "Driver location", "Pickup location",
      );

      return NextResponse.json({
        mode: "mission_with_hospital_selection",
        rushHour,
        weights,
        toPickup: toPickup ? formatRoute(toPickup) : null,
        recommendedHospitals: hospitals.slice(0, 3),
      });
    }

    // ── Mode 2: Full mission (driver → pickup → hospital) ─────────────────
    if (pickup && hospital) {
      const mission = await calculateFullMissionRoute(
        start.lat, start.lng,
        pickup.lat, pickup.lng,
        hospital.lat, hospital.lng
      );

      return NextResponse.json({
        mode: "full_mission",
        rushHour,
        weights,
        toPickup: mission.toPickup ? formatRoute(mission.toPickup) : null,
        toHospital: mission.toHospital ? formatRoute(mission.toHospital) : null,
        totalDurationMinutes: Math.round(mission.totalDuration / 60),
      });
    }

    // ── Mode 3: Alternatives ──────────────────────────────────────────────
    if (!end?.lat || !end?.lng) {
      throw new ValidationError("end.lat and end.lng are required");
    }

    if (alternatives) {
      const routes = await generateAlternativeRoutes(
        start.lat, start.lng,
        end.lat, end.lng,
        weights
      );

      return NextResponse.json({
        mode: "alternatives",
        rushHour,
        weights,
        routes: routes.map((r) => ({
          label: r.label,
          isRecommended: r.isRecommended,
          ...formatRoute(r.route),
        })),
      });
    }

    // ── Mode 4: Single optimal route ──────────────────────────────────────
    const route = await safeRouteCalc(
      () => calculateOptimalRoute(start.lat, start.lng, end.lat, end.lng, weights),
      `${start.lat},${start.lng}`, `${end.lat},${end.lng}`,
    );

    if ("fallback" in route) {
      return NextResponse.json({ mode: "optimal", isFallback: true, ...route });
    }

    return NextResponse.json({
      mode: "optimal",
      rushHour,
      weights,
      route: formatRoute(route),
    });
  } catch (error: any) {
    return handleApiError(error, "/api/routing/calculate");
  }
}

function formatRoute(route: ReturnType<typeof Object.assign>) {
  return {
    distanceKm: Math.round((route.distance / 1000) * 100) / 100,
    durationMinutes: Math.round(route.duration / 60),
    score: route.score,
    trafficFactor: route.trafficFactor,
    polyline: route.polyline,
    waypoints: route.waypoints,
    steps: route.steps.map((s: any) => ({
      instruction: s.instruction,
      distanceM: Math.round(s.distance),
      durationS: Math.round(s.duration),
      roadType: s.roadType,
    })),
  };
}
