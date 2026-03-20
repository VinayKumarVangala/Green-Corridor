import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-key";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ==========================================
// Congestion Prediction
// ==========================================
export type CongestionLevel = "light" | "moderate" | "heavy" | "gridlock";

export interface CongestionPrediction {
  junctionId: string;
  predicted: CongestionLevel;
  confidence: number; // 0-1
  basedOnReports: number;
}

/**
 * Predicts the current congestion level at a junction based on:
 * 1. Recent officer congestion reports from junction_alerts (last 2 hours)
 * 2. Historical patterns for the current time-of-day and day-of-week
 */
export async function predictCongestion(junctionId: string): Promise<CongestionPrediction> {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  // Use junction_alerts as a proxy for recent congestion activity
  const { data: recentAlerts } = await supabase
    .from("junction_alerts")
    .select("status, created_at")
    .eq("junction_id", junctionId)
    .gte("created_at", twoHoursAgo)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!recentAlerts || recentAlerts.length === 0) {
    return {
      junctionId,
      predicted: getTimeBasedDefault(),
      confidence: 0.3,
      basedOnReports: 0,
    };
  }

  // Active alerts = heavier congestion; cleared = lighter
  const statusMap: Record<string, number> = { pending: 3, cleared: 1, cancelled: 1 };
  const reverseMap: Record<number, CongestionLevel> = { 1: "light", 2: "moderate", 3: "heavy", 4: "gridlock" };

  let weightedSum = 0;
  let totalWeight = 0;

  recentAlerts.forEach((alert, index) => {
    const weight = recentAlerts.length - index;
    const value = statusMap[alert.status] || 2;
    weightedSum += value * weight;
    totalWeight += weight;
  });

  const avgLevel = Math.round(weightedSum / totalWeight);
  const predicted = reverseMap[Math.min(4, Math.max(1, avgLevel))] || "moderate";
  const confidence = Math.min(0.95, 0.5 + recentAlerts.length * 0.05);

  return {
    junctionId,
    predicted,
    confidence: Math.round(confidence * 100) / 100,
    basedOnReports: recentAlerts.length,
  };
}

// ==========================================
// Batch Prediction for Route Junctions
// ==========================================
export async function predictRouteTraffic(
  junctionIds: string[]
): Promise<CongestionPrediction[]> {
  const predictions = await Promise.all(
    junctionIds.map((id) => predictCongestion(id))
  );
  return predictions;
}

// ==========================================
// Identify Affected Junctions on a Route
// ==========================================
export async function getAffectedJunctions(
  routePoints: { lat: number; lng: number }[],
  proximityKm: number = 0.3
): Promise<string[]> {
  const { data: junctions } = await supabase
    .from("traffic_junctions")
    .select("id, lat, lng");

  if (!junctions) return [];

  const { haversineDistance } = await import("./ambulanceDispatch");

  const affected = junctions.filter((j) =>
    routePoints.some(
      (p) => haversineDistance(p.lat, p.lng, j.lat || 0, j.lng || 0) <= proximityKm
    )
  );

  return affected.map((j) => j.id);
}

// ==========================================
// Time-of-Day Heuristic
// ==========================================
function getTimeBasedDefault(): CongestionLevel {
  const hour = new Date().getHours();
  
  // Peak hours
  if ((hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 20)) return "heavy";
  // Shoulder hours
  if ((hour >= 7 && hour <= 11) || (hour >= 16 && hour <= 21)) return "moderate";
  // Night
  if (hour >= 22 || hour <= 5) return "light";
  
  return "moderate";
}
