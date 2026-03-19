import { createClient } from "@supabase/supabase-js";
import {
  calculateOptimalRoute,
  generateAlternativeRoutes,
  getTrafficFactor,
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
const MONITOR_INTERVAL_MS = 30_000;     // Check every 30 seconds
const DELAY_THRESHOLD_S = 300;          // 5 minute delay triggers reroute
const IMPROVEMENT_THRESHOLD = 0.15;     // 15% score improvement triggers recommendation
const MAX_MONITORS = 50;                // Max concurrent monitored routes

// ==========================================
// Active Monitor Registry
// ==========================================
interface ActiveMonitor {
  assignmentId: string;
  currentRoute: RouteResult;
  driverLat: number;
  driverLng: number;
  destinationLat: number;
  destinationLng: number;
  originalDuration: number;
  intervalId: ReturnType<typeof setInterval> | null;
  checkCount: number;
  reroutes: number;
  startedAt: Date;
}

const activeMonitors: Map<string, ActiveMonitor> = new Map();

// ==========================================
// Start Continuous Monitoring
// ==========================================
export function startRouteMonitoring(
  assignmentId: string,
  currentRoute: RouteResult,
  driverLat: number, driverLng: number,
  destLat: number, destLng: number
): boolean {
  if (activeMonitors.size >= MAX_MONITORS) {
    console.warn(`[RouteMonitor] Max monitors (${MAX_MONITORS}) reached. Cannot monitor ${assignmentId}.`);
    return false;
  }

  if (activeMonitors.has(assignmentId)) {
    console.log(`[RouteMonitor] Already monitoring ${assignmentId}. Updating position.`);
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
    originalDuration: currentRoute.duration,
    intervalId: null,
    checkCount: 0,
    reroutes: 0,
    startedAt: new Date(),
  };

  // Start periodic checks
  monitor.intervalId = setInterval(() => {
    runMonitorCheck(assignmentId).catch((err) =>
      console.error(`[RouteMonitor] Check failed for ${assignmentId}:`, err)
    );
  }, MONITOR_INTERVAL_MS);

  activeMonitors.set(assignmentId, monitor);
  console.log(`[RouteMonitor] Started monitoring ${assignmentId}. Interval: ${MONITOR_INTERVAL_MS / 1000}s`);
  return true;
}

// ==========================================
// Stop Monitoring
// ==========================================
export function stopRouteMonitoring(assignmentId: string): void {
  const monitor = activeMonitors.get(assignmentId);
  if (monitor?.intervalId) {
    clearInterval(monitor.intervalId);
  }
  activeMonitors.delete(assignmentId);
  console.log(`[RouteMonitor] Stopped monitoring ${assignmentId}`);
}

// ==========================================
// Update Driver Position
// ==========================================
export function updateDriverPosition(
  assignmentId: string,
  lat: number, lng: number
): void {
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

  monitor.checkCount++;

  // 1. Recalculate current route with fresh traffic data
  const freshRoute = await calculateOptimalRoute(
    monitor.driverLat, monitor.driverLng,
    monitor.destinationLat, monitor.destinationLng
  );

  if (!freshRoute) {
    console.warn(`[RouteMonitor] Could not recalculate route for ${assignmentId}`);
    return;
  }

  // 2. Compare with original duration
  const delay = freshRoute.duration - monitor.originalDuration;
  const delayMinutes = Math.round(delay / 60);

  console.log(
    `[RouteMonitor] Check #${monitor.checkCount} for ${assignmentId}: ` +
    `Current ETA: ${Math.round(freshRoute.duration / 60)}m | ` +
    `Original: ${Math.round(monitor.originalDuration / 60)}m | ` +
    `Delay: ${delayMinutes >= 0 ? "+" : ""}${delayMinutes}m`
  );

  // 3. Check if delay exceeds threshold
  if (delay > DELAY_THRESHOLD_S) {
    console.warn(`[RouteMonitor] DELAY THRESHOLD EXCEEDED for ${assignmentId}. Searching alternatives...`);

    // Generate alternative routes
    const alternatives = await generateAlternativeRoutes(
      monitor.driverLat, monitor.driverLng,
      monitor.destinationLat, monitor.destinationLng
    );

    if (alternatives.length > 1) {
      const best = alternatives[0]; // Already sorted by score
      const improvement = 1 - best.route.score / freshRoute.score;

      if (improvement >= IMPROVEMENT_THRESHOLD) {
        console.log(
          `[RouteMonitor] BETTER ROUTE FOUND for ${assignmentId}! ` +
          `Improvement: ${Math.round(improvement * 100)}% | ` +
          `New ETA: ${Math.round(best.route.duration / 60)}m`
        );

        // Log the reroute event
        await logRerouteEvent(assignmentId, freshRoute, best.route, improvement);

        // Update the monitor with the new route
        monitor.currentRoute = best.route;
        monitor.reroutes++;

        return;
      }
    }

    // No significantly better route found
    console.log(`[RouteMonitor] No significantly better route found for ${assignmentId}. Continuing on current.`);
  }

  // Update current route data
  monitor.currentRoute = freshRoute;
}

// ==========================================
// Reroute Event Logging
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
        oldScore: oldRoute.score,
        newScore: newRoute.score,
        improvement: Math.round(improvement * 100),
        trafficFactor: newRoute.trafficFactor,
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

export function getAllActiveMonitors(): { assignmentId: string; checks: number; reroutes: number; uptime: number }[] {
  return Array.from(activeMonitors.values()).map((m) => ({
    assignmentId: m.assignmentId,
    checks: m.checkCount,
    reroutes: m.reroutes,
    uptime: Math.round((Date.now() - m.startedAt.getTime()) / 1000),
  }));
}
