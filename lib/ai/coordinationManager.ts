import { createClient } from "@supabase/supabase-js";
import { haversineDistance } from "./ambulanceDispatch";
import type { RouteResult } from "./routeOptimizer";
import { enqueueJob } from "./jobProcessor";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-key";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ==========================================
// Priority System
// ==========================================
export type NotificationPriority = "P0" | "P1" | "P2";
// P0 — Critical: arrival < 5 min, requires immediate action
// P1 — Important: route changes, ETA updates > 2 min delta
// P2 — Informational: initial alerts, status updates

function getPriority(etaSeconds: number, isRouteChange = false): NotificationPriority {
  if (isRouteChange) return "P1";
  if (etaSeconds <= 300) return "P0";
  return "P2";
}

// ==========================================
// Notification Templates
// ==========================================
export const NotificationTemplates = {
  HOSPITAL_INBOUND:    "🚑 Ambulance {vehicle} arriving with {emergency} patient. ETA: {eta}",
  HOSPITAL_ETA_UPDATE: "🔄 ETA updated — Ambulance {vehicle} now arriving in {minutes} mins.",
  HOSPITAL_ESCALATION: "🚨 URGENT: Ambulance {vehicle} arriving in {minutes} mins. ER STANDBY REQUIRED.",
  HOSPITAL_ARRIVED:    "✅ Ambulance {vehicle} has arrived at the facility.",
  TRAFFIC_CLEAR:       "🚨 Clear junction {name} - Ambulance arriving in {minutes} mins",
  TRAFFIC_ROUTE_CHANGE:"⚠️ Route changed - Ambulance no longer passing junction {name}",
  CITIZEN_ASSIGNED:    "🚑 Ambulance assigned! ETA: {eta}",
  CITIZEN_ARRIVED:     "✅ Ambulance has arrived at your location.",
} as const;

export type TemplateName = keyof typeof NotificationTemplates;

interface TemplateData {
  vehicle?: string;
  emergency?: string;
  eta?: string;
  name?: string;
  minutes?: number;
}

export function fillTemplate(template: string, data: TemplateData): string {
  return template
    .replace("{vehicle}", data.vehicle ?? "")
    .replace("{emergency}", data.emergency ?? "")
    .replace("{eta}", data.eta ?? "")
    .replace("{name}", data.name ?? "")
    .replace("{minutes}", String(data.minutes ?? ""));
}

