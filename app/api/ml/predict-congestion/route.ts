import { NextResponse } from "next/server";
import { routeForAB, recordPrediction } from "@/lib/ml/modelRegistry";
import { extractCongestionFeatures, type CongestionSample } from "@/lib/ml/featureExtractor";
import { inferLinear } from "@/lib/ml/linearRegression";
import { detectRushHour } from "@/lib/ai/routeOptimizer";

/**
 * GET /api/ml/predict-congestion?lat=&lng=&timestamp=
 *
 * Predicts congestion factor (1.0 – 2.5) for a given location and time.
 * Falls back to rush-hour heuristic if no model is trained.
 *
 * Query params:
 *   lat        — latitude
 *   lng        — longitude
 *   timestamp  — ISO string (defaults to now)
 *
 * Response: {
 *   congestionFactor: number,     // 1.0 (clear) – 2.5 (heavy)
 *   congestionLevel: "low" | "moderate" | "high" | "severe",
 *   predictedDelayPct: number,    // % extra time vs free-flow
 *   modelVersion: number | null,
 *   abSlot: string | null,
 *   rushHour: string,
 *   fallback: boolean
 * }
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = parseFloat(searchParams.get("lat") ?? "");
    const lng = parseFloat(searchParams.get("lng") ?? "");
    const timestamp = searchParams.get("timestamp") ?? new Date().toISOString();

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json({ error: "lat and lng are required numeric query params" }, { status: 400 });
    }

    const rush = detectRushHour();

    // Try ML model first
    const routed = await routeForAB("congestion");

    if (!routed) {
      // Heuristic fallback
      const factor = Math.round((1.0 + rush.severity * 1.5) * 100) / 100;
      return NextResponse.json(buildResponse(factor, null, null, rush.label, true));
    }

    const { model: stored, slot } = routed;

    const sample: CongestionSample = { timestamp, lat, lng, congestion_factor: 1 };
    const features = extractCongestionFeatures(sample);
    if (!features) {
      const factor = Math.round((1.0 + rush.severity * 1.5) * 100) / 100;
      return NextResponse.json(buildResponse(factor, null, null, rush.label, true));
    }

    // Model outputs normalised [0,1] — convert back to factor range [1.0, 2.5]
    const rawNorm = inferLinear(stored.weights, features);
    const normClamped = Math.max(0, Math.min(1, rawNorm));
    const congestionFactor = Math.round((1.0 + normClamped * 1.5) * 100) / 100;

    // Record for A/B (fire-and-forget)
    recordPrediction(stored.id, "congestion", slot, features, congestionFactor);

    return NextResponse.json(buildResponse(congestionFactor, stored.version, slot, rush.label, false));
  } catch (error: any) {
    console.error("[API:ML:PredictCongestion]", error);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}

function buildResponse(
  factor: number,
  modelVersion: number | null,
  abSlot: string | null,
  rushHour: string,
  fallback: boolean
) {
  const level =
    factor >= 2.0 ? "severe" :
    factor >= 1.6 ? "high" :
    factor >= 1.3 ? "moderate" : "low";

  return {
    congestionFactor: factor,
    congestionLevel: level,
    predictedDelayPct: Math.round((factor - 1) * 100),
    modelVersion,
    abSlot,
    rushHour,
    fallback,
  };
}
