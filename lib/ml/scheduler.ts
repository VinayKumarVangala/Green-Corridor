/**
 * ML Retraining Scheduler
 *
 * Runs a daily retraining cycle using setTimeout (same pattern as jobProcessor.ts).
 * State is persisted to audit_logs so restarts don't double-fire.
 *
 * Usage: call `startMLScheduler()` once at server startup.
 * In Next.js App Router this is called from the retrain API route on first request.
 */

import { createClient } from "@supabase/supabase-js";
import { runTrainingPipeline } from "./trainModel";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-key"
);

const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MIN_INTERVAL_MS = 60 * 60 * 1000;   // 1 hour minimum between runs

let schedulerStarted = false;
let lastRunAt = 0;
let nextRunTimer: ReturnType<typeof setTimeout> | null = null;

export interface SchedulerStatus {
  running: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastResult: any | null;
}

let lastResult: any = null;

// ── Check when the last training run happened ─────────────────────────────────
async function getLastRunTimestamp(): Promise<number> {
  const { data } = await supabase
    .from("audit_logs")
    .select("created_at")
    .eq("action", "ML_TRAINING_RUN")
    .order("created_at", { ascending: false })
    .limit(1);

  if (data?.[0]?.created_at) {
    return new Date(data[0].created_at).getTime();
  }
  return 0;
}

// ── Execute one training cycle ────────────────────────────────────────────────
async function executeTrainingCycle(): Promise<void> {
  const now = Date.now();

  // Guard: don't run if last run was < 1 hour ago
  if (now - lastRunAt < MIN_INTERVAL_MS) {
    console.log(`[MLScheduler] Skipping — last run was ${Math.round((now - lastRunAt) / 60000)}m ago`);
    return;
  }

  lastRunAt = now;
  console.log(`[MLScheduler] Starting scheduled training cycle at ${new Date().toISOString()}`);

  try {
    lastResult = await runTrainingPipeline(90);
    console.log(`[MLScheduler] Training cycle complete in ${lastResult.durationMs}ms`);
  } catch (err: any) {
    console.error(`[MLScheduler] Training cycle failed:`, err.message);
    lastResult = { error: err.message, failedAt: new Date().toISOString() };
  }

  // Schedule next run
  scheduleNext();
}

function scheduleNext(): void {
  if (nextRunTimer) clearTimeout(nextRunTimer);
  nextRunTimer = setTimeout(executeTrainingCycle, INTERVAL_MS);
  console.log(`[MLScheduler] Next training run scheduled in 24h`);
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function startMLScheduler(): Promise<void> {
  if (schedulerStarted) return;
  schedulerStarted = true;

  // Check if a run happened recently (e.g. before server restart)
  const dbLastRun = await getLastRunTimestamp();
  lastRunAt = dbLastRun;

  const timeSinceLast = Date.now() - dbLastRun;
  const delay = timeSinceLast >= INTERVAL_MS ? 0 : INTERVAL_MS - timeSinceLast;

  console.log(`[MLScheduler] Started. ${delay === 0 ? "Running immediately" : `Next run in ${Math.round(delay / 3600000)}h`}`);

  if (delay === 0) {
    // Run after a short boot delay to let the server stabilise
    setTimeout(executeTrainingCycle, 5000);
  } else {
    nextRunTimer = setTimeout(executeTrainingCycle, delay);
  }
}

export async function triggerImmediateRetrain(): Promise<any> {
  const now = Date.now();
  if (now - lastRunAt < MIN_INTERVAL_MS) {
    return {
      skipped: true,
      reason: `Last run was ${Math.round((now - lastRunAt) / 60000)}m ago. Minimum interval is 60m.`,
    };
  }

  lastRunAt = now;
  if (nextRunTimer) clearTimeout(nextRunTimer);

  try {
    lastResult = await runTrainingPipeline(90);
    scheduleNext();
    return lastResult;
  } catch (err: any) {
    lastResult = { error: err.message, failedAt: new Date().toISOString() };
    scheduleNext();
    return lastResult;
  }
}

export function getSchedulerStatus(): SchedulerStatus {
  const nextRunAt = nextRunTimer
    ? new Date(lastRunAt + INTERVAL_MS).toISOString()
    : null;

  return {
    running: schedulerStarted,
    lastRunAt: lastRunAt > 0 ? new Date(lastRunAt).toISOString() : null,
    nextRunAt,
    lastResult,
  };
}
