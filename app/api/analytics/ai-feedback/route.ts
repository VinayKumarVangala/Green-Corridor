import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@/auth";
import { DEFAULT_WEIGHTS } from "@/lib/ai/routeOptimizer";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-key"
);

/**
 * POST /api/analytics/ai-feedback
 * Admin marks a decision as successful or failed, optionally overriding weights.
 *
 * Body: {
 *   incidentId: string,
 *   decisionType: "dispatch" | "route" | "hospital",
 *   outcome: "success" | "failure",
 *   notes?: string,
 *   // For route weight override (optional):
 *   weightOverride?: { traffic: number; distance: number; roadType: number; rushHour: number }
 * }
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const { incidentId, decisionType, outcome, notes, weightOverride } = body;

  if (!incidentId || !decisionType || !outcome) {
    return NextResponse.json({ error: "incidentId, decisionType, outcome required" }, { status: 400 });
  }

  // 1. Fetch the incident for context
  const { data: incident } = await supabase
    .from("incident_analytics")
    .select("id, emergency_request_id, route_changes_count, total_duration, response_efficiency")
    .or(`id.eq.${incidentId},emergency_request_id.eq.${incidentId}`)
    .single();

  if (!incident) {
    return NextResponse.json({ error: "Incident not found" }, { status: 404 });
  }

  // 2. Write feedback to audit_logs so the adaptive weight learner can consume it
  const feedbackDetails: any = {
    incidentId: incident.id,
    decisionType,
    outcome,
    notes: notes ?? null,
    markedBy: session.user.id,
    markedAt: new Date().toISOString(),
  };

  // If admin provides explicit weight override, store it as a WEIGHT_OVERRIDE log
  if (weightOverride) {
    const sum = Object.values(weightOverride as Record<string, number>).reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1) > 0.01) {
      return NextResponse.json({ error: "Weight values must sum to 1.0" }, { status: 400 });
    }
    await supabase.from("audit_logs").insert({
      user_id: session.user.id,
      action: "WEIGHT_OVERRIDE",
      entity_type: "route_weights",
      details: {
        weights: weightOverride,
        previousDefaults: DEFAULT_WEIGHTS,
        reason: notes ?? "Admin override",
        incidentId: incident.id,
      },
    });
    feedbackDetails.weightOverride = weightOverride;
  }

  // 3. Log the AI feedback decision
  await supabase.from("audit_logs").insert({
    user_id: session.user.id,
    action: "AI_FEEDBACK",
    entity_type: "incident_analytics",
    entity_id: incident.id,
    details: feedbackDetails,
  });

  // 4. Update response_efficiency on the incident if outcome is known
  const efficiencyUpdate: any = {};
  if (outcome === "success" && incident.response_efficiency == null) {
    // Compute a simple efficiency score: 1.0 if under 10min, scaled down
    const totalMin = (incident.total_duration ?? 600) / 60;
    efficiencyUpdate.response_efficiency = Math.max(0, Math.min(1, 1 - (totalMin - 10) / 30));
  } else if (outcome === "failure") {
    efficiencyUpdate.response_efficiency = 0;
  }

  if (Object.keys(efficiencyUpdate).length > 0) {
    await supabase
      .from("incident_analytics")
      .update(efficiencyUpdate)
      .eq("id", incident.id);
  }

  return NextResponse.json({
    success: true,
    incidentId: incident.id,
    outcome,
    decisionType,
    weightOverride: weightOverride ?? null,
  });
}

/**
 * GET /api/analytics/ai-feedback
 * Returns current adaptive weights + recent feedback summary.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: rerouteLogs }, { data: feedbackLogs }, { data: weightOverrides }] = await Promise.all([
    supabase
      .from("audit_logs")
      .select("details, created_at")
      .eq("action", "ROUTE_REROUTE")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("audit_logs")
      .select("details, created_at")
      .eq("action", "AI_FEEDBACK")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("audit_logs")
      .select("details, created_at")
      .eq("action", "WEIGHT_OVERRIDE")
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  // Compute current effective weights (latest override wins, else adaptive)
  const latestOverride = weightOverrides?.[0]?.details?.weights ?? null;

  // Compute adaptive signal from reroute logs
  let trafficImprovements = 0, distanceImprovements = 0, count = 0;
  for (const log of rerouteLogs ?? []) {
    const d = log.details as any;
    if (!d) continue;
    if (d.newTrafficFactor < d.oldTrafficFactor) trafficImprovements++;
    if (d.newDistance < d.oldDistance) distanceImprovements++;
    count++;
  }

  const adaptiveSignal = count >= 5 ? {
    trafficBottleneckRate: Math.round((trafficImprovements / count) * 100),
    distanceBottleneckRate: Math.round((distanceImprovements / count) * 100),
    sampleSize: count,
  } : null;

  // Feedback summary
  const feedbackSummary = { success: 0, failure: 0, byType: {} as Record<string, { success: number; failure: number }> };
  for (const f of feedbackLogs ?? []) {
    const d = f.details as any;
    if (!d) continue;
    if (d.outcome === "success") feedbackSummary.success++;
    else feedbackSummary.failure++;
    const t = d.decisionType ?? "unknown";
    if (!feedbackSummary.byType[t]) feedbackSummary.byType[t] = { success: 0, failure: 0 };
    feedbackSummary.byType[t][d.outcome === "success" ? "success" : "failure"]++;
  }

  return NextResponse.json({
    currentWeights: latestOverride ?? DEFAULT_WEIGHTS,
    defaultWeights: DEFAULT_WEIGHTS,
    hasOverride: !!latestOverride,
    overrideSetAt: weightOverrides?.[0]?.created_at ?? null,
    adaptiveSignal,
    feedbackSummary,
  });
}
