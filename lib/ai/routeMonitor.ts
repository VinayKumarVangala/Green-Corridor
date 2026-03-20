import { createClient } from "@supabase/supabase-js";
import {
  calculateOptimalRoute,
  generateAlternativeRoutes,
  detectRushHour,
  type RouteResult,
  type ScoredRoute,
} from "./routeOptimizer";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-key";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ==========================================
// Configuration
// ==========================================
const MONITOR_INTERVAL_MS = 30_000;  // 30 seconds
const DELAY_THRESHOLD_S = 300;       // 5-minute delay triggers reroute search
const IMPROVEMENT_THRESHOLD = 0.15;  // 15% score improvement required to reroute
const MAX_MONITORS = 50;

// ==========================================
// Types
// ==========================================
interface ActiveMonitor {
  assignmentId: string;
  currentRoute: RouteResult;
  driverLat: number;
  driverLng: number;
  destinationLat: number;
  destinationLng: number;
  /** Duration of the last accepted route — used as baseline for delay detection */
  lastKnownDuration: number;
  intervalId: ReturnType<typeof setInterval> | null;
  checkCount: number;
  reroutes: number;
  startedAt: Date;
}

const activeMonitors: Map<string, ActiveMonitor> = new Map();

// ==========================================
// Start Monitoring
// ==========================================
export function startRouteMonitoring(
  assignmentId: string,
  currentRoute: RouteResult,
  driverLat: number, driverLng: number,
  destLat: number, destLng: number
): boolean {
  if (activeMonitors.size >= MAX_MONITORS) {
    console.warn(`[RouteMonitor] Max monitors reached. Cannot monitor ${assignmentId}.`);
    return false;
  }

  // Update position if already monitoring
  if (activeMonitors.has(assignmentId)) {
    const mon = activeMonitors.get(assignmentId)!;
    mon.driverLat = driverLat;
    mon.driverLng = driverLng;
    return true;
  }

  const monitor: ActiveMonitor = {
    assignmentId,
    currentRoute,
    driverLat,
    driverLng,
    destinationLat: destLat,
    destinationLng: destLng,
    lastKnownDuration: currentRoute.duration,
    intervalId: null,
    checkCount: 0,
    reroutes: 0,
    startedAt: new Date(),
  };

  monitor.intervalId = setInterval(() => {
    runMonitorCheck(assignmentId).catch((err) =>
      console.error(`[RouteMonitor] Check failed for ${assignmentId}:`, err)
    );
  }, MONITOR_INTERVAL_MS);

  activeMonitors.set(assignmentId, monitor);
  console.log(`[RouteMonitor] Started monitoring ${assignmentId} (interval: ${MONITOR_INTERVAL_MS / 1000}s)`);
  return true;
}

// ==========================================
// Stop Monitoring
// ==========================================
export function stopRouteMonitoring(assignmentId: string): void {
  const monitor = activeMonitors.get(assignmentId);
  if (monitor?.intervalId) clearInterval(monitor.intervalId);
  activeMonitors.delete(assignmentId);
  console.log(`[RouteMonitor] Stopped monitoring ${assignmentId}`);
}

// ==========================================
// Update Driver Position (called from location sync)
// ==========================================
export function updateDriverPosition(assignmentId: string, lat: number, lng: number): void {
  const monitor = activeMonitors.get(assignmentId);
  if (monitor) {
    monitor.driverLat = lat;
    monitor.driverLng = lng;
  }
}

