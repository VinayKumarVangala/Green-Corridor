/**
 * Model Registry
 *
 * Persists trained models to Supabase ml_models table.
 * Manages champion / challenger slots and A/B test lifecycle.
 *
 * Slot semantics:
 *   champion   — the model currently serving production traffic
 *   challenger — a newly trained model being A/B tested (≤10% traffic)
 *   archived   — retired models kept for audit
 */

import { createClient } from "@supabase/supabase-js";
import type { LinearModel, TrainResult } from "./linearRegression";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-key"
);

export type ModelType = "response_time" | "congestion";
export type ModelSlot = "champion" | "challenger" | "archived";

export interface StoredModel {
  id: string;
  modelType: ModelType;
  version: number;
  slot: ModelSlot;
  weights: LinearModel;
  trainedAt: string;
  trainingSamples: number;
  mae: number;
  rmse: number;
  r2: number;
  baselineMae: number;
  improvementPct: number;
}

// ── Persist a newly trained model ─────────────────────────────────────────────
export async function saveModel(
  modelType: ModelType,
  result: TrainResult,
  deployedBy: "auto" | "admin" = "auto"
): Promise<StoredModel> {
  // Get next version number
  const { data: latest } = await supabase
    .from("ml_models")
    .select("version")
    .eq("model_type", modelType)
    .order("version", { ascending: false })
    .limit(1);

  const nextVersion = (latest?.[0]?.version ?? 0) + 1;

  // Determine slot: if no champion exists yet → become champion directly
  const { data: existingChampion } = await supabase
    .from("ml_models")
    .select("id")
    .eq("model_type", modelType)
    .eq("slot", "champion")
    .limit(1);

  const slot: ModelSlot = existingChampion?.length ? "challenger" : "champion";

  const { data, error } = await supabase
    .from("ml_models")
    .insert({
      model_type: modelType,
      version: nextVersion,
      slot,
      weights: result.model,
      training_samples: result.trainSamples + result.valSamples,
      feature_count: result.model.featureNames.length,
      mae: result.mae,
      rmse: result.rmse,
      r2: result.r2,
      baseline_mae: result.baselineMae,
      improvement_pct: result.improvementPct,
      deployed_at: new Date().toISOString(),
      deployed_by: deployedBy,
    })
    .select()
    .single();

  if (error || !data) throw new Error(`Failed to save model: ${error?.message}`);

  // If challenger, start an A/B test
  if (slot === "challenger" && existingChampion?.[0]) {
    await supabase.from("ml_ab_tests").insert({
      model_type: modelType,
      champion_model_id: existingChampion[0].id,
      challenger_model_id: data.id,
      challenger_traffic_pct: 10,
      status: "running",
    });
    console.log(`[ModelRegistry] A/B test started: v${nextVersion} challenger vs champion`);
  }

  console.log(`[ModelRegistry] Saved ${modelType} model v${nextVersion} as ${slot} (MAE=${result.mae}, R²=${result.r2})`);
  return rowToStoredModel(data);
}

// ── Load the active model for inference ──────────────────────────────────────
export async function loadModel(modelType: ModelType, slot: ModelSlot = "champion"): Promise<StoredModel | null> {
  const { data } = await supabase
    .from("ml_models")
    .select("*")
    .eq("model_type", modelType)
    .eq("slot", slot)
    .order("version", { ascending: false })
    .limit(1);

  return data?.[0] ? rowToStoredModel(data[0]) : null;
}

// ── A/B routing: pick champion or challenger based on traffic split ───────────
export async function routeForAB(modelType: ModelType): Promise<{ model: StoredModel; slot: ModelSlot } | null> {
  const { data: test } = await supabase
    .from("ml_ab_tests")
    .select("*, champion:champion_model_id(*), challenger:challenger_model_id(*)")
    .eq("model_type", modelType)
    .eq("status", "running")
    .order("started_at", { ascending: false })
    .limit(1);

  if (!test?.[0]) {
    // No active A/B test — just serve champion
    const champion = await loadModel(modelType, "champion");
    return champion ? { model: champion, slot: "champion" } : null;
  }

  const ab = test[0];
  const useChallenger = Math.random() * 100 < ab.challenger_traffic_pct;
  const row = useChallenger ? ab.challenger : ab.champion;
  if (!row) return null;

  return { model: rowToStoredModel(row), slot: useChallenger ? "challenger" : "champion" };
}

// ── Record prediction outcome for A/B metrics ─────────────────────────────────
export async function recordPrediction(
  modelId: string,
  modelType: ModelType,
  abSlot: ModelSlot,
  features: number[],
  predictedValue: number,
  requestId?: string
): Promise<void> {
  // Sample 1-in-5 to keep table lean
  if (Math.random() > 0.2) return;

  try {
    await supabase.from("ml_predictions").insert({
      model_id: modelId,
      model_type: modelType,
      ab_slot: abSlot,
      features,
      predicted_value: predictedValue,
      emergency_request_id: requestId ?? null,
    });
  } catch { /* silent */ }
}

