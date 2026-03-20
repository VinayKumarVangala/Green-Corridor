import { NextResponse } from "next/server";
import { routeForAB, recordPrediction, updateABMetrics } from "@/lib/ml/modelRegistry";
import { extractResponseTimeFeatures, type RawIncident } from "@/lib/ml/featureExtractor";
import { inferLinear } from "@/lib/ml/linearRegression";
import { detectRushHour } from "@/lib/ai/routeOptimizer";

/**
 * POST /api/ml/predict-response-time
 *
 * Predicts total emergency response time (seconds) for a given context.
 * Uses the champion model (or challenger via A/B split).
 *
 * Body: {
 *   lat: number,
 *   lng: number,
 *   emergencyType: string,
 *   driverDistanceKm?: number,
 *   activeJunctionAlerts?: number,
 *   requestId?: string          // for A/B feedback loop
 * }
 *
 * Response: {
 *   predictedSeconds: number,
 *   predictedMinutes: number,
 *   confidence: "high" | "medium" | "low",
 *   modelVersion: number,
 *   abSlot: "champion" | "challenger",
 *   rushHour: string,
 *   features: Record<string, number>
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { lat, lng, emergencyType, driverDistanceKm, activeJunctionAlerts, requestId } = body;

    if (lat == null || lng == null || !emergencyType) {
      return NextResponse.json({ error: "lat, lng, emergencyType required" }, { status: 400 });
    }

    // Route through A/B system
    const routed = await routeForAB("response_time");
    if (!routed) {
      // No model trained yet — fall back to heuristic
      const rush = detectRushHour();
      const heuristic = Math.round(600 + rush.severity * 600 + (driverDistanceKm ?? 3) * 90);
      return NextResponse.json({
        predictedSeconds: heuristic,
        predictedMinutes: Math.round(heuristic / 60),
        confidence: "low",
        modelVersion: null,
        abSlot: null,
        rushHour: rush.label,
        fallback: true,
        features: {},
      });
    }

    const { model: stored, slot } = routed;
    const rush = detectRushHour();

    // Build feature row
    const now = new Date().toISOString();
    const row: RawIncident = {
      request_created_at: now,
      total_duration: null,
      dispatch_duration: null,
      total_dispatch_attempts: 1,
      route_changes_count: 0,
      hospital_capacity_at_arrival: null,
      emergency_type: emergencyType,
      lat,
      lng,
      driver_distance_km: driverDistanceKm ?? null,
      active_junction_alerts: activeJunctionAlerts ?? null,
    };

    const features = extractResponseTimeFeatures(row);
    if (!features) {
      return NextResponse.json({ error: "Feature extraction failed" }, { status: 500 });
    }

    const rawPrediction = inferLinear(stored.weights, features);
    // Clamp to sensible range: 60s – 3600s
    const predictedSeconds = Math.round(Math.max(60, Math.min(3600, rawPrediction)));
    const predictedMinutes = Math.round(predictedSeconds / 60);

    // Confidence based on R²
    const confidence: "high" | "medium" | "low" =
      stored.r2 >= 0.7 ? "high" : stored.r2 >= 0.4 ? "medium" : "low";

    // Record for A/B feedback (fire-and-forget)
    recordPrediction(stored.id, "response_time", slot, features, predictedSeconds, requestId);

    // Named feature map for transparency
    const featureMap: Record<string, number> = {};
    stored.weights.featureNames.forEach((name, i) => {
      featureMap[name] = Math.round(features[i] * 1000) / 1000;
    });

    return NextResponse.json({
      predictedSeconds,
      predictedMinutes,
      confidence,
      modelVersion: stored.version,
      abSlot: slot,
      rushHour: rush.label,
      fallback: false,
      features: featureMap,
    });
  } catch (error: any) {
    console.error("[API:ML:PredictResponseTime]", error);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}

/**
 * PATCH /api/ml/predict-response-time
 *
 * Feed back the actual outcome to update A/B metrics.
 * Called from arrival-confirm after total_duration is known.
 *
 * Body: { requestId, actualSeconds, predictedSeconds, abSlot }
 */
export async function PATCH(request: Request) {
  try {
    const { actualSeconds, predictedSeconds, abSlot } = await request.json();
    if (actualSeconds == null || predictedSeconds == null || !abSlot) {
      return NextResponse.json({ error: "actualSeconds, predictedSeconds, abSlot required" }, { status: 400 });
    }
    await updateABMetrics("response_time", abSlot, predictedSeconds, actualSeconds);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
