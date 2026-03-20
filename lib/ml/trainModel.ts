/**
 * Training Pipeline
 *
 * Orchestrates the full ML training cycle:
 *   1. Fetch completed incidents from incident_analytics
 *   2. Extract features via featureExtractor
 *   3. Train response_time and congestion models via linearRegression
 *   4. Validate — reject if worse than baseline
 *   5. Persist via modelRegistry (triggers A/B test if champion exists)
 *   6. Evaluate any running A/B tests and promote/rollback
 *
 * Designed to run server-side (Node.js) — no browser APIs used.
 */

import { createClient } from "@supabase/supabase-js";
import {
  buildResponseTimeDataset,
  buildCongestionDataset,
  type RawIncident,
  type CongestionSample,
} from "./featureExtractor";
import { trainLinearRegression } from "./linearRegression";
import { saveModel, evaluateABTest, type ModelType } from "./modelRegistry";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-key"
);

export interface TrainingRun {
  modelType: ModelType;
  status: "success" | "skipped" | "failed";
  reason?: string;
  version?: number;
  slot?: string;
  mae?: number;
  rmse?: number;
  r2?: number;
  improvementPct?: number;
  trainingSamples?: number;
  epochs?: number;
  abResult?: string;
}

export interface PipelineResult {
  startedAt: string;
  completedAt: string;
  durationMs: number;
  runs: TrainingRun[];
}

// ── Fetch training data ───────────────────────────────────────────────────────
async function fetchIncidents(since: string): Promise<RawIncident[]> {
  // Join incident_analytics with emergency_requests for lat/lng and emergency_type
  const { data, error } = await supabase
    .from("incident_analytics")
    .select(`
      request_created_at,
      total_duration,
      dispatch_duration,
      total_dispatch_attempts,
      route_changes_count,
      hospital_capacity_at_arrival,
      ambulance_candidates,
      emergency_requests (
        emergency_type,
        lat,
        lng
      )
    `)
    .gte("request_created_at", since)
    .not("total_duration", "is", null)
    .order("request_created_at", { ascending: false })
    .limit(2000);

  if (error) throw new Error(`Failed to fetch incidents: ${error.message}`);

  return (data ?? []).map((row: any) => ({
    request_created_at: row.request_created_at,
    total_duration: row.total_duration,
    dispatch_duration: row.dispatch_duration,
    total_dispatch_attempts: row.total_dispatch_attempts,
    route_changes_count: row.route_changes_count,
    hospital_capacity_at_arrival: row.hospital_capacity_at_arrival,
    emergency_type: row.emergency_requests?.emergency_type ?? null,
    lat: row.emergency_requests?.lat ?? null,
    lng: row.emergency_requests?.lng ?? null,
    // Use first candidate's distance as proxy for driver distance
    driver_distance_km: row.ambulance_candidates?.[0]?.distance ?? null,
    active_junction_alerts: null, // not stored per-incident; use 0 as default
  }));
}

async function fetchCongestionSamples(since: string): Promise<CongestionSample[]> {
  // Derive congestion samples from route_changes: old trafficFactor is the label
  const { data } = await supabase
    .from("route_changes")
    .select(`
      created_at,
      old_route,
      incident_id,
      incident_analytics!inner (
        emergency_requests (lat, lng)
      )
    `)
    .gte("created_at", since)
    .not("old_route", "is", null)
    .limit(1000);

  const samples: CongestionSample[] = [];
  for (const row of data ?? []) {
    const trafficFactor = (row.old_route as any)?.trafficFactor;
    if (!trafficFactor || trafficFactor < 1) continue;
    const req = (row.incident_analytics as any)?.emergency_requests;
    samples.push({
      timestamp: row.created_at,
      lat: req?.lat ?? null,
      lng: req?.lng ?? null,
      congestion_factor: trafficFactor,
    });
  }
  return samples;
}

