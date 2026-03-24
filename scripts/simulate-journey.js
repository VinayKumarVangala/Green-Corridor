const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// ─── Load Environment Variables ───────────────────────────────────────────────
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env.local not found');
    process.exit(1);
  }
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  content.split('\n').forEach(line => {
    const [key, ...value] = line.split('=');
    if (key && value) env[key.trim()] = value.join('=').trim().replace(/^["']|["']$/g, '');
  });
  return env;
}

const env = loadEnv();
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

// ─── Helper: Decode Polyline ──────────────────────────────────────────────────
function decodePolyline(str, precision = 5) {
  let index = 0, lat = 0, lng = 0, coordinates = [];
  let shift = 0, result = 0, byte = null;
  let factor = Math.pow(10, precision);

  while (index < str.length) {
    byte = null; shift = 0; result = 0;
    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += ((result & 1) ? ~(result >> 1) : (result >> 1));

    byte = null; shift = 0; result = 0;
    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += ((result & 1) ? ~(result >> 1) : (result >> 1));

    coordinates.push([lat / factor, lng / factor]);
  }
  return coordinates;
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ─── Simulation Logic ──────────────────────────────────────────────────────────
async function simulate() {
  console.log('🚀 Starting JEEVAN-SETU Journey Simulation...');

  // 1. Find active assignment
  const { data: assignments, error: asgnErr } = await supabase
    .from('ambulance_assignments')
    .select('*, ambulance_drivers(*), emergency_requests(*)')
    .in('status', ['accepted', 'picked_up'])
    .order('accepted_at', { ascending: false })
    .limit(1);

  if (asgnErr || !assignments.length) {
    console.log('ℹ️ No active accepted assignments found to simulate.');
    return;
  }

  const assignment = assignments[0];
  const driver = assignment.ambulance_drivers;
  const request = assignment.emergency_requests;

  console.log(`📍 Simulating Assignment: ${assignment.id}`);
  console.log(`🚑 Vehicle: ${driver.vehicle_number} | Status: ${assignment.status}`);

  // 2. Get route tracking data
  const { data: tracking } = await supabase
    .from('route_tracking')
    .select('*')
    .eq('assignment_id', assignment.id)
    .single();

  if (!tracking || !tracking.route_data) {
    console.error('❌ No route tracking data found for this assignment.');
    return;
  }

  const polyline = tracking.route_data.polyline;
  const path = decodePolyline(polyline);
  console.log(`🛣️ Route loaded: ${path.length} waypoints.`);

  // 3. Move along the path
  for (let i = 0; i < path.length; i += 5) { // Skip points for faster demo
    const [lat, lng] = path[i];
    
    // Update driver location
    await supabase.from('ambulance_drivers')
      .update({ current_lat: lat, current_lng: lng, last_location_update: new Date().toISOString() })
      .eq('id', driver.id);

    process.stdout.write(`\r🚚 Moving... [${lat.toFixed(4)}, ${lng.toFixed(4)}] (${i}/${path.length})`);

    // Check for nearby junctions and clear them
    const { data: alerts } = await supabase
      .from('junction_alerts')
      .select('*, traffic_junctions(*)')
      .eq('assignment_id', assignment.id)
      .eq('status', 'pending');

    if (alerts) {
      for (const alert of alerts) {
        const j = alert.traffic_junctions;
        const dist = haversine(lat, lng, j.lat, j.lng);
        if (dist < 0.3) { // 300m range
          console.log(`\n🚦 Junction Cleared: ${j.name}`);
          await supabase.from('junction_alerts')
            .update({ status: 'cleared' })
            .eq('id', alert.id);
        }
      }
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  // 4. Finalize
  console.log('\n🏁 Destination reached!');
  await supabase.from('ambulance_assignments')
    .update({ status: 'arrived' })
    .eq('id', assignment.id);
    
  await supabase.from('emergency_requests')
    .update({ status: 'arrived' })
    .eq('id', request.id);

  if (assignment.hospital_id) {
    await supabase.from('hospital_notifications')
      .update({ status: 'arrived' })
      .eq('assignment_id', assignment.id)
      .eq('hospital_id', assignment.hospital_id);
      console.log('🏥 Hospital intake notified of arrival.');
  }

  console.log('✅ Simulation complete.');
}

simulate();
