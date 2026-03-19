import { createClient } from "@supabase/supabase-js";
import { haversineDistance } from "./ambulanceDispatch";
import type { RouteResult } from "./routeOptimizer";
import { enqueueJob } from "./jobProcessor";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-key";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ==========================================
// Priorities & Templates
// ==========================================
export type NotificationPriority = "P0" | "P1" | "P2"; // P0: <5 mins, P1: important updates, P2: info
export type StakeholderType = "hospital" | "traffic_junction" | "citizen" | "supervisor";

export interface NotificationTemplateData {
  vehicle?: string;
  emergency?: string;
  eta?: string;
  name?: string;
  minutes?: number;
}

export const NotificationTemplates = {
  HOSPITAL_INBOUND: "🚑 Ambulance {vehicle} arriving with {emergency} patient. ETA: {eta}",
  HOSPITAL_ESCALATION: "🚨 URGENT: Ambulance {vehicle} arriving in {minutes} mins. ER STANDBY REQUIRED.",
  HOSPITAL_ARRIVED: "✅ Ambulance {vehicle} has arrived at the facility.",
  TRAFFIC_CLEAR: "🚨 Clear junction {name} - Ambulance arriving in {minutes} mins",
  TRAFFIC_ROUTE_CHANGE: "⚠️ Route changed - Ambulance no longer passing junction {name}",
  CITIZEN_ASSIGNED: "🚑 Ambulance assigned! ETA: {eta}",
  CITIZEN_ARRIVED: "✅ Ambulance has arrived at your location.",
};

export function fillTemplate(template: string, data: NotificationTemplateData): string {
  let result = template;
  if (data.vehicle) result = result.replace("{vehicle}", data.vehicle);
  if (data.emergency) result = result.replace("{emergency}", data.emergency);
  if (data.eta) result = result.replace("{eta}", data.eta);
  if (data.name) result = result.replace("{name}", data.name);
  if (data.minutes !== undefined) result = result.replace("{minutes}", data.minutes.toString());
  return result;
}

function getPriority(etaSeconds: number, isRouteChange = false): NotificationPriority {
  if (isRouteChange) return "P1";
  if (etaSeconds <= 300) return "P0"; // < 5 mins
  return "P2";
}

