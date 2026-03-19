import { createClient } from "@supabase/supabase-js";
import { haversineDistance } from "./ambulanceDispatch";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-key";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const OSRM_BASE = "https://router.project-osrm.org";

// ==========================================
// Types & Interfaces
// ==========================================
export interface RouteResult {
  distance: number;       // meters
  duration: number;       // seconds
  polyline: string;       // encoded polyline
  score: number;          // composite route score (lower = better)
  trafficFactor: number;  // multiplier applied for traffic
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
  label: string;         // "fastest", "shortest", "alternative"
  isRecommended: boolean;
}

export type RoadType = "highway" | "main" | "secondary" | "residential" | "service";

// ==========================================
// Configurable Scoring Weights
// ==========================================
export interface RouteWeights {
  traffic: number;    // Default: 0.40
  distance: number;   // Default: 0.30
  roadType: number;   // Default: 0.20
  rushHour: number;   // Default: 0.10
}

const DEFAULT_WEIGHTS: RouteWeights = {
  traffic: 0.40,
  distance: 0.30,
  roadType: 0.20,
  rushHour: 0.10,
};

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
interface RushHourProfile {
  isRushHour: boolean;
  severity: number;    // 0-1 (0 = no rush, 1 = gridlock)
  label: string;
}

function detectRushHour(): RushHourProfile {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0 = Sunday

  // Weekend
  if (day === 0 || day === 6) {
    return { isRushHour: false, severity: 0.1, label: "Weekend — light traffic expected" };
  }

  // Morning Rush: 8:00 – 10:00
  if (hour >= 8 && hour <= 9) {
    return { isRushHour: true, severity: 0.8, label: "Morning Rush — heavy congestion" };
  }
  // Evening Rush: 17:00 – 20:00
  if (hour >= 17 && hour <= 19) {
    return { isRushHour: true, severity: 0.9, label: "Evening Rush — peak congestion" };
  }
  // Shoulder Hours
  if ((hour >= 7 && hour <= 10) || (hour >= 16 && hour <= 20)) {
    return { isRushHour: true, severity: 0.5, label: "Shoulder Hours — moderate congestion" };
  }
  // Night
  if (hour >= 22 || hour <= 5) {
    return { isRushHour: false, severity: 0.05, label: "Night — minimal traffic" };
  }

  return { isRushHour: false, severity: 0.2, label: "Off-Peak — normal traffic" };
}

// ==========================================
// Traffic Factor from Junction Data
// ==========================================
async function getTrafficFactor(
  startLat: number, startLng: number,
  endLat: number, endLng: number
): Promise<number> {
  try {
    // Sample mid-point for nearby junction congestion
    const midLat = (startLat + endLat) / 2;
    const midLng = (startLng + endLng) / 2;

    const { data: junctions } = await supabase
      .from("traffic_junctions")
      .select("current_congestion, latitude, longitude");

    if (!junctions || junctions.length === 0) return 1.0;

    // Find junctions within 2km of the midpoint
    const nearby = junctions.filter(
      (j) => haversineDistance(midLat, midLng, j.latitude || 0, j.longitude || 0) <= 2
    );

    if (nearby.length === 0) return 1.0;

    const congestionMap: Record<string, number> = {
      light: 1.0, moderate: 1.3, heavy: 1.7, gridlock: 2.5,
    };

    const avgFactor =
      nearby.reduce((sum, j) => sum + (congestionMap[j.current_congestion] || 1.0), 0) /
      nearby.length;

    return Math.round(avgFactor * 100) / 100;
  } catch {
    return 1.0;
  }
}

// ==========================================
// Road Type Classification from OSRM Steps
// ==========================================
function classifyRoadType(stepName: string, stepRef: string): RoadType {
  const combined = `${stepName} ${stepRef}`.toLowerCase();
  if (combined.includes("highway") || combined.includes("nh") || combined.includes("expressway")) return "highway";
  if (combined.includes("main") || combined.includes("national") || combined.includes("state")) return "main";
  if (combined.includes("service") || combined.includes("lane")) return "service";
  if (combined.includes("street") || combined.includes("road") || combined.includes("marg")) return "secondary";
  return "residential";
}

