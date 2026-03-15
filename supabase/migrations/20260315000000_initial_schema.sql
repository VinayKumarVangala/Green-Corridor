-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Create tables

-- Users & Authentication (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  full_name TEXT,
  phone TEXT,
  role TEXT CHECK (role IN ('citizen', 'ambulance_driver', 'hospital_staff', 'traffic_police', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Hospitals
CREATE TABLE hospitals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT,
  lat DECIMAL(10,8),
  lng DECIMAL(11,8),
  contact_number TEXT,
  capacity_status TEXT DEFAULT 'available' CHECK (capacity_status IN ('available', 'busy', 'critical')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ambulance drivers specific
CREATE TABLE ambulance_drivers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES profiles(id) UNIQUE,
  employee_id TEXT UNIQUE NOT NULL,
  vehicle_number TEXT UNIQUE NOT NULL,
  current_status TEXT DEFAULT 'available' CHECK (current_status IN ('available', 'busy', 'offline')),
  current_lat DECIMAL(10,8),
  current_lng DECIMAL(11,8),
  location GEOGRAPHY(POINT, 4326), -- Added for PostGIS support
  last_location_update TIMESTAMP WITH TIME ZONE,
  assigned_hospital_id UUID REFERENCES hospitals(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Hospital staff
CREATE TABLE hospital_staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES profiles(id) UNIQUE,
  hospital_id UUID REFERENCES hospitals(id),
  staff_id TEXT UNIQUE NOT NULL,
  department TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Traffic junctions
CREATE TABLE traffic_junctions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  junction_id TEXT UNIQUE NOT NULL,
  name TEXT,
  lat DECIMAL(10,8),
  lng DECIMAL(11,8),
  location GEOGRAPHY(POINT, 4326), -- Added for PostGIS support
  contact_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Traffic police
CREATE TABLE traffic_police (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES profiles(id) UNIQUE,
  junction_id UUID REFERENCES traffic_junctions(id),
  badge_number TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Emergency requests (public)
CREATE TABLE emergency_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_name TEXT,
  requester_phone TEXT,
  emergency_type TEXT NOT NULL,
  address TEXT NOT NULL,
  lat DECIMAL(10,8) NOT NULL,
  lng DECIMAL(11,8) NOT NULL,
  location GEOGRAPHY(POINT, 4326), -- Added for PostGIS support
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'picked_up', 'arrived', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ambulance assignments
CREATE TABLE ambulance_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  emergency_request_id UUID REFERENCES emergency_requests(id),
  ambulance_driver_id UUID REFERENCES ambulance_drivers(id),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  declined_at TIMESTAMP WITH TIME ZONE,
  pickup_time TIMESTAMP WITH TIME ZONE,
  hospital_id UUID REFERENCES hospitals(id),
  status TEXT DEFAULT 'assigned' CHECK (status IN ('assigned', 'accepted', 'declined', 'picked_up', 'en_route', 'arrived', 'cancelled'))
);

-- Route tracking
CREATE TABLE route_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID REFERENCES ambulance_assignments(id),
  route_data JSONB, -- Store waypoints
  current_route_index INTEGER,
  estimated_arrival TIMESTAMP WITH TIME ZONE,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Traffic junction alerts
CREATE TABLE junction_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID REFERENCES ambulance_assignments(id),
  junction_id UUID REFERENCES traffic_junctions(id),
  expected_arrival TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'cleared', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Hospital notifications
CREATE TABLE hospital_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID REFERENCES ambulance_assignments(id),
  hospital_id UUID REFERENCES hospitals(id),
  patient_details JSONB,
  eta TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'ready', 'arrived')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Session tracking
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  device_info JSONB,
  ip_address TEXT,
  logged_in_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  logged_out_at TIMESTAMP WITH TIME ZONE
);

-- Audit logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Set up Row Level Security (RLS) policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE ambulance_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospital_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE traffic_junctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE traffic_police ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE ambulance_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE junction_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospital_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Sample Policies
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Hospitals are viewable by everyone" ON hospitals FOR SELECT USING (true);
CREATE POLICY "Emergency requests can be created by anyone" ON emergency_requests FOR INSERT WITH CHECK (true);

-- 4. Create indexes for performance
CREATE INDEX idx_emergency_requests_status_created_at ON emergency_requests(status, created_at);
CREATE INDEX idx_ambulance_drivers_current_status ON ambulance_drivers(current_status);
CREATE INDEX idx_route_tracking_assignment_last_updated ON route_tracking(assignment_id, last_updated);
CREATE INDEX idx_junction_alerts_status_arrival ON junction_alerts(status, expected_arrival);

-- 5. Helper functions

-- Location trigger
CREATE OR REPLACE FUNCTION update_location_point()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
        NEW.location = ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_update_ambulance_location BEFORE INSERT OR UPDATE ON ambulance_drivers FOR EACH ROW EXECUTE FUNCTION update_location_point();
CREATE TRIGGER tr_update_emergency_location BEFORE INSERT OR UPDATE ON emergency_requests FOR EACH ROW EXECUTE FUNCTION update_location_point();
CREATE TRIGGER tr_update_junction_location BEFORE INSERT OR UPDATE ON traffic_junctions FOR EACH ROW EXECUTE FUNCTION update_location_point();

-- find_nearest_ambulance
CREATE OR REPLACE FUNCTION find_nearest_ambulance(lat DECIMAL, lng DECIMAL)
RETURNS TABLE (
    driver_id UUID,
    dist_meters FLOAT,
    vehicle_number TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ad.id,
        ST_Distance(ad.location, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography) AS dist_meters,
        ad.vehicle_number
    FROM ambulance_drivers ad
    WHERE ad.current_status = 'available'
    ORDER BY ad.location <-> ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- calculate_route_eta
CREATE OR REPLACE FUNCTION calculate_route_eta(waypoints JSONB)
RETURNS INTERVAL AS $$
BEGIN
    -- Logic placeholder
    RETURN INTERVAL '10 minutes';
END;
$$ LANGUAGE plpgsql;

-- update_traffic_conditions
CREATE OR REPLACE FUNCTION update_traffic_conditions(junction_id UUID, congestion_level TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE junction_alerts
    SET status = CASE 
        WHEN congestion_level = 'high' THEN 'pending'
        ELSE 'cleared'
    END
    WHERE junction_id = junction_id AND status = 'pending';
END;
$$ LANGUAGE plpgsql;
