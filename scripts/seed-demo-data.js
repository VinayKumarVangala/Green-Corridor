#!/usr/bin/env node
// scripts/seed-demo-data.js — Seeds Supabase with JEEVAN-SETU demo data
// Usage: node scripts/seed-demo-data.js [--reset]

import { createClient } from "@supabase/supabase-js";

const RESET = process.argv.includes("--reset");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
);

// ─── Helpers ──────────────────────────────────────────────────────────────────
const log  = (msg) => console.log(`  ✓ ${msg}`);
const warn = (msg) => console.warn(`  ⚠ ${msg}`);

async function upsert(table, rows, conflictCol = "id") {
  const { error } = await supabase.from(table).upsert(rows, { onConflict: conflictCol });
  if (error) throw new Error(`[${table}] ${error.message}`);
  log(`${table}: ${rows.length} row(s) seeded`);
}

async function truncate(table) {
  const { error } = await supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) warn(`Could not truncate ${table}: ${error.message}`);
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const HOSPITALS = [
  { id: "h-001", name: "City General Hospital",       address: "Main Road, Sector 1",    lat: 28.6145, lng: 77.2100, capacity_status: "available", contact_number: "+91-11-12345601", specialties: ["cardiac","trauma","general"] },
  { id: "h-002", name: "Memorial Medical Center",     address: "North Avenue, Sector 2", lat: 28.6220, lng: 77.2180, capacity_status: "available", contact_number: "+91-11-12345602", specialties: ["cardiac","neurology","pediatrics"] },
  { id: "h-003", name: "St. Mary's Hospital",         address: "South District, Sector 3",lat: 28.6050, lng: 77.2000, capacity_status: "busy",      contact_number: "+91-11-12345603", specialties: ["general","maternity"] },
  { id: "h-004", name: "University Medical Center",   address: "East Campus, Sector 4",  lat: 28.6300, lng: 77.2150, capacity_status: "available", contact_number: "+91-11-12345604", specialties: ["cardiac","trauma","neurology","pediatrics"] },
  { id: "h-005", name: "Westside Community Hospital", address: "West End, Sector 5",     lat: 28.6000, lng: 77.1950, capacity_status: "available", contact_number: "+91-11-12345605", specialties: ["general","geriatric"] },
];

const JUNCTIONS = [
  { id: "j-001", junction_id: "J001", name: "Main Blvd & Central Ave",  lat: 28.6139, lng: 77.2090, contact_number: "+91-11-22345601" },
  { id: "j-002", junction_id: "J002", name: "North Ave & Market St",    lat: 28.6180, lng: 77.2120, contact_number: "+91-11-22345602" },
  { id: "j-003", junction_id: "J003", name: "South St & Ring Rd",       lat: 28.6080, lng: 77.2070, contact_number: "+91-11-22345603" },
  { id: "j-004", junction_id: "J004", name: "East Campus Junction",     lat: 28.6220, lng: 77.2180, contact_number: "+91-11-22345604" },
  { id: "j-005", junction_id: "J005", name: "Westside Crossing",        lat: 28.6050, lng: 77.2000, contact_number: "+91-11-22345605" },
  { id: "j-006", junction_id: "J006", name: "Ring Road North Gate",     lat: 28.6300, lng: 77.2150, contact_number: "+91-11-22345606" },
  { id: "j-007", junction_id: "J007", name: "Sector 5 Roundabout",      lat: 28.6000, lng: 77.1950, contact_number: "+91-11-22345607" },
];

// Demo drivers — these match the static credentials in auth.ts
const DRIVERS = [
  { id: "d-001", employee_id: "EMP001", vehicle_number: "VEH001", current_status: "available", current_lat: 28.6150, current_lng: 77.2120, assigned_hospital_id: "h-001" },
  { id: "d-002", employee_id: "EMP002", vehicle_number: "DL-01-AB-1235", current_status: "available", current_lat: 28.6180, current_lng: 77.2140, assigned_hospital_id: "h-002" },
  { id: "d-003", employee_id: "EMP003", vehicle_number: "DL-01-AB-1236", current_status: "available", current_lat: 28.6040, current_lng: 77.2010, assigned_hospital_id: "h-003" },
  { id: "d-004", employee_id: "EMP004", vehicle_number: "DL-01-AB-1237", current_status: "available", current_lat: 28.6220, current_lng: 77.2170, assigned_hospital_id: "h-004" },
  { id: "d-005", employee_id: "EMP005", vehicle_number: "DL-01-AB-1238", current_status: "available", current_lat: 28.6280, current_lng: 77.2160, assigned_hospital_id: "h-004" },
];

// Sample completed emergency for analytics/dashboard demo
const DEMO_REQUEST = {
  id: "req-demo-001",
  requester_name: "Demo Citizen",
  requester_phone: "+91-9999999999",
  emergency_type: "Cardiac Arrest",
  address: "Block B, Sector 4, New Delhi",
  lat: 28.6200,
  lng: 77.2160,
  status: "arrived",
};

const DEMO_ASSIGNMENT = {
  id: "asgn-demo-001",
  emergency_request_id: "req-demo-001",
  ambulance_driver_id: "d-001",
  hospital_id: "h-001",
  status: "arrived",
  assigned_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  accepted_at: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
  pickup_time:  new Date(Date.now() -  8 * 60 * 1000).toISOString(),
};

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n🌱 JEEVAN-SETU — Seeding demo data\n");

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  if (RESET) {
    console.log("⚠  --reset flag detected — clearing existing demo data...");
    for (const t of ["hospital_notifications","junction_alerts","route_tracking","ambulance_assignments","emergency_requests","ambulance_drivers","traffic_junctions","hospitals"]) {
      await truncate(t);
    }
    console.log("");
  }

  try {
    await upsert("hospitals",         HOSPITALS,  "id");
    await upsert("traffic_junctions", JUNCTIONS,  "id");
    await upsert("ambulance_drivers", DRIVERS,    "id");
    await upsert("emergency_requests",[DEMO_REQUEST],  "id");
    await upsert("ambulance_assignments",[DEMO_ASSIGNMENT],"id");

    // Hospital notification for the demo assignment
    await upsert("hospital_notifications", [{
      id: "notif-demo-001",
      assignment_id: "asgn-demo-001",
      hospital_id: "h-001",
      patient_details: { vehicle_number: "VEH001", emergency_type: "Cardiac Arrest", priority: "P0", message: "✅ Demo patient arrived." },
      eta: new Date().toISOString(),
      status: "arrived",
    }], "id");

    // Junction alerts for the demo route
    const junctionAlerts = ["j-001","j-002"].map((jid, i) => ({
      id: `jalert-demo-00${i+1}`,
      assignment_id: "asgn-demo-001",
      junction_id: jid,
      expected_arrival: new Date(Date.now() - (10 - i * 3) * 60 * 1000).toISOString(),
      status: "cleared",
    }));
    await upsert("junction_alerts", junctionAlerts, "id");

    console.log("\n✅ Demo data seeded successfully\n");
  } catch (err) {
    console.error("\n❌ Seed failed:", err.message);
    process.exit(1);
  }
}

main();