// ==========================================
// Route Scoring Engine
// ==========================================
function scoreRoute(
  route: RouteResult,
  trafficFactor: number,
  rushHour: RushHourProfile,
  weights: RouteWeights = DEFAULT_WEIGHTS
): number {
  // 1. Traffic Score (normalized duration with traffic factor)
  const trafficScore = (route.duration * trafficFactor) / 600; // Normalize to ~10km journey

  // 2. Distance Score (normalized)
  const distanceScore = route.distance / 10000; // Normalize to 10km

  // 3. Road Type Score (average of all steps, weighted by step distance)
  let roadTypeScore = 0;
  let totalStepDist = 0;
  for (const step of route.steps) {
    const typeScore = ROAD_TYPE_SCORES[step.roadType] || 3;
    roadTypeScore += typeScore * step.distance;
    totalStepDist += step.distance;
  }
  roadTypeScore = totalStepDist > 0 ? roadTypeScore / totalStepDist : 3;

  // 4. Rush Hour Penalty
  const rushHourPenalty = rushHour.severity * 5; // 0-5 range

  // Composite Score
  const score =
    weights.traffic * trafficScore +
    weights.distance * distanceScore +
    weights.roadType * roadTypeScore +
    weights.rushHour * rushHourPenalty;

  return Math.round(score * 1000) / 1000;
}

// ==========================================
// Core Route Calculation (Enhanced)
// ==========================================
export async function calculateOptimalRoute(
  startLat: number, startLng: number,
  endLat: number, endLng: number,
  weights: RouteWeights = DEFAULT_WEIGHTS
): Promise<RouteResult | null> {
  try {
    const url = `${OSRM_BASE}/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=polyline&steps=true&annotations=true`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.code !== "Ok" || !data.routes?.[0]) return null;

    const osrmRoute = data.routes[0];
    const leg = osrmRoute.legs[0];

    // Get live traffic factor
    const trafficFactor = await getTrafficFactor(startLat, startLng, endLat, endLng);
    const rushHour = detectRushHour();

    const steps: RouteStep[] = leg.steps.map((s: any) => ({
      instruction: s.maneuver?.type
        ? `${s.maneuver.type} ${s.maneuver.modifier || ""}`.trim()
        : "Continue",
      distance: s.distance,
      duration: s.duration * trafficFactor, // Apply traffic factor to step durations
      roadType: classifyRoadType(s.name || "", s.ref || ""),
    }));

    const route: RouteResult = {
      distance: osrmRoute.distance,
      duration: Math.round(osrmRoute.duration * trafficFactor),
      polyline: osrmRoute.geometry,
      trafficFactor,
      score: 0,
      waypoints: data.waypoints.map((wp: any) => ({
        lat: wp.location[1],
        lng: wp.location[0],
        name: wp.name || "",
      })),
      steps,
    };

    route.score = scoreRoute(route, trafficFactor, rushHour, weights);

    return route;
  } catch (error) {
    console.error("[RouteOptimizer] OSRM route calculation failed:", error);
    return null;
  }
}

// ==========================================
// Alternative Route Generator
// ==========================================
export async function generateAlternativeRoutes(
  startLat: number, startLng: number,
  endLat: number, endLng: number,
  weights: RouteWeights = DEFAULT_WEIGHTS
): Promise<ScoredRoute[]> {
  try {
    const url = `${OSRM_BASE}/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=polyline&steps=true&alternatives=3`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.code !== "Ok" || !data.routes) return [];

    const trafficFactor = await getTrafficFactor(startLat, startLng, endLat, endLng);
    const rushHour = detectRushHour();

    const scored: ScoredRoute[] = data.routes.map((osrmRoute: any, index: number) => {
      const leg = osrmRoute.legs[0];
      const steps: RouteStep[] = leg.steps.map((s: any) => ({
        instruction: s.maneuver?.type
          ? `${s.maneuver.type} ${s.maneuver.modifier || ""}`.trim()
          : "Continue",
        distance: s.distance,
        duration: s.duration * trafficFactor,
        roadType: classifyRoadType(s.name || "", s.ref || ""),
      }));

      const route: RouteResult = {
        distance: osrmRoute.distance,
        duration: Math.round(osrmRoute.duration * trafficFactor),
        polyline: osrmRoute.geometry,
        trafficFactor,
        score: 0,
        waypoints: data.waypoints.map((wp: any) => ({
          lat: wp.location[1],
          lng: wp.location[0],
          name: wp.name || "",
        })),
        steps,
      };

      route.score = scoreRoute(route, trafficFactor, rushHour, weights);

      return {
        route,
        label: index === 0 ? "fastest" : `alternative_${index}`,
        isRecommended: false,
      };
    });

    // Sort by score and mark the best as recommended
    scored.sort((a, b) => a.route.score - b.route.score);
    if (scored.length > 0) {
      scored[0].isRecommended = true;
      scored[0].label = "recommended";
    }

    console.log(`[RouteOptimizer] Generated ${scored.length} routes. Rush: ${rushHour.label}`);
    scored.forEach((s, i) => {
      console.log(`  ${i + 1}. [${s.label}] Score: ${s.route.score} | ${Math.round(s.route.duration / 60)}m | ${(s.route.distance / 1000).toFixed(1)}km | Traffic: x${s.route.trafficFactor}`);
    });

    return scored;
  } catch (error) {
    console.error("[RouteOptimizer] Alternative route generation failed:", error);
    return [];
  }
}

