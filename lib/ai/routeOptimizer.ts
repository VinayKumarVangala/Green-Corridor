import { createClient } from "@supabase/supabase-js";
import { haversineDistance } from "./ambulanceDispatch";
import { withRetry } from "@/lib/errors/handleApiError";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-key";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const OSRM_BASE = "https://router.project-osrm.org";

// ==========================================
// Types & Interfaces
// ==========================================
export interface RouteResult {
  distance: number;      // meters
  duration: number;      // seconds (traffic-adjusted)
  polyline: string;      // encoded polyline
  score: number;         // composite score (lower = better)
  trafficFactor: number; // multiplier applied for traffic
  waypoints: { lat: number; lng: number; name: string }[];
  steps: RouteStep[];
}

export interface RouteStep {
  instruction: string;
  distance: number;
  duration: number;
  roadType: RoadType;
}

export interface HospitalRanking {
  id: string;
  name: string;
  distance: number;
  status: string;
  specialties: string[];
  score: number;
  estimatedArrival: number; // seconds
  breakdown: {
    distanceScore: number;
    capacityScore: number;
    specialtyScore: number;
    rushHourPenalty: number;
  };
}

export interface ScoredRoute {
  route: RouteResult;
  label: string;
  isRecommended: boolean;
}

export type RoadType = "highway" | "main" | "secondary" | "residential" | "service";

// ==========================================
// Adaptive Scoring Weights
// ==========================================
export interface RouteWeights {
  traffic: number;   // Default: 0.40
  distance: number;  // Default: 0.30
  roadType: number;  // Default: 0.20
  rushHour: number;  // Default: 0.10
}

export const DEFAULT_WEIGHTS: RouteWeights = {
  traffic: 0.40,
  distance: 0.30,
  roadType: 0.20,
  rushHour: 0.10,
};

// In-memory weight cache — updated by learnFromReroute()
let adaptiveWeights: RouteWeights = { ...DEFAULT_WEIGHTS };

/**
 * Reads recent reroute audit logs and adjusts weights.
 * If traffic-caused reroutes dominate → increase traffic weight.
 * If distance-caused reroutes dominate → increase distance weight.
 * Called lazily at most once per 5 minutes.
 */
let lastWeightUpdate = 0;
export async function getAdaptiveWeights(): Promise<RouteWeights> {
  if (Date.now() - lastWeightUpdate < 5 * 60 * 1000) return adaptiveWeights;

  try {
    // Admin override takes priority over adaptive learning
    const { data: overrides } = await supabase
      .from("audit_logs")
      .select("details")
      .eq("action", "WEIGHT_OVERRIDE")
      .order("created_at", { ascending: false })
      .limit(1);

    if (overrides?.[0]?.details?.weights) {
      adaptiveWeights = overrides[0].details.weights as RouteWeights;
      lastWeightUpdate = Date.now();
      console.log(`[RouteOptimizer] Using admin weight override:`, adaptiveWeights);
      return adaptiveWeights;
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: logs } = await supabase
      .from("audit_logs")
      .select("details")
      .eq("action", "ROUTE_REROUTE")
      .gte("created_at", since)
      .limit(50);

    if (!logs || logs.length < 5) return adaptiveWeights; // Not enough data

    // Measure average improvement per dimension
    let trafficImprovements = 0;
    let distanceImprovements = 0;
    let count = 0;

    for (const log of logs) {
      const d = log.details as any;
      if (!d) continue;
      // If new route has lower trafficFactor → traffic was the bottleneck
      if (d.newTrafficFactor < d.oldTrafficFactor) trafficImprovements++;
      // If new route is shorter in distance → distance was the bottleneck
      if (d.newDistance < d.oldDistance) distanceImprovements++;
      count++;
    }

    if (count === 0) return adaptiveWeights;

    const trafficRatio = trafficImprovements / count;
    const distanceRatio = distanceImprovements / count;

    // Nudge weights by ±5% based on signal, keep sum = 1
    const newTraffic = Math.min(0.60, Math.max(0.20, DEFAULT_WEIGHTS.traffic + (trafficRatio - 0.5) * 0.10));
    const newDistance = Math.min(0.50, Math.max(0.15, DEFAULT_WEIGHTS.distance + (distanceRatio - 0.5) * 0.10));
    const remainder = 1 - newTraffic - newDistance;

    adaptiveWeights = {
      traffic: Math.round(newTraffic * 100) / 100,
      distance: Math.round(newDistance * 100) / 100,
      roadType: Math.round((remainder * 0.67) * 100) / 100,
      rushHour: Math.round((remainder * 0.33) * 100) / 100,
    };

    lastWeightUpdate = Date.now();
    console.log(`[RouteOptimizer] Adaptive weights updated:`, adaptiveWeights);
  } catch {
    // Fall back to defaults silently
  }

  return adaptiveWeights;
}