// ── Single model training run ─────────────────────────────────────────────────
async function trainResponseTimeModel(incidents: RawIncident[]): Promise<TrainingRun> {
  const dataset = buildResponseTimeDataset(incidents);

  if (dataset.length < 10) {
    return { modelType: "response_time", status: "skipped", reason: `Only ${dataset.length} samples (need ≥10)` };
  }

  try {
    const result = trainLinearRegression(dataset, dataset[0].featureNames, {
      learningRate: 0.005,
      maxEpochs: 800,
      batchSize: 16,
      lambda: 0.002,
      valSplit: 0.2,
      patience: 30,
    });

    // Reject if model is worse than naive baseline
    if (result.improvementPct < -10) {
      return {
        modelType: "response_time",
        status: "skipped",
        reason: `Model underperforms baseline by ${Math.abs(result.improvementPct)}%`,
      };
    }

    const stored = await saveModel("response_time", result);
    const abResult = await evaluateABTest("response_time");

    return {
      modelType: "response_time",
      status: "success",
      version: stored.version,
      slot: stored.slot,
      mae: result.mae,
      rmse: result.rmse,
      r2: result.r2,
      improvementPct: result.improvementPct,
      trainingSamples: result.trainSamples + result.valSamples,
      epochs: result.epochs,
      abResult: abResult.reason,
    };
  } catch (err: any) {
    return { modelType: "response_time", status: "failed", reason: err.message };
  }
}

async function trainCongestionModel(samples: CongestionSample[]): Promise<TrainingRun> {
  const dataset = buildCongestionDataset(samples);

  if (dataset.length < 10) {
    return { modelType: "congestion", status: "skipped", reason: `Only ${dataset.length} samples (need ≥10)` };
  }

  try {
    const result = trainLinearRegression(dataset, dataset[0].featureNames, {
      learningRate: 0.01,
      maxEpochs: 600,
      batchSize: 16,
      lambda: 0.001,
      valSplit: 0.2,
      patience: 25,
    });

    if (result.improvementPct < -10) {
      return {
        modelType: "congestion",
        status: "skipped",
        reason: `Model underperforms baseline by ${Math.abs(result.improvementPct)}%`,
      };
    }

    const stored = await saveModel("congestion", result);
    const abResult = await evaluateABTest("congestion");

    return {
      modelType: "congestion",
      status: "success",
      version: stored.version,
      slot: stored.slot,
      mae: result.mae,
      rmse: result.rmse,
      r2: result.r2,
      improvementPct: result.improvementPct,
      trainingSamples: result.trainSamples + result.valSamples,
      epochs: result.epochs,
      abResult: abResult.reason,
    };
  } catch (err: any) {
    return { modelType: "congestion", status: "failed", reason: err.message };
  }
}

// ── Main pipeline entry point ─────────────────────────────────────────────────
export async function runTrainingPipeline(
  lookbackDays = 90
): Promise<PipelineResult> {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();

  console.log(`[ML Pipeline] Starting training run (lookback: ${lookbackDays}d, since: ${since})`);

  const [incidents, congestionSamples] = await Promise.all([
    fetchIncidents(since),
    fetchCongestionSamples(since),
  ]);

  console.log(`[ML Pipeline] Fetched ${incidents.length} incidents, ${congestionSamples.length} congestion samples`);

  const [responseTimeRun, congestionRun] = await Promise.all([
    trainResponseTimeModel(incidents),
    trainCongestionModel(congestionSamples),
  ]);

  const runs = [responseTimeRun, congestionRun];
  runs.forEach((r) => {
    const tag = r.status === "success" ? "✓" : r.status === "skipped" ? "⚠" : "✗";
    console.log(`[ML Pipeline] ${tag} ${r.modelType}: ${r.status}${r.reason ? ` — ${r.reason}` : ""}`);
  });

  // Persist run summary to audit_logs
  try {
    await supabase.from("audit_logs").insert({
      action: "ML_TRAINING_RUN",
      entity_type: "ml_models",
      details: { runs, lookbackDays, incidentCount: incidents.length, congestionSampleCount: congestionSamples.length },
    });
  } catch { /* silent */ }

  return {
    startedAt,
    completedAt: new Date().toISOString(),
    durationMs: Date.now() - t0,
    runs,
  };
}