// ── Evaluate A/B test and promote/rollback if enough data ────────────────────
// Called after retraining. Threshold: challenger must beat champion by ≥5%.
export async function evaluateABTest(
  modelType: ModelType,
  improvementThreshold = 5
): Promise<{ action: "promoted" | "rolled_back" | "insufficient_data"; reason: string }> {
  const { data: tests } = await supabase
    .from("ml_ab_tests")
    .select("*")
    .eq("model_type", modelType)
    .eq("status", "running")
    .order("started_at", { ascending: false })
    .limit(1);

  const test = tests?.[0];
  if (!test) return { action: "insufficient_data", reason: "No active A/B test" };

  const minPredictions = 20;
  if (test.challenger_predictions < minPredictions) {
    return { action: "insufficient_data", reason: `Only ${test.challenger_predictions} challenger predictions (need ${minPredictions})` };
  }

  const championMae = test.champion_predictions > 0
    ? test.champion_mae_sum / test.champion_predictions
    : Infinity;
  const challengerMae = test.challenger_predictions > 0
    ? test.challenger_mae_sum / test.challenger_predictions
    : Infinity;

  const improvementPct = championMae > 0
    ? ((championMae - challengerMae) / championMae) * 100
    : 0;

  if (improvementPct >= improvementThreshold) {
    // Promote challenger → champion, archive old champion
    await supabase.from("ml_models").update({ slot: "archived", retired_at: new Date().toISOString() })
      .eq("id", test.champion_model_id);
    await supabase.from("ml_models").update({ slot: "champion", deployed_at: new Date().toISOString() })
      .eq("id", test.challenger_model_id);
    await supabase.from("ml_ab_tests").update({
      status: "promoted",
      ended_at: new Date().toISOString(),
      conclusion: `Challenger promoted: ${improvementPct.toFixed(1)}% MAE improvement (${challengerMae.toFixed(0)}s vs ${championMae.toFixed(0)}s)`,
    }).eq("id", test.id);

    console.log(`[ModelRegistry] Challenger promoted for ${modelType}: ${improvementPct.toFixed(1)}% improvement`);
    return { action: "promoted", reason: `${improvementPct.toFixed(1)}% improvement exceeds ${improvementThreshold}% threshold` };
  } else {
    // Roll back challenger → archive it
    await supabase.from("ml_models").update({ slot: "archived", retired_at: new Date().toISOString() })
      .eq("id", test.challenger_model_id);
    await supabase.from("ml_ab_tests").update({
      status: "rolled_back",
      ended_at: new Date().toISOString(),
      conclusion: `Challenger rolled back: only ${improvementPct.toFixed(1)}% improvement (need ${improvementThreshold}%)`,
    }).eq("id", test.id);

    console.log(`[ModelRegistry] Challenger rolled back for ${modelType}: ${improvementPct.toFixed(1)}% < ${improvementThreshold}%`);
    return { action: "rolled_back", reason: `${improvementPct.toFixed(1)}% improvement below ${improvementThreshold}% threshold` };
  }
}

// ── Update A/B metrics when actual outcome is known ───────────────────────────
export async function updateABMetrics(
  modelType: ModelType,
  abSlot: ModelSlot,
  predictedValue: number,
  actualValue: number
): Promise<void> {
  const absErr = Math.abs(predictedValue - actualValue);

  const { data: tests } = await supabase
    .from("ml_ab_tests")
    .select("id, champion_predictions, challenger_predictions, champion_mae_sum, challenger_mae_sum")
    .eq("model_type", modelType)
    .eq("status", "running")
    .limit(1);

  if (!tests?.[0]) return;
  const t = tests[0];

  const update = abSlot === "champion"
    ? { champion_predictions: t.champion_predictions + 1, champion_mae_sum: (t.champion_mae_sum ?? 0) + absErr }
    : { challenger_predictions: t.challenger_predictions + 1, challenger_mae_sum: (t.challenger_mae_sum ?? 0) + absErr };

  try {
    await supabase.from("ml_ab_tests").update(update).eq("id", t.id);
  } catch { /* silent */ }
}

// ── List all models (for admin UI) ────────────────────────────────────────────
export async function listModels(modelType?: ModelType): Promise<StoredModel[]> {
  let q = supabase.from("ml_models").select("*").order("version", { ascending: false }).limit(20);
  if (modelType) q = q.eq("model_type", modelType);
  const { data } = await q;
  return (data ?? []).map(rowToStoredModel);
}

// ── Row mapper ────────────────────────────────────────────────────────────────
function rowToStoredModel(row: any): StoredModel {
  return {
    id: row.id,
    modelType: row.model_type,
    version: row.version,
    slot: row.slot,
    weights: row.weights as LinearModel,
    trainedAt: row.trained_at ?? row.created_at,
    trainingSamples: row.training_samples,
    mae: row.mae,
    rmse: row.rmse,
    r2: row.r2,
    baselineMae: row.baseline_mae,
    improvementPct: row.improvement_pct,
  };
}