// Road type preference scores (lower = better for emergency vehicles)
const ROAD_TYPE_SCORES: Record<RoadType, number> = {
  highway: 1.0,
  main: 1.5,
  secondary: 3.0,
  residential: 5.0,
  service: 4.0,
};

// ==========================================
// Rush Hour Detection
// ==========================================
export interface RushHourProfile {
  isRushHour: boolean;
  severity: number; // 0–1
  label: string;
}

export function detectRushHour(): RushHourProfile {
  const hour = new Date().getHours();
  const day = new Date().getDay();

  if (day === 0 || day === 6)
    return { isRushHour: false, severity: 0.1, label: "Weekend — light traffic" };
  if (hour >= 8 && hour <= 9)
    return { isRushHour: true, severity: 0.8, label: "Morning Rush — heavy congestion" };
  if (hour >= 17 && hour <= 19)
    return { isRushHour: true, severity: 0.9, label: "Evening Rush — peak congestion" };
  if ((hour >= 7 && hour <= 10) || (hour >= 16 && hour <= 20))
    return { isRushHour: true, severity: 0.5, label: "Shoulder Hours — moderate congestion" };
  if (hour >= 22 || hour <= 5)
    return { isRushHour: false, severity: 0.05, label: "Night — minimal traffic" };

  return { isRushHour: false, severity: 0.2, label: "Off-Peak — normal traffic" };
}

// ==========================================
// Traffic Factor from Live Junction Alerts
// ==========================================
export async function getTrafficFactor(
  startLat: number, startLng: number,
  endLat: number, endLng: number
): Promise<number> {
  try {
    const midLat = (startLat + endLat) / 2;
    const midLng = (startLng + endLng) / 2;

    // Use active junction_alerts as congestion signal (pending = blocked, cleared = free)
    const { data: alerts } = await supabase
      .from("junction_alerts")
      .select("status, junction_id, expected_arrival")
      .eq("status", "pending")
      .gte("expected_arrival", new Date().toISOString());

    if (!alerts || alerts.length === 0) {
      // Fall back to rush-hour heuristic
      return 1.0 + detectRushHour().severity * 0.5;
    }

    // Fetch junction coordinates for the active alerts
    const junctionIds = [...new Set(alerts.map((a) => a.junction_id))];
    const { data: junctions } = await supabase
      .from("traffic_junctions")
      .select("id, lat, lng")
      .in("id", junctionIds);

    if (!junctions || junctions.length === 0) return 1.0 + detectRushHour().severity * 0.5;

    // Count how many active-alert junctions are within 2km of the route midpoint
    const nearbyCount = junctions.filter(
      (j) => haversineDistance(midLat, midLng, j.lat || 0, j.lng || 0) <= 2
    ).length;

    // Each nearby blocked junction adds ~0.2 to the factor, capped at 2.5
    const alertFactor = Math.min(2.5, 1.0 + nearbyCount * 0.2);
    const rushFactor = 1.0 + detectRushHour().severity * 0.3;

    return Math.round(Math.max(alertFactor, rushFactor) * 100) / 100;
  } catch {
    return 1.0 + detectRushHour().severity * 0.5;
  }
}

// ==========================================
// Road Type Classification
// ==========================================
function classifyRoadType(stepName: string, stepRef: string): RoadType {
  const s = `${stepName} ${stepRef}`.toLowerCase();
  if (s.includes("highway") || s.includes("nh") || s.includes("expressway") || s.includes("sh")) return "highway";
  if (s.includes("main") || s.includes("national") || s.includes("state") || s.includes("arterial")) return "main";
  if (s.includes("service") || s.includes("lane")) return "service";
  if (s.includes("street") || s.includes("road") || s.includes("marg") || s.includes("avenue")) return "secondary";
  return "residential";
}

