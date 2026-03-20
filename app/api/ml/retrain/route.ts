import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { triggerImmediateRetrain, getSchedulerStatus, startMLScheduler } from "@/lib/ml/scheduler";
import { listModels } from "@/lib/ml/modelRegistry";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-key"
);

// Ensure scheduler is running (idempotent — safe to call on every request)
startMLScheduler().catch(console.error);

/**
 * GET /api/ml/retrain
 * Returns scheduler status, model registry, and recent A/B test state.
 * Admin-only.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const [schedulerStatus, responseTimeModels, congestionModels, abTests, recentRuns] = await Promise.all([
    Promise.resolve(getSchedulerStatus()),
    listModels("response_time"),
    listModels("congestion"),
    supabase
      .from("ml_ab_tests")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(10),
    supabase
      .from("audit_logs")
      .select("details, created_at")
      .eq("action", "ML_TRAINING_RUN")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  return NextResponse.json({
    scheduler: schedulerStatus,
    models: {
      response_time: responseTimeModels,
      congestion: congestionModels,
    },
    abTests: abTests.data ?? [],
    recentRuns: recentRuns.data?.map((r) => ({
      ...r.details,
      ranAt: r.created_at,
    })) ?? [],
  });
}

/**
 * POST /api/ml/retrain
 * Triggers an immediate training run.
 * Admin-only.
 *
 * Body (optional): { lookbackDays?: number }
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  console.log(`[API:ML:Retrain] Manual retrain triggered by ${session.user.id}`);

  const body = await request.json().catch(() => ({}));
  const lookbackDays = typeof body.lookbackDays === "number" ? body.lookbackDays : 90;

  // Run in background — respond immediately with job started
  // (training can take a few seconds; client polls GET for results)
  const runPromise = triggerImmediateRetrain();

  // Wait up to 30s for a result before returning async
  const result = await Promise.race([
    runPromise,
    new Promise((resolve) => setTimeout(() => resolve({ async: true, message: "Training running in background — poll GET /api/ml/retrain for status" }), 30_000)),
  ]);

  return NextResponse.json({ triggered: true, lookbackDays, result });
}