// ==========================================
// Core Monitor Check
// ==========================================
async function runMonitorCheck(assignmentId: string): Promise<void> {
  const monitor = activeMonitors.get(assignmentId);
  if (!monitor) return;

  // Auto-stop if assignment is no longer active
  const { data: assignment } = await supabase
    .from("ambulance_assignments")
    .select("status")
    .eq("id", assignmentId)
    .single();

  if (!assignment || !["accepted", "picked_up"].includes(assignment.status)) {
    console.log(`[RouteMonitor] Assignment ${assignmentId} ended (${assignment?.status}). Stopping monitor.`);
    stopRouteMonitoring(assignmentId);
    return;
  }

  monitor.checkCount++;

  const freshRoute = await calculateOptimalRoute(
    monitor.driverLat, monitor.driverLng,
    monitor.destinationLat, monitor.destinationLng
  );

  if (!freshRoute) {
    console.warn(`[RouteMonitor] Could not recalculate route for ${assignmentId}`);
    return;
  }

  // Compare against last accepted duration (not original) to avoid compounding false positives
  const delay = freshRoute.duration - monitor.lastKnownDuration;
  const delayMinutes = Math.round(delay / 60);

  console.log(
    `[RouteMonitor] #${monitor.checkCount} ${assignmentId}: ` +
    `ETA ${Math.round(freshRoute.duration / 60)}m | ` +
    `Baseline ${Math.round(monitor.lastKnownDuration / 60)}m | ` +
    `Δ ${delayMinutes >= 0 ? "+" : ""}${delayMinutes}m`
  );

  if (delay > DELAY_THRESHOLD_S) {
    console.warn(`[RouteMonitor] Delay threshold exceeded for ${assignmentId}. Searching alternatives...`);

    const alternatives = await generateAlternativeRoutes(
      monitor.driverLat, monitor.driverLng,
      monitor.destinationLat, monitor.destinationLng
    );

    if (alternatives.length > 0) {
      const best = alternatives[0];
      const improvement = freshRoute.score > 0
        ? 1 - best.route.score / freshRoute.score
        : 0;

      if (improvement >= IMPROVEMENT_THRESHOLD) {
        console.log(
          `[RouteMonitor] Rerouting ${assignmentId}: ` +
          `${Math.round(improvement * 100)}% better | ` +
          `New ETA: ${Math.round(best.route.duration / 60)}m`
        );

        await logRerouteEvent(assignmentId, monitor.currentRoute, best.route, improvement);
        await notifyDriverReroute(assignmentId, best);

        // Update baseline to the new accepted route
        monitor.currentRoute = best.route;
        monitor.lastKnownDuration = best.route.duration;
        monitor.reroutes++;
        return;
      }
    }

    console.log(`[RouteMonitor] No better route found for ${assignmentId}. Continuing.`);
  }

  // Update last known duration to fresh calculation (drift tracking)
  monitor.lastKnownDuration = freshRoute.duration;
  monitor.currentRoute = freshRoute;
}

// ==========================================
// Notify Driver of Reroute via DB
// ==========================================
async function notifyDriverReroute(assignmentId: string, best: ScoredRoute): Promise<void> {
  try {
    // Store the recommended route in route_tracking so the driver's app picks it up
    await supabase.from("route_tracking").upsert(
      {
        assignment_id: assignmentId,
        route_data: {
          polyline: best.route.polyline,
          steps: best.route.steps,
          distance: best.route.distance,
          duration: best.route.duration,
          score: best.route.score,
          label: best.label,
          reroutedAt: new Date().toISOString(),
        },
        estimated_arrival: new Date(Date.now() + best.route.duration * 1000).toISOString(),
        last_updated: new Date().toISOString(),
      },
      { onConflict: "assignment_id" }
    );
  } catch (err) {
    console.error("[RouteMonitor] Failed to notify driver of reroute:", err);
  }
}

// ==========================================
// Reroute Event Logging (enriched for weight learning)
// ==========================================
async function logRerouteEvent(
  assignmentId: string,
  oldRoute: RouteResult,
  newRoute: RouteResult,
  improvement: number
): Promise<void> {
  try {
    await supabase.from("audit_logs").insert({
      action: "ROUTE_REROUTE",
      details: {
        assignmentId,
        oldDuration: oldRoute.duration,
        newDuration: newRoute.duration,
        oldDistance: oldRoute.distance,
        newDistance: newRoute.distance,
        oldScore: oldRoute.score,
        newScore: newRoute.score,
        oldTrafficFactor: oldRoute.trafficFactor,
        newTrafficFactor: newRoute.trafficFactor,
        improvement: Math.round(improvement * 100),
        rushHour: detectRushHour().label,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("[RouteMonitor] Failed to log reroute event:", err);
  }
}

// ==========================================
// Status Queries
// ==========================================
export function getMonitorStatus(assignmentId: string): ActiveMonitor | undefined {
  return activeMonitors.get(assignmentId);
}

export function getAllActiveMonitors(): {
  assignmentId: string;
  checks: number;
  reroutes: number;
  uptimeSeconds: number;
  currentEtaMinutes: number;
}[] {
  return Array.from(activeMonitors.values()).map((m) => ({
    assignmentId: m.assignmentId,
    checks: m.checkCount,
    reroutes: m.reroutes,
    uptimeSeconds: Math.round((Date.now() - m.startedAt.getTime()) / 1000),
    currentEtaMinutes: Math.round(m.lastKnownDuration / 60),
  }));
}