// ==========================================
// Route Scoring Engine
// ==========================================
function scoreRoute(
  route: RouteResult,
  trafficFactor: number,
  rushHour: RushHourProfile,
  weights: RouteWeights
): number {
  // Traffic score: duration adjusted for live congestion
  const trafficScore = (route.duration * trafficFactor) / 600;

  // Distance score: normalized to 10km baseline
  const distanceScore = route.distance / 10_000;

  // Road type score: distance-weighted average across all steps
  let roadTypeScore = 0;
  let totalDist = 0;
  for (const step of route.steps) {
    roadTypeScore += (ROAD_TYPE_SCORES[step.roadType] ?? 3) * step.distance;
    totalDist += step.distance;
  }
  roadTypeScore = totalDist > 0 ? roadTypeScore / totalDist : 3;

  // Rush hour penalty: 0–5 range
  const rushHourPenalty = rushHour.severity * 5;

  return Math.round(
    (weights.traffic * trafficScore +
      weights.distance * distanceScore +
      weights.roadType * roadTypeScore +
      weights.rushHour * rushHourPenalty) *
      1000
  ) / 1000;
}

// ==========================================
// OSRM Route Parser (shared)
// ==========================================
function parseOsrmRoute(
  osrmRoute: any,
  waypoints: any[],
  trafficFactor: number,
  rushHour: RushHourProfile,
  weights: RouteWeights
): RouteResult {
  const steps: RouteStep[] = osrmRoute.legs[0].steps.map((s: any) => ({
    instruction: s.maneuver?.type
      ? `${s.maneuver.type} ${s.maneuver.modifier || ""}`.trim()
      : "Continue",
    distance: s.distance,
    duration: Math.round(s.duration * trafficFactor),
    roadType: classifyRoadType(s.name || "", s.ref || ""),
  }));

  const route: RouteResult = {
    distance: osrmRoute.distance,
    duration: Math.round(osrmRoute.duration * trafficFactor),
    polyline: osrmRoute.geometry,
    trafficFactor,
    score: 0,
    waypoints: waypoints.map((wp: any) => ({
      lat: wp.location[1],
      lng: wp.location[0],
      name: wp.name || "",
    })),
    steps,
  };

  route.score = scoreRoute(route, trafficFactor, rushHour, weights);
  return route;
}

// ==========================================
// Core Route Calculation
// ==========================================
export async function calculateOptimalRoute(
  startLat: number, startLng: number,
  endLat: number, endLng: number,
  weights?: RouteWeights
): Promise<RouteResult | null> {
  try {
    const w = weights ?? await getAdaptiveWeights();
    const url = `${OSRM_BASE}/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=polyline&steps=true`;

    const data = await withRetry(
      async () => {
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        const json = await res.json();
        if (json.code !== "Ok" || !json.routes?.[0]) throw new Error("OSRM returned no routes");
        return json;
      },
      { maxAttempts: 2, baseDelayMs: 1000, label: "OSRM calculateOptimalRoute" },
    );

    const [trafficFactor, rushHour] = await Promise.all([
      getTrafficFactor(startLat, startLng, endLat, endLng),
      Promise.resolve(detectRushHour()),
    ]);

    return parseOsrmRoute(data.routes[0], data.waypoints, trafficFactor, rushHour, w);
  } catch (error) {
    console.error("[RouteOptimizer] Route calculation failed:", error);
    return null;
  }
}

// ==========================================
// Alternative Route Generator
// ==========================================
export async function generateAlternativeRoutes(
  startLat: number, startLng: number,
  endLat: number, endLng: number,
  weights?: RouteWeights
): Promise<ScoredRoute[]> {
  try {
    const w = weights ?? await getAdaptiveWeights();
    const url = `${OSRM_BASE}/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=polyline&steps=true&alternatives=3`;

    const data = await withRetry(
      async () => {
        const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
        const json = await res.json();
        if (json.code !== "Ok" || !json.routes) throw new Error("OSRM returned no alternatives");
        return json;
      },
      { maxAttempts: 2, baseDelayMs: 1000, label: "OSRM generateAlternativeRoutes" },
    );

    const [trafficFactor, rushHour] = await Promise.all([
      getTrafficFactor(startLat, startLng, endLat, endLng),
      Promise.resolve(detectRushHour()),
    ]);

    const scored: ScoredRoute[] = data.routes.map((r: any, i: number) => ({
      route: parseOsrmRoute(r, data.waypoints, trafficFactor, rushHour, w),
      label: i === 0 ? "fastest" : `alternative_${i}`,
      isRecommended: false,
    }));

    scored.sort((a, b) => a.route.score - b.route.score);
    if (scored.length > 0) {
      scored[0].isRecommended = true;
      scored[0].label = "recommended";
    }

    console.log(`[RouteOptimizer] ${scored.length} routes scored. Rush: ${rushHour.label}`);
    scored.forEach((s, i) =>
      console.log(
        `  ${i + 1}. [${s.label}] Score:${s.route.score} | ${Math.round(s.route.duration / 60)}m | ${(s.route.distance / 1000).toFixed(1)}km | Traffic:x${s.route.trafficFactor}`
      )
    );

    return scored;
  } catch (error) {
    console.error("[RouteOptimizer] Alternative route generation failed:", error);
    return [];
  }
}