function formatETA(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

// ==========================================
// Hospital Coordination
// ==========================================
export async function notifyHospital(
  assignmentId: string,
  hospitalId: string,
  vehicleNumber: string,
  emergencyType: string,
  etaSeconds: number
): Promise<void> {
  const priority = getPriority(etaSeconds);
  const message = fillTemplate(NotificationTemplates.HOSPITAL_INBOUND, {
    vehicle: vehicleNumber,
    emergency: emergencyType,
    eta: formatETA(etaSeconds)
  });

  await supabase.from("hospital_notifications").insert({
    hospital_id: hospitalId,
    assignment_id: assignmentId,
    message,
    priority: priority === "P0" ? "critical" : "high", // mapping to old roles for compatibility
    status: "active",
    created_at: new Date().toISOString()
  });

  // Schedule escalation alerts (15min, 5min, 2min)
  [15, 5, 2].forEach(mins => {
    const triggerInSeconds = etaSeconds - (mins * 60);
    if (triggerInSeconds > 0) {
      enqueueJob("HOSPITAL_ESCALATION", {
        assignmentId,
        hospitalId,
        vehicleNumber,
        minutes: mins
      }, { delayMs: triggerInSeconds * 1000 });
    }
  });
}

// Handler for the scheduled hospital escalation job
export async function sendHospitalEscalation(data: any): Promise<void> {
  const message = fillTemplate(NotificationTemplates.HOSPITAL_ESCALATION, {
    vehicle: data.vehicleNumber,
    minutes: data.minutes
  });
  
  await supabase.from("hospital_notifications").insert({
    hospital_id: data.hospitalId,
    assignment_id: data.assignmentId,
    message,
    priority: "critical", // P0
    status: "active",
    created_at: new Date().toISOString()
  });
}

export async function markHospitalArrived(
  assignmentId: string,
  hospitalId: string,
  vehicleNumber: string
): Promise<void> {
  const message = fillTemplate(NotificationTemplates.HOSPITAL_ARRIVED, { vehicle: vehicleNumber });
  await supabase.from("hospital_notifications").insert({
    hospital_id: hospitalId,
    assignment_id: assignmentId,
    message,
    priority: "medium", // P2
    status: "active",
    created_at: new Date().toISOString()
  });
}

// ==========================================
// Traffic Coordination
// ==========================================
export async function notifyJunctions(
  assignmentId: string,
  vehicleNumber: string,
  emergencyType: string,
  route: RouteResult | null,
  oldJunctionIds: string[] = [] // if route change, pass previous junctions here to cancel them
): Promise<string[]> {
  const { data: junctions } = await supabase.from("traffic_junctions").select("*");
  if (!junctions || junctions.length === 0) return [];

  const newJunctionIds: string[] = [];

  // Identify new junctions and per-junction ETA
  if (route && route.waypoints && route.waypoints.length > 0) {
    const startPt = route.waypoints[0];
    const endPt = route.waypoints[route.waypoints.length - 1];
    const totalDist = haversineDistance(startPt.lat, startPt.lng, endPt.lat, endPt.lng);

    for (const j of junctions) {
      const jLat = j.latitude || 0;
      const jLng = j.longitude || 0;
      
      const distToStart = haversineDistance(startPt.lat, startPt.lng, jLat, jLng);
      const distToEnd = haversineDistance(jLat, jLng, endPt.lat, endPt.lng);

      // Simple interpolation: if junction is roughly on the path
      if (distToStart + distToEnd <= totalDist * 1.2 && distToStart <= totalDist) {
        newJunctionIds.push(j.id);
        
        const progressFraction = totalDist > 0 ? (distToStart / totalDist) : 0;
        const expectedEtaSeconds = Math.round(route.duration * progressFraction);
        const minutes = Math.floor(expectedEtaSeconds / 60);

        const priority = getPriority(expectedEtaSeconds);
        const message = fillTemplate(NotificationTemplates.TRAFFIC_CLEAR, {
          name: j.name || `Junction ${j.id}`,
          minutes
        });

        // Insert junction strategy / alerts based on ETA
        let strategy = "Strategic Clearance";
        if (expectedEtaSeconds <= 60) strategy = "CLEAR ALL LANES NOW — AMBULANCE IMMINENT";
        else if (expectedEtaSeconds <= 120) strategy = "STOP CROSS TRAFFIC — AMBULANCE ARRIVING IN 2 MINUTES";
        else if (expectedEtaSeconds <= 180) strategy = "PREPARE TO CLEAR — AMBULANCE APPROACHING IN 3 MINUTES";
        else if (expectedEtaSeconds <= 300) strategy = "STANDBY — AMBULANCE EN ROUTE, ETA 5 MINUTES";
        else strategy = "MONITOR — AMBULANCE DETECTED ON ROUTE";

        await supabase.from("junction_alerts").insert({
          junction_id: j.id,
          ambulance_id: assignmentId,
          vehicle_number: vehicleNumber,
          eta: expectedEtaSeconds,
          emergency_type: emergencyType,
          direction: "auto-calculated",
          strategy,
          status: "active",
          created_at: new Date().toISOString()
        });
        
        // Output P0 trace visually in console
        if (priority === "P0") {
          console.log(`[P0 Traffic Alert] ${message}`);
        }
      }
    }
  }

  // Handle Route Changes: cancel old ones not in new list
  const removedJunctions = oldJunctionIds.filter(id => !newJunctionIds.includes(id));
  for (const jId of removedJunctions) {
    const j = junctions.find(x => x.id === jId);
    if (!j) continue;
    
    // Mark old alerts as cancelled
    await supabase.from("junction_alerts")
      .update({ status: "cancelled", route_changed: true, cancelled_at: new Date().toISOString() })
      .eq("junction_id", jId)
      .eq("ambulance_id", assignmentId)
      .eq("status", "active");

    const msg = fillTemplate(NotificationTemplates.TRAFFIC_ROUTE_CHANGE, { name: j.name || `Junction ${jId}` });
    console.log(`[P1 Traffic Alert] ${msg}`);
  }

  return newJunctionIds;
}

// ==========================================
// Citizen Coordination
// ==========================================
export async function notifyCitizenAssigned(
  citizenId: string,
  requestId: string,
  etaSeconds: number
): Promise<void> {
  const message = fillTemplate(NotificationTemplates.CITIZEN_ASSIGNED, { eta: formatETA(etaSeconds) });
  console.log(`[Citizen Notification] P2: ${message}`);
}

export async function notifyCitizenArrived(
  citizenId: string,
  requestId: string
): Promise<void> {
  const message = fillTemplate(NotificationTemplates.CITIZEN_ARRIVED, {});
  console.log(`[Citizen Notification] P0: ${message}`);
}

// ==========================================
// Backwards Compatibility / Orchestrator API
// ==========================================
export async function notifyAllStakeholders(
  assignment: any,
  junctionIds: string[] = [] 
): Promise<{ notified: number; errors: number }> {
  let notified = 0;
  let errors = 0;

  try {
    if (assignment.hospital_id) {
      await notifyHospital(
        assignment.id,
        assignment.hospital_id,
        assignment.vehicle_number || "AMB",
        assignment.emergency_type || "Critical",
        assignment.eta || 600
      );
      notified++;
    }
    
    // Attempt junction distribution using robust logic
    if (assignment.route) {
        await notifyJunctions(
            assignment.id, 
            assignment.vehicle_number || "AMB", 
            assignment.emergency_type || "Critical", 
            assignment.route, 
            junctionIds
        );
        notified += junctionIds.length;
    }
    
    // For citizens (would be real push notification)
    if (assignment.citizen_id) {
        await notifyCitizenAssigned(assignment.citizen_id, assignment.id, assignment.eta || 600);
        notified++;
    }
  } catch (e) {
    console.error(e);
    errors++;
  }

  return { notified, errors };
}

// ==========================================
// Preparation Status Sync
// ==========================================
export async function syncPreparationStatus(
  assignmentId: string
): Promise<{ hospitalReady: boolean; prepStatus: string }> {
  const { data } = await supabase
    .from("ambulance_assignments")
    .select("prep_status")
    .eq("id", assignmentId)
    .single();

  const prepStatus = data?.prep_status || "unknown";
  return {
    hospitalReady: prepStatus === "ready",
    prepStatus,
  };
}