function formatETA(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

// ==========================================
// Hospital Coordination
// ==========================================

/**
 * Sends the initial inbound alert to a hospital and schedules
 * escalation jobs at 15-min, 5-min, and 2-min ETA milestones.
 * Deduplicates: if a pending notification already exists for this
 * assignment+hospital, updates ETA instead of inserting a duplicate.
 */
export async function notifyHospital(
  assignmentId: string,
  hospitalId: string,
  vehicleNumber: string,
  emergencyType: string,
  etaSeconds: number
): Promise<void> {
  const priority = getPriority(etaSeconds);
  const etaTimestamp = new Date(Date.now() + etaSeconds * 1000).toISOString();

  // Deduplication: check for existing notification
  const { data: existing } = await supabase
    .from("hospital_notifications")
    .select("id")
    .eq("assignment_id", assignmentId)
    .eq("hospital_id", hospitalId)
    .neq("status", "arrived")
    .maybeSingle();

  const payload = {
    assignment_id: assignmentId,
    hospital_id: hospitalId,
    patient_details: {
      vehicle_number: vehicleNumber,
      emergency_type: emergencyType,
      priority,
      message: fillTemplate(NotificationTemplates.HOSPITAL_INBOUND, {
        vehicle: vehicleNumber,
        emergency: emergencyType,
        eta: formatETA(etaSeconds),
      }),
    },
    eta: etaTimestamp,
    status: "pending" as const,
  };

  if (existing) {
    await supabase
      .from("hospital_notifications")
      .update({ eta: etaTimestamp, patient_details: payload.patient_details })
      .eq("id", existing.id);
  } else {
    await supabase.from("hospital_notifications").insert(payload);
  }

  // Schedule escalation alerts at 15m, 5m, 2m before arrival
  for (const mins of [15, 5, 2]) {
    const delayMs = (etaSeconds - mins * 60) * 1000;
    if (delayMs > 0) {
      enqueueJob(
        "HOSPITAL_ESCALATION",
        { assignmentId, hospitalId, vehicleNumber, minutes: mins },
        { delayMs }
      );
    }
  }

  console.log(`[Coordination] P${priority.slice(1)} Hospital notified: ${hospitalId} | ETA: ${formatETA(etaSeconds)}`);
}

/**
 * Updates the ETA on an existing hospital notification.
 * Only fires a new DB row if the delta is > 2 minutes (avoids noise).
 */
export async function updateHospitalEta(
  assignmentId: string,
  hospitalId: string,
  vehicleNumber: string,
  newEtaSeconds: number,
  oldEtaSeconds: number
): Promise<void> {
  const deltaSecs = Math.abs(newEtaSeconds - oldEtaSeconds);
  if (deltaSecs < 120) return; // < 2 min change — not worth notifying

  const priority = getPriority(newEtaSeconds, true); // P1 for ETA updates
  const etaTimestamp = new Date(Date.now() + newEtaSeconds * 1000).toISOString();
  const minutes = Math.round(newEtaSeconds / 60);

  // Update the ETA timestamp on the existing notification row
  await supabase
    .from("hospital_notifications")
    .update({ eta: etaTimestamp })
    .eq("assignment_id", assignmentId)
    .eq("hospital_id", hospitalId)
    .neq("status", "arrived");

  // Insert a new row so staff see the update in their notification feed
  await supabase.from("hospital_notifications").insert({
    assignment_id: assignmentId,
    hospital_id: hospitalId,
    patient_details: {
      vehicle_number: vehicleNumber,
      priority,
      message: fillTemplate(NotificationTemplates.HOSPITAL_ETA_UPDATE, {
        vehicle: vehicleNumber,
        minutes,
      }),
    },
    eta: etaTimestamp,
    status: "pending",
  });

  console.log(`[Coordination] ${priority} Hospital ETA updated: ${formatETA(newEtaSeconds)} (Δ${Math.round(deltaSecs / 60)}m)`);
}

/** Called by the scheduled HOSPITAL_ESCALATION job */
export async function sendHospitalEscalation(data: {
  assignmentId: string;
  hospitalId: string;
  vehicleNumber: string;
  minutes: number;
}): Promise<void> {
  const etaTimestamp = new Date(Date.now() + data.minutes * 60 * 1000).toISOString();

  await supabase.from("hospital_notifications").insert({
    assignment_id: data.assignmentId,
    hospital_id: data.hospitalId,
    patient_details: {
      vehicle_number: data.vehicleNumber,
      priority: "P0",
      message: fillTemplate(NotificationTemplates.HOSPITAL_ESCALATION, {
        vehicle: data.vehicleNumber,
        minutes: data.minutes,
      }),
    },
    eta: etaTimestamp,
    status: "preparing",
  });

  console.log(`[Coordination] P0 Hospital escalation: ${data.minutes}m warning sent to ${data.hospitalId}`);
}

/** Marks the hospital notification as arrived */
export async function markHospitalArrived(
  assignmentId: string,
  hospitalId: string,
  vehicleNumber: string
): Promise<void> {
  await supabase
    .from("hospital_notifications")
    .update({ status: "arrived" })
    .eq("assignment_id", assignmentId)
    .eq("hospital_id", hospitalId);

  console.log(`[Coordination] P0 Hospital arrival confirmed: ${vehicleNumber} → ${hospitalId}`);
}

// ==========================================
// Traffic Coordination
// ==========================================

/**
 * Detects all traffic junctions that lie on or near the given route,
 * creates junction_alert records with per-junction ETAs, and cancels
 * alerts for any junctions that were on the old route but not the new one.
 *
 * Junction detection uses a point-to-segment distance check against every
 * OSRM step segment, which handles curved roads far better than the
 * previous straight-line interpolation between start/end waypoints.
 *
 * @returns Array of junction IDs that received new alerts
 */
export async function notifyJunctions(
  assignmentId: string,
  vehicleNumber: string,
  emergencyType: string,
  route: RouteResult | null,
  oldJunctionIds: string[] = []
): Promise<string[]> {
  const { data: junctions } = await supabase
    .from("traffic_junctions")
    .select("id, name, lat, lng");

  if (!junctions || junctions.length === 0) return [];

  const newJunctionIds: string[] = [];

  if (route && route.waypoints.length >= 2) {
    // Build a list of route segments from consecutive waypoints
    const segments: Array<{ aLat: number; aLng: number; bLat: number; bLng: number; cumulativeDuration: number }> = [];
    let cumulativeDuration = 0;

    for (let i = 0; i < route.waypoints.length - 1; i++) {
      const a = route.waypoints[i];
      const b = route.waypoints[i + 1];
      const segDist = haversineDistance(a.lat, a.lng, b.lat, b.lng);
      // Estimate segment duration proportional to its share of total distance
      const totalDist = route.distance / 1000; // km
      const segDuration = totalDist > 0 ? (segDist / totalDist) * route.duration : 0;

      segments.push({
        aLat: a.lat, aLng: a.lng,
        bLat: b.lat, bLng: b.lng,
        cumulativeDuration,
      });
      cumulativeDuration += segDuration;
    }

    const PROXIMITY_KM = 0.5; // junction must be within 500m of a route segment

    for (const j of junctions) {
      const jLat = j.lat || 0;
      const jLng = j.lng || 0;

      // Find the closest segment and its cumulative ETA
      let minDist = Infinity;
      let etaAtJunction = 0;

      for (const seg of segments) {
        const d = pointToSegmentDistance(jLat, jLng, seg.aLat, seg.aLng, seg.bLat, seg.bLng);
        if (d < minDist) {
          minDist = d;
          // ETA = time to reach the start of this segment + fraction along it
          const segLen = haversineDistance(seg.aLat, seg.aLng, seg.bLat, seg.bLng);
          const projFraction = segLen > 0
            ? Math.min(1, haversineDistance(seg.aLat, seg.aLng, jLat, jLng) / segLen)
            : 0;
          const totalDist = route.distance / 1000;
          const segDuration = totalDist > 0
            ? (segLen / totalDist) * route.duration
            : 0;
          etaAtJunction = seg.cumulativeDuration + projFraction * segDuration;
        }
      }

      if (minDist > PROXIMITY_KM) continue;

      newJunctionIds.push(j.id);
      const priority = getPriority(etaAtJunction);
      const minutes = Math.floor(etaAtJunction / 60);
      const expectedArrival = new Date(Date.now() + etaAtJunction * 1000).toISOString();

      // Upsert: avoid duplicate alerts for same assignment+junction
      const { data: existingAlert } = await supabase
        .from("junction_alerts")
        .select("id")
        .eq("assignment_id", assignmentId)
        .eq("junction_id", j.id)
        .eq("status", "pending")
        .maybeSingle();

      if (existingAlert) {
        await supabase
          .from("junction_alerts")
          .update({ expected_arrival: expectedArrival })
          .eq("id", existingAlert.id);
      } else {
        await supabase.from("junction_alerts").insert({
          assignment_id: assignmentId,
          junction_id: j.id,
          expected_arrival: expectedArrival,
          status: "pending",
        });
      }

      if (priority === "P0") {
        console.log(
          `[Coordination] P0 Traffic: ${fillTemplate(NotificationTemplates.TRAFFIC_CLEAR, {
            name: j.name || j.id,
            minutes,
          })}`
        );
      }
    }
  }

  // Cancel alerts for junctions on the old route that are NOT on the new route
  const removedIds = oldJunctionIds.filter((id) => !newJunctionIds.includes(id));
  if (removedIds.length > 0) {
    await supabase
      .from("junction_alerts")
      .update({ status: "cancelled" })
      .eq("assignment_id", assignmentId)
      .eq("status", "pending")
      .in("junction_id", removedIds);

    // Log P1 route-change alerts for removed junctions
    const removedJunctions = junctions.filter((j) => removedIds.includes(j.id));
    for (const j of removedJunctions) {
      console.log(
        `[Coordination] P1 Traffic: ${fillTemplate(NotificationTemplates.TRAFFIC_ROUTE_CHANGE, {
          name: j.name || j.id,
        })}`
      );
    }
  }

  console.log(
    `[Coordination] Junctions: ${newJunctionIds.length} alerted, ${removedIds.length} cancelled`
  );
  return newJunctionIds;
}

// ==========================================
// Citizen Coordination
// ==========================================

/**
 * Updates the emergency_request status to 'assigned' so the citizen's
 * tracking page (which polls /api/emergency/status) reflects the assignment.
 */
export async function notifyCitizenAssigned(
  requestId: string,
  etaSeconds: number,
  vehicleNumber: string
): Promise<void> {
  await supabase
    .from("emergency_requests")
    .update({ status: "assigned" })
    .eq("id", requestId);

  const message = fillTemplate(NotificationTemplates.CITIZEN_ASSIGNED, {
    eta: formatETA(etaSeconds),
  });
  console.log(`[Coordination] P2 Citizen (${requestId}): ${message} | Vehicle: ${vehicleNumber}`);
}

/**
 * Updates the emergency_request status to 'arrived' so the citizen's
 * tracking page shows the ambulance has reached them.
 */
export async function notifyCitizenArrived(requestId: string): Promise<void> {
  await supabase
    .from("emergency_requests")
    .update({ status: "arrived" })
    .eq("id", requestId);

  console.log(`[Coordination] P0 Citizen (${requestId}): ${NotificationTemplates.CITIZEN_ARRIVED}`);
}

// ==========================================
// Orchestrator: Notify All Stakeholders
// ==========================================

export interface AssignmentContext {
  assignmentId: string;
  requestId: string;
  hospitalId?: string;
  vehicleNumber: string;
  emergencyType: string;
  etaToPickup: number;   // seconds
  etaToHospital: number; // seconds
  route?: RouteResult | null;
}

export async function notifyAllStakeholders(
  ctx: AssignmentContext,
  oldJunctionIds: string[] = []
): Promise<{ notified: number; errors: number; junctionIds: string[] }> {
  let notified = 0;
  let errors = 0;
  let junctionIds: string[] = [];

  // 1. Hospital
  if (ctx.hospitalId) {
    try {
      await notifyHospital(
        ctx.assignmentId,
        ctx.hospitalId,
        ctx.vehicleNumber,
        ctx.emergencyType,
        ctx.etaToHospital
      );
      notified++;
    } catch (e) {
      console.error("[Coordination] Hospital notify failed:", e);
      errors++;
    }
  }

  // 2. Traffic junctions
  if (ctx.route) {
    try {
      junctionIds = await notifyJunctions(
        ctx.assignmentId,
        ctx.vehicleNumber,
        ctx.emergencyType,
        ctx.route,
        oldJunctionIds
      );
      notified += junctionIds.length;
    } catch (e) {
      console.error("[Coordination] Junction notify failed:", e);
      errors++;
    }
  }

  // 3. Citizen
  try {
    await notifyCitizenAssigned(ctx.requestId, ctx.etaToPickup, ctx.vehicleNumber);
    notified++;
  } catch (e) {
    console.error("[Coordination] Citizen notify failed:", e);
    errors++;
  }

  return { notified, errors, junctionIds };
}

// ==========================================
// Geometry Helper: Point-to-Segment Distance
// ==========================================

/**
 * Returns the minimum distance (km) from point P to line segment AB.
 * Uses Haversine for accuracy on geographic coordinates.
 */
function pointToSegmentDistance(
  pLat: number, pLng: number,
  aLat: number, aLng: number,
  bLat: number, bLng: number
): number {
  const ab = haversineDistance(aLat, aLng, bLat, bLng);
  if (ab === 0) return haversineDistance(pLat, pLng, aLat, aLng);

  // Project P onto AB using dot product in flat-earth approximation (fine for <50km)
  const t = Math.max(0, Math.min(1,
    ((pLat - aLat) * (bLat - aLat) + (pLng - aLng) * (bLng - aLng)) /
    ((bLat - aLat) ** 2 + (bLng - aLng) ** 2)
  ));

  const closestLat = aLat + t * (bLat - aLat);
  const closestLng = aLng + t * (bLng - aLng);
  return haversineDistance(pLat, pLng, closestLat, closestLng);
}