// ==========================================
// Hospital Selection (Enhanced)
// ==========================================
export async function selectBestHospital(
  lat: number,
  lng: number,
  emergencyType: string
): Promise<HospitalRanking[]> {
  const { data: hospitals, error } = await supabase
    .from("hospitals")
    .select("*");

  if (error || !hospitals) {
    console.error("[RouteOptimizer] Hospital query failed:", error);
    return [];
  }

  const rushHour = detectRushHour();

  const rankings: HospitalRanking[] = hospitals
    .map((h) => {
      const dist = haversineDistance(lat, lng, h.latitude || 0, h.longitude || 0);

      // 1. Distance Score (0-10, lower is better)
      const distanceScore = Math.min(10, dist);

      // 2. Capacity Score
      // critical = excluded (filtered below), busy = penalty, available = bonus
      let capacityScore = 0;
      if (h.status === "critical") capacityScore = 10; // Will filter out
      else if (h.status === "busy") capacityScore = 5;
      else capacityScore = 0;

      // 3. Specialty Score (negative = bonus)
      const specialties: string[] = h.specialties || [];
      const specialtyScore = specialties.some((s: string) =>
        emergencyType.toLowerCase().includes(s.toLowerCase()) ||
        s.toLowerCase().includes(emergencyType.split(" ")[0].toLowerCase())
      ) ? -3 : 0;

      // 4. Rush Hour Penalty
      // During rush hour, farther hospitals are penalized more
      const rushHourPenalty = rushHour.severity * dist * 0.2;

      // Composite Score
      const score =
        distanceScore * 0.40 +
        capacityScore * 0.25 +
        specialtyScore * 0.20 +
        rushHourPenalty * 0.15;

      // Estimate arrival with rush hour factor
      const baseSpeed = rushHour.isRushHour ? 25 : 40; // km/h
      const estimatedArrival = Math.round((dist / baseSpeed) * 3600);

      return {
        id: h.id,
        name: h.name || "Hospital",
        distance: Math.round(dist * 100) / 100,
        status: h.status || "available",
        specialties,
        score: Math.round(score * 100) / 100,
        estimatedArrival,
        breakdown: {
          distanceScore: Math.round(distanceScore * 100) / 100,
          capacityScore,
          specialtyScore,
          rushHourPenalty: Math.round(rushHourPenalty * 100) / 100,
        },
      };
    })
    .filter((h) => h.status !== "critical") // Exclude overloaded hospitals
    .sort((a, b) => a.score - b.score);

  console.log(`[RouteOptimizer] Ranked ${rankings.length} hospitals for "${emergencyType}" (${rushHour.label})`);
  rankings.slice(0, 3).forEach((h, i) => {
    console.log(`  ${i + 1}. ${h.name} — ${h.distance}km | Score: ${h.score} | ETA: ${Math.round(h.estimatedArrival / 60)}m | Status: ${h.status}`);
  });

  return rankings;
}

// ==========================================
// Multi-Stop Route (Pickup → Hospital)
// ==========================================
export async function calculateFullMissionRoute(
  driverLat: number, driverLng: number,
  pickupLat: number, pickupLng: number,
  hospitalLat: number, hospitalLng: number
): Promise<{ toPickup: RouteResult | null; toHospital: RouteResult | null; totalDuration: number }> {
  const [toPickup, toHospital] = await Promise.all([
    calculateOptimalRoute(driverLat, driverLng, pickupLat, pickupLng),
    calculateOptimalRoute(pickupLat, pickupLng, hospitalLat, hospitalLng),
  ]);

  const totalDuration = (toPickup?.duration || 0) + (toHospital?.duration || 0);

  return { toPickup, toHospital, totalDuration };
}

// ==========================================
// Exports for Engine
// ==========================================
export { detectRushHour, getTrafficFactor, DEFAULT_WEIGHTS };
export type { RushHourProfile, RouteWeights as Weights };
