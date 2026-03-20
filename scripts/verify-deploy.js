#!/usr/bin/env node
// scripts/verify-deploy.js — Post-deploy health checks for JEEVAN-SETU
// Usage: node scripts/verify-deploy.js <base-url>

const BASE_URL = process.argv[2]?.replace(/\/$/, "") ?? process.env.NEXTAUTH_URL ?? "";

if (!BASE_URL) {
  console.error("Usage: node scripts/verify-deploy.js <base-url>");
  process.exit(1);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function ok(label)   { console.log(`  ✅ ${label}`); passed++; }
function fail(label, reason) { console.error(`  ❌ ${label}${reason ? ` — ${reason}` : ""}`); failed++; }

async function get(path, expectedStatus = 200) {
  const url = `${BASE_URL}${path}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    return { status: res.status, ok: res.status === expectedStatus, url };
  } catch (e) {
    return { status: 0, ok: false, url, error: e.message };
  }
}

// ─── Check groups ─────────────────────────────────────────────────────────────

async function checkPages() {
  console.log("\n📄 Public pages");
  const pages = [
    ["/",           200, "Landing page"],
    ["/request",    200, "Emergency request form"],
    ["/login",      200, "Login page"],
    ["/ambulance",  200, "Ambulance redirect"],
    ["/hospital",   200, "Hospital redirect"],
    ["/traffic",    200, "Traffic redirect"],
  ];
  for (const [path, status, label] of pages) {
    const r = await get(path, status);
    r.ok ? ok(label) : fail(label, `HTTP ${r.status} at ${r.url}`);
  }
}

async function checkApiRoutes() {
  console.log("\n🔌 API routes");
  const routes = [
    ["/api/emergency/status?id=nonexistent", 404, "Emergency status (404 for unknown)"],
    ["/api/hospital/status",                 401, "Hospital status (401 without auth)"],
    ["/api/ambulance/assignment/status",     401, "Ambulance assignment (401 without auth)"],
    ["/api/traffic/status",                  401, "Traffic status (401 without auth)"],
  ];
  for (const [path, status, label] of routes) {
    const r = await get(path, status);
    r.ok ? ok(label) : fail(label, `Expected ${status}, got ${r.status}`);
  }
}

async function checkSupabaseConnectivity() {
  console.log("\n🗄  Supabase connectivity");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) { fail("NEXT_PUBLIC_SUPABASE_URL", "env var not set"); return; }

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/hospitals?select=id&limit=1`, {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""}`,
      },
      signal: AbortSignal.timeout(8_000),
    });
    res.ok ? ok("Supabase REST reachable") : fail("Supabase REST", `HTTP ${res.status}`);
  } catch (e) {
    fail("Supabase REST", e.message);
  }
}

async function checkEnvVars() {
  console.log("\n🔑 Environment variables");
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXTAUTH_SECRET",
    "NEXTAUTH_URL",
  ];
  for (const key of required) {
    process.env[key] ? ok(key) : fail(key, "not set");
  }
}

async function checkPerformance() {
  console.log("\n⚡ Performance");
  const start = Date.now();
  const r = await get("/");
  const ms = Date.now() - start;
  if (!r.ok) { fail("Landing page load", `HTTP ${r.status}`); return; }
  ms < 3000 ? ok(`Landing page: ${ms}ms`) : fail(`Landing page: ${ms}ms`, "exceeds 3s threshold");
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🔍 JEEVAN-SETU — Deployment verification`);
  console.log(`   Target: ${BASE_URL}\n`);

  await checkEnvVars();
  await checkPages();
  await checkApiRoutes();
  await checkSupabaseConnectivity();
  await checkPerformance();

  console.log(`\n${"─".repeat(50)}`);
  console.log(`  Passed: ${passed}  |  Failed: ${failed}`);
  console.log(`${"─".repeat(50)}\n`);

  if (failed > 0) {
    console.error(`❌ ${failed} check(s) failed`);
    process.exit(1);
  }
  console.log("✅ All checks passed");
}

main();
