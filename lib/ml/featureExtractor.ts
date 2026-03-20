/**
 * Feature Extractor
 *
 * Converts raw incident_analytics rows into normalized numeric feature vectors.
 * All features are scaled to [0, 1] or small positive ranges so gradient descent
 * converges without exploding gradients.
 *
 * Response-time model features (10):
 *   hour_sin, hour_cos          — cyclic hour encoding
 *   is_weekend                  — 0/1
 *   is_rush_hour                — 0/1
 *   dispatch_attempts_norm      — attempts / 5 (capped)
 *   driver_distance_norm        — km / 20 (capped)
 *   hospital_busy               — 0/1 (busy or critical at arrival)
 *   route_changes_norm          — changes / 5 (capped)
 *   emergency_severity          — 0/1 (cardiac/trauma = 1)
 *   active_junctions_norm       — pending alerts / 10 (capped)
 *
 * Congestion model features (6):
 *   hour_sin, hour_cos
 *   is_weekend
 *   is_rush_hour
 *   lat_norm, lng_norm          — normalised to [0,1] within India bounding box
 */

export interface RawIncident {
  request_created_at: string | null;
  total_duration: number | null;          // seconds — label for response_time
  dispatch_duration: number | null;
  total_dispatch_attempts: number | null;
  route_changes_count: number | null;
  hospital_capacity_at_arrival: string | null;
  emergency_type: string | null;
  lat: number | null;
  lng: number | null;
  driver_distance_km: number | null;      // from ambulance_candidates[0]
  active_junction_alerts: number | null;  // count at time of request
}

export interface FeatureVector {
  features: number[];
  label: number;        // seconds (response_time) or congestion factor (0-1)
  featureNames: string[];
}

// ── Cyclic time encoding ──────────────────────────────────────────────────────
function hourEncoding(isoDate: string): { sin: number; cos: number } {
  const h = new Date(isoDate).getHours();
  return {
    sin: Math.sin((2 * Math.PI * h) / 24),
    cos: Math.cos((2 * Math.PI * h) / 24),
  };
}

function isWeekend(isoDate: string): number {
  const d = new Date(isoDate).getDay();
  return d === 0 || d === 6 ? 1 : 0;
}

function isRushHour(isoDate: string): number {
  const h = new Date(isoDate).getHours();
  return (h >= 7 && h <= 10) || (h >= 16 && h <= 20) ? 1 : 0;
}

const HIGH_SEVERITY_KEYWORDS = ["cardiac", "heart", "trauma", "accident", "stroke", "unconscious", "breathing"];

function emergencySeverity(type: string | null): number {
  if (!type) return 0;
  const t = type.toLowerCase();
  return HIGH_SEVERITY_KEYWORDS.some((k) => t.includes(k)) ? 1 : 0;
}

// India bounding box for lat/lng normalisation
const LAT_MIN = 8.0, LAT_MAX = 37.0;
const LNG_MIN = 68.0, LNG_MAX = 97.5;

function normLat(lat: number | null): number {
  if (lat == null) return 0.5;
  return Math.max(0, Math.min(1, (lat - LAT_MIN) / (LAT_MAX - LAT_MIN)));
}

function normLng(lng: number | null): number {
  if (lng == null) return 0.5;
  return Math.max(0, Math.min(1, (lng - LNG_MIN) / (LNG_MAX - LNG_MIN)));
}

// ── Response-time feature extraction ─────────────────────────────────────────
export const RESPONSE_TIME_FEATURE_NAMES = [
  "hour_sin", "hour_cos", "is_weekend", "is_rush_hour",
  "dispatch_attempts_norm", "driver_distance_norm",
  "hospital_busy", "route_changes_norm",
  "emergency_severity", "active_junctions_norm",
];

export function extractResponseTimeFeatures(row: RawIncident): number[] | null {
  if (!row.request_created_at || row.total_duration == null) return null;

  const { sin, cos } = hourEncoding(row.request_created_at);
  return [
    sin,
    cos,
    isWeekend(row.request_created_at),
    isRushHour(row.request_created_at),
    Math.min(1, (row.total_dispatch_attempts ?? 1) / 5),
    Math.min(1, (row.driver_distance_km ?? 2) / 20),
    (row.hospital_capacity_at_arrival === "busy" || row.hospital_capacity_at_arrival === "critical") ? 1 : 0,
    Math.min(1, (row.route_changes_count ?? 0) / 5),
    emergencySeverity(row.emergency_type),
    Math.min(1, (row.active_junction_alerts ?? 0) / 10),
  ];
}

// ── Congestion feature extraction ─────────────────────────────────────────────
export const CONGESTION_FEATURE_NAMES = [
  "hour_sin", "hour_cos", "is_weekend", "is_rush_hour",
  "lat_norm", "lng_norm",
];

export interface CongestionSample {
  timestamp: string;
  lat: number | null;
  lng: number | null;
  congestion_factor: number;   // label: actual traffic factor observed (1.0 – 2.5)
}

export function extractCongestionFeatures(row: CongestionSample): number[] | null {
  if (!row.timestamp) return null;
  const { sin, cos } = hourEncoding(row.timestamp);
  return [
    sin,
    cos,
    isWeekend(row.timestamp),
    isRushHour(row.timestamp),
    normLat(row.lat),
    normLng(row.lng),
  ];
}

// ── Dataset builder ───────────────────────────────────────────────────────────
export function buildResponseTimeDataset(rows: RawIncident[]): FeatureVector[] {
  const out: FeatureVector[] = [];
  for (const row of rows) {
    const features = extractResponseTimeFeatures(row);
    if (!features || row.total_duration == null) continue;
    out.push({ features, label: row.total_duration, featureNames: RESPONSE_TIME_FEATURE_NAMES });
  }
  return out;
}

export function buildCongestionDataset(rows: CongestionSample[]): FeatureVector[] {
  const out: FeatureVector[] = [];
  for (const row of rows) {
    const features = extractCongestionFeatures(row);
    if (!features) continue;
    // Normalise congestion factor to [0,1]: (factor - 1.0) / 1.5
    const label = Math.max(0, Math.min(1, (row.congestion_factor - 1.0) / 1.5));
    out.push({ features, label, featureNames: CONGESTION_FEATURE_NAMES });
  }
  return out;
}
