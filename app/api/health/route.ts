// /app/api/health/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAllActiveMonitors } from "@/lib/ai/routeMonitor";
import { getJobsByStatus } from "@/lib/ai/jobProcessor";

export const dynamic = "force-dynamic";

const STARTED_AT = Date.now();
const VERSION    = process.env.npm_package_version ?? "0.1.0";
const OSRM_BASE  = "https://router.project-osrm.org";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "https://dummy.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "dummy-key",
);

// ─── Individual checks ────────────────────────────────────────────────────────

async function checkSupabase(): Promise<{ ok: boolean; latencyMs: number; detail?: string }> {
  const t = Date.now();
  try {
    const { error } = await supabase
      .from("hospitals")
      .select("id")
      .limit(1)
      .maybeSingle();

    return { ok: !error, latencyMs: Date.now() - t, detail: error?.message };
  } catch (e: any) {
    return { ok: false, latencyMs: Date.now() - t, detail: e.message };
  }
}

async function checkOsrm(): Promise<{ ok: boolean; latencyMs: number; detail?: string }> {
  const t = Date.now();
  try {
    // Lightweight nearest-node probe — no routing computation
    const res = await fetch(
      `${OSRM_BASE}/nearest/v1/driving/77.2090,28.6139`,
      { signal: AbortSignal.timeout(5_000) },
    );
    return { ok: res.ok, latencyMs: Date.now() - t };
  } catch (e: any) {
    return { ok: false, latencyMs: Date.now() - t, detail: e.message };
  }
}

function checkJobQueue() {
  const failed   = getJobsByStatus("failed").length;
  const running  = getJobsByStatus("running").length;
  const retrying = getJobsByStatus("retrying").length;
  return { ok: failed === 0, failed, running, retrying };
}

function checkEnvVars() {
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXTAUTH_SECRET",
    "NEXTAUTH_URL",
  ];
  const missing = required.filter(k => !process.env[k]);
  return { ok: missing.length === 0, missing };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  const [supabaseCheck, osrmCheck] = await Promise.all([
    checkSupabase(),
    checkOsrm(),
  ]);

  const jobQueue  = checkJobQueue();
  const envVars   = checkEnvVars();
  const monitors  = getAllActiveMonitors();

  const allOk = supabaseCheck.ok && osrmCheck.ok && envVars.ok;
  const status = allOk ? "healthy" : supabaseCheck.ok ? "degraded" : "unhealthy";

  const body = {
    status,
    version:    VERSION,
    uptimeSeconds: Math.round((Date.now() - STARTED_AT) / 1000),
    timestamp:  new Date().toISOString(),
    checks: {
      database: {
        ok:        supabaseCheck.ok,
        latencyMs: supabaseCheck.latencyMs,
        detail:    supabaseCheck.detail,
      },
      mapApi: {
        ok:        osrmCheck.ok,
        latencyMs: osrmCheck.latencyMs,
        detail:    osrmCheck.detail,
      },
      jobQueue: {
        ok:       jobQueue.ok,
        failed:   jobQueue.failed,
        running:  jobQueue.running,
        retrying: jobQueue.retrying,
      },
      environment: {
        ok:      envVars.ok,
        missing: envVars.missing,
      },
    },
    activeMonitors: monitors.length,
  };

  // 200 for healthy/degraded, 503 for unhealthy — lets load balancers act on it
  return NextResponse.json(body, { status: status === "unhealthy" ? 503 : 200 });
}
