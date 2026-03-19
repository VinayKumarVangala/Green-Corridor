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
 * 1. Recent officer congestion reports (last 2 hours)
 * 2. Historical patterns for the current time-of-day and day-of-week
 */
export async function predictCongestion(junctionId: string): Promise<CongestionPrediction> {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  // 1. Get recent reports
  const { data: recentReports } = await supabase
    .from("congestion_reports")
    .select("level, reported_at")
    .eq("junction_id", junctionId)
    .gte("reported_at", twoHoursAgo)
    .order("reported_at", { ascending: false })
    .limit(10);

  if (!recentReports || recentReports.length === 0) {
    // No data — fall back to time-of-day heuristic
    return {
      junctionId,
      predicted: getTimeBasedDefault(),
      confidence: 0.3,
      basedOnReports: 0,
    };
  }

  // 2. Weighted average of recent reports (more recent = higher weight)
  const levelMap: Record<CongestionLevel, number> = { light: 1, moderate: 2, heavy: 3, gridlock: 4 };
  const reverseMap: Record<number, CongestionLevel> = { 1: "light", 2: "moderate", 3: "heavy", 4: "gridlock" };

  let weightedSum = 0;
  let totalWeight = 0;

  recentReports.forEach((report, index) => {
    const weight = recentReports.length - index; // Most recent gets highest weight
    const value = levelMap[report.level as CongestionLevel] || 2;
    weightedSum += value * weight;
    totalWeight += weight;
  });

  const avgLevel = Math.round(weightedSum / totalWeight);
  const predicted = reverseMap[Math.min(4, Math.max(1, avgLevel))] || "moderate";
  const confidence = Math.min(0.95, 0.5 + recentReports.length * 0.05);

  return {
    junctionId,
    predicted,
    confidence: Math.round(confidence * 100) / 100,
    basedOnReports: recentReports.length,
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
    .select("id, latitude, longitude");

  if (!junctions) return [];

  const { haversineDistance } = await import("./ambulanceDispatch");

  const affected = junctions.filter((j) =>
    routePoints.some(
      (p) => haversineDistance(p.lat, p.lng, j.latitude || 0, j.longitude || 0) <= proximityKm
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