// ==========================================
// Hospital Selection
// ==========================================
export async function selectBestHospital(
  lat: number,
  lng: number,
  emergencyType: string
): Promise<HospitalRanking[]> {
  const { data: hospitals, error } = await supabase
    .from("hospitals")
    .select("id, name, lat, lng, capacity_status, specialties");

  if (error || !hospitals) {
    console.error("[RouteOptimizer] Hospital query failed:", error);
    return [];
  }

  const rushHour = detectRushHour();
  const baseSpeed = rushHour.isRushHour ? 25 : 40; // km/h

  const rankings: HospitalRanking[] = hospitals
    .map((h) => {
      const dist = haversineDistance(lat, lng, h.lat || 0, h.lng || 0);
      const distanceScore = Math.min(10, dist);

      const capacityScore =
        h.capacity_status === "critical" ? 10 :
        h.capacity_status === "busy" ? 5 : 0;

      const specialties: string[] = h.specialties || [];
      const emergencyWord = emergencyType.split(" ")[0].toLowerCase();
      const specialtyScore = specialties.some(
        (s: string) =>
          emergencyType.toLowerCase().includes(s.toLowerCase()) ||
          s.toLowerCase().includes(emergencyWord)
      ) ? -3 : 0;

      const rushHourPenalty = rushHour.severity * dist * 0.2;

      const score =
        distanceScore * 0.40 +
        capacityScore * 0.25 +
        specialtyScore * 0.20 +
        rushHourPenalty * 0.15;

      return {
        id: h.id,
        name: h.name || "Hospital",
        distance: Math.round(dist * 100) / 100,
        status: h.capacity_status || "available",
        specialties,
        score: Math.round(score * 100) / 100,
        estimatedArrival: Math.round((dist / baseSpeed) * 3600),
        breakdown: {
          distanceScore: Math.round(distanceScore * 100) / 100,
          capacityScore,
          specialtyScore,
          rushHourPenalty: Math.round(rushHourPenalty * 100) / 100,
        },
      };
    })
    .filter((h) => h.status !== "critical")
    .sort((a, b) => a.score - b.score);

  console.log(`[RouteOptimizer] Ranked ${rankings.length} hospitals for "${emergencyType}" (${rushHour.label})`);
  rankings.slice(0, 3).forEach((h, i) =>
    console.log(`  ${i + 1}. ${h.name} — ${h.distance}km | Score:${h.score} | ETA:${Math.round(h.estimatedArrival / 60)}m | ${h.status}`)
  );

  return rankings;
}

// ==========================================
// Multi-Stop Mission Route (Driver → Pickup → Hospital)
// ==========================================
export async function calculateFullMissionRoute(
  driverLat: number, driverLng: number,
  pickupLat: number, pickupLng: number,
  hospitalLat: number, hospitalLng: number
): Promise<{ toPickup: RouteResult | null; toHospital: RouteResult | null; totalDuration: number }> {
  const weights = await getAdaptiveWeights();
  const [toPickup, toHospital] = await Promise.all([
    calculateOptimalRoute(driverLat, driverLng, pickupLat, pickupLng, weights),
    calculateOptimalRoute(pickupLat, pickupLng, hospitalLat, hospitalLng, weights),
  ]);

  return {
    toPickup,
    toHospital,
    totalDuration: (toPickup?.duration ?? 0) + (toHospital?.duration ?? 0),
  };
}

export type { RouteWeights as Weights };
