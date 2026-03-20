import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@/auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-key"
);

export const dynamic = "force-dynamic";

/**
 * GET /api/analytics/dashboard?range=7d|30d|90d
 * Admin-only. Returns aggregated KPIs and chart data.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") ?? "7d";
  const days = range === "90d" ? 90 : range === "30d" ? 30 : 7;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Fetch all analytics in parallel
  const [
    { data: incidents },
    { data: driverDecisions },
    { data: routeChanges },
    { data: junctionLogs },
    { data: activeRequests },
    { data: drivers },
    { data: hospitals },
  ] = await Promise.all([
    supabase
      .from("incident_analytics")
      .select(`
        id, emergency_request_id, request_created_at, total_duration,
        dispatch_duration, acceptance_duration, pickup_duration, transport_duration,
        total_dispatch_attempts, declined_count, route_changes_count,
        hospital_id, final_driver_id, hospital_capacity_at_arrival,
        response_efficiency, route_efficiency, stakeholder_coordination_score,
        hospitals(name), ambulance_drivers(vehicle_number, employee_id)
      `)
      .gte("request_created_at", since)
      .order("request_created_at", { ascending: true }),
    supabase
      .from("driver_decisions")
      .select("driver_id, decision, decision_time_seconds, driver_distance_km, created_at")
      .gte("created_at", since),
    supabase
      .from("route_changes")
      .select("reason, triggered_by, improvement_percent, created_at")
      .gte("created_at", since),
    supabase
      .from("junction_clearance_log")
      .select("junction_id, status, clearance_time_seconds, created_at, traffic_junctions(name, lat, lng)")
      .gte("created_at", since),
    supabase
      .from("emergency_requests")
      .select("id, status, created_at")
      .gte("created_at", since),
    supabase.from("ambulance_drivers").select("id, vehicle_number, employee_id, current_status"),
    supabase.from("hospitals").select("id, name, capacity_status"),
  ]);

  const inc = incidents ?? [];
  const completed = inc.filter((i) => i.total_duration != null);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const avgResponseTime = completed.length
    ? Math.round(completed.reduce((s, i) => s + (i.total_duration ?? 0), 0) / completed.length)
    : 0;

  const avgDispatch = completed.length
    ? Math.round(completed.reduce((s, i) => s + (i.dispatch_duration ?? 0), 0) / completed.length)
    : 0;

  const totalRequests = activeRequests?.length ?? 0;
  const completedRequests = activeRequests?.filter((r) => r.status === "arrived").length ?? 0;
  const pendingRequests = activeRequests?.filter((r) => r.status === "pending").length ?? 0;

  const avgAttempts = inc.length
    ? (inc.reduce((s, i) => s + (i.total_dispatch_attempts ?? 0), 0) / inc.length).toFixed(1)
    : "0";

  const rerouteRate = inc.length
    ? Math.round((inc.filter((i) => (i.route_changes_count ?? 0) > 0).length / inc.length) * 100)
    : 0;

  // ── Response Time Trend (daily buckets) ───────────────────────────────────
  const buckets: Record<string, { total: number; count: number }> = {};
  for (const i of completed) {
    const day = i.request_created_at?.slice(0, 10);
    if (!day) continue;
    if (!buckets[day]) buckets[day] = { total: 0, count: 0 };
    buckets[day].total += i.total_duration ?? 0;
    buckets[day].count += 1;
  }
  const responseTimeTrend = Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { total, count }]) => ({
      date,
      avgSeconds: Math.round(total / count),
      avgMinutes: Math.round(total / count / 60),
      count,
    }));

  // ── Hospital Performance ──────────────────────────────────────────────────
  const hospitalMap: Record<string, { name: string; count: number; totalDuration: number; capacityIssues: number }> = {};
  for (const i of completed) {
    const hid = i.hospital_id;
    if (!hid) continue;
    if (!hospitalMap[hid]) {
      hospitalMap[hid] = {
        name: (i.hospitals as any)?.name ?? "Unknown",
        count: 0,
        totalDuration: 0,
        capacityIssues: 0,
      };
    }
    hospitalMap[hid].count += 1;
    hospitalMap[hid].totalDuration += i.total_duration ?? 0;
    if (i.hospital_capacity_at_arrival === "critical" || i.hospital_capacity_at_arrival === "busy") {
      hospitalMap[hid].capacityIssues += 1;
    }
  }
  const hospitalPerformance = Object.entries(hospitalMap)
    .map(([id, h]) => ({
      id,
      name: h.name,
      totalIncidents: h.count,
      avgResponseMinutes: Math.round(h.totalDuration / h.count / 60),
      capacityIssueRate: Math.round((h.capacityIssues / h.count) * 100),
      currentStatus: hospitals?.find((x) => x.id === id)?.capacity_status ?? "unknown",
    }))
    .sort((a, b) => b.totalIncidents - a.totalIncidents);

  // ── Driver Performance ────────────────────────────────────────────────────
  const driverMap: Record<string, { vehicleNumber: string; employeeId: string; accepted: number; declined: number; timeout: number; totalDecisionTime: number; decisionCount: number }> = {};
  for (const d of driverDecisions ?? []) {
    const did = d.driver_id;
    if (!driverMap[did]) {
      const driver = drivers?.find((x) => x.id === did);
      driverMap[did] = {
        vehicleNumber: driver?.vehicle_number ?? "Unknown",
        employeeId: driver?.employee_id ?? "—",
        accepted: 0, declined: 0, timeout: 0,
        totalDecisionTime: 0, decisionCount: 0,
      };
    }
    if (d.decision === "accepted") driverMap[did].accepted += 1;
    else if (d.decision === "declined") driverMap[did].declined += 1;
    else driverMap[did].timeout += 1;
    if (d.decision_time_seconds) {
      driverMap[did].totalDecisionTime += d.decision_time_seconds;
      driverMap[did].decisionCount += 1;
    }
  }
  // Also count completed missions from incident_analytics
  const missionsByDriver: Record<string, number> = {};
  for (const i of completed) {
    if (i.final_driver_id) missionsByDriver[i.final_driver_id] = (missionsByDriver[i.final_driver_id] ?? 0) + 1;
  }
  const driverPerformance = Object.entries(driverMap)
    .map(([id, d]) => {
      const total = d.accepted + d.declined + d.timeout;
      return {
        id,
        vehicleNumber: d.vehicleNumber,
        employeeId: d.employeeId,
        acceptanceRate: total > 0 ? Math.round((d.accepted / total) * 100) : 0,
        avgDecisionSeconds: d.decisionCount > 0 ? Math.round(d.totalDecisionTime / d.decisionCount) : 0,
        completedMissions: missionsByDriver[id] ?? 0,
        totalAssignments: total,
        currentStatus: drivers?.find((x) => x.id === id)?.current_status ?? "offline",
      };
    })
    .sort((a, b) => b.completedMissions - a.completedMissions)
    .slice(0, 10);

  // ── Traffic Hotspots ──────────────────────────────────────────────────────
  const junctionMap: Record<string, { name: string; lat: number; lng: number; total: number; cleared: number; totalClearanceTime: number }> = {};
  for (const j of junctionLogs ?? []) {
    const jid = j.junction_id;
    if (!junctionMap[jid]) {
      const junc = j.traffic_junctions as any;
      junctionMap[jid] = { name: junc?.name ?? "Unknown", lat: junc?.lat ?? 0, lng: junc?.lng ?? 0, total: 0, cleared: 0, totalClearanceTime: 0 };
    }
    junctionMap[jid].total += 1;
    if (j.status === "cleared") {
      junctionMap[jid].cleared += 1;
      junctionMap[jid].totalClearanceTime += j.clearance_time_seconds ?? 0;
    }
  }
  const trafficHotspots = Object.entries(junctionMap)
    .map(([id, j]) => ({
      id,
      name: j.name,
      lat: j.lat,
      lng: j.lng,
      totalAlerts: j.total,
      clearanceRate: j.total > 0 ? Math.round((j.cleared / j.total) * 100) : 0,
      avgClearanceSeconds: j.cleared > 0 ? Math.round(j.totalClearanceTime / j.cleared) : 0,
    }))
    .sort((a, b) => b.totalAlerts - a.totalAlerts)
    .slice(0, 10);

  // ── Reroute breakdown ─────────────────────────────────────────────────────
  const rerouteReasons: Record<string, number> = {};
  for (const r of routeChanges ?? []) {
    rerouteReasons[r.reason] = (rerouteReasons[r.reason] ?? 0) + 1;
  }

  return NextResponse.json({
    kpis: {
      totalRequests,
      completedRequests,
      pendingRequests,
      avgResponseMinutes: Math.round(avgResponseTime / 60),
      avgDispatchSeconds: avgDispatch,
      avgDispatchAttempts: avgAttempts,
      rerouteRate,
      activeDrivers: drivers?.filter((d) => d.current_status !== "offline").length ?? 0,
      availableHospitals: hospitals?.filter((h) => h.capacity_status === "available").length ?? 0,
    },
    responseTimeTrend,
    hospitalPerformance,
    driverPerformance,
    trafficHotspots,
    rerouteReasons,
    range,
    generatedAt: new Date().toISOString(),
  });
}
