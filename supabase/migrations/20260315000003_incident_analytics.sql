-- Incident Analytics Schema
-- Comprehensive data collection for post-incident analysis and AI learning

-- Main incident analytics table (one row per emergency request lifecycle)
CREATE TABLE IF NOT EXISTS incident_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  emergency_request_id UUID REFERENCES emergency_requests(id) UNIQUE NOT NULL,
  
  -- Timestamps (full lifecycle)
  request_created_at TIMESTAMP WITH TIME ZONE,
  first_assignment_at TIMESTAMP WITH TIME ZONE,
  driver_accepted_at TIMESTAMP WITH TIME ZONE,
  pickup_confirmed_at TIMESTAMP WITH TIME ZONE,
  hospital_arrived_at TIMESTAMP WITH TIME ZONE,
  incident_closed_at TIMESTAMP WITH TIME ZONE,
  
  -- Durations (seconds)
  dispatch_duration INTEGER, -- request → first assignment
  acceptance_duration INTEGER, -- assignment → driver accept
  pickup_duration INTEGER, -- accept → pickup
  transport_duration INTEGER, -- pickup → hospital arrival
  total_duration INTEGER, -- request → hospital arrival
  
  -- Assignment attempts
  total_dispatch_attempts INTEGER DEFAULT 0,
  declined_count INTEGER DEFAULT 0,
  timeout_count INTEGER DEFAULT 0,
  final_driver_id UUID REFERENCES ambulance_drivers(id),
  
  -- Route analytics
  initial_route_distance DECIMAL(10,2), -- meters
  initial_route_duration INTEGER, -- seconds
  final_route_distance DECIMAL(10,2),
  final_route_duration INTEGER,
  route_changes_count INTEGER DEFAULT 0,
  
  -- Traffic & delays
  traffic_factor_avg DECIMAL(4,2), -- average traffic multiplier
  rush_hour_severity DECIMAL(3,2), -- 0-1
  total_delay_seconds INTEGER DEFAULT 0,
  delay_causes JSONB, -- array of {cause, duration, timestamp}
  
  -- Junction clearance
  junctions_alerted INTEGER DEFAULT 0,
  junctions_cleared INTEGER DEFAULT 0,
  avg_clearance_time INTEGER, -- seconds
  
  -- Hospital coordination
  hospital_id UUID REFERENCES hospitals(id),
  hospital_prep_time INTEGER, -- seconds from alert to ready
  hospital_capacity_at_arrival TEXT, -- available/busy/critical
  
  -- Alternatives considered
  ambulance_candidates JSONB, -- array of {id, distance, score, selected}
  hospital_candidates JSONB, -- array of {id, distance, score, selected}
  route_alternatives JSONB, -- array of {label, score, distance, duration, selected}
  
  -- Performance metrics
  response_efficiency DECIMAL(4,2), -- 0-1 score
  route_efficiency DECIMAL(4,2), -- actual vs optimal
  stakeholder_coordination_score DECIMAL(4,2), -- 0-1
  
  -- Feedback
  hospital_feedback JSONB,
  driver_notes TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Driver decision log (one row per assignment attempt)
CREATE TABLE IF NOT EXISTS driver_decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id UUID REFERENCES incident_analytics(id) NOT NULL,
  assignment_id UUID REFERENCES ambulance_assignments(id) NOT NULL,
  driver_id UUID REFERENCES ambulance_drivers(id) NOT NULL,
  
  attempt_number INTEGER NOT NULL,
  decision TEXT CHECK (decision IN ('accepted', 'declined', 'timeout')) NOT NULL,
  decision_time_seconds INTEGER, -- how long to respond
  decline_reason TEXT,
  
  driver_distance_km DECIMAL(10,2),
  driver_score DECIMAL(10,2),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Route change log (one row per reroute)
CREATE TABLE IF NOT EXISTS route_changes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id UUID REFERENCES incident_analytics(id) NOT NULL,
  assignment_id UUID REFERENCES ambulance_assignments(id) NOT NULL,
  
  change_number INTEGER NOT NULL,
  reason TEXT NOT NULL, -- "traffic", "junction_blocked", "manual", etc.
  triggered_by TEXT, -- "ai_monitor", "traffic_webhook", "driver", etc.
  
  old_route JSONB, -- {distance, duration, score, polyline}
  new_route JSONB,
  improvement_percent DECIMAL(5,2),
  
  junctions_cancelled INTEGER DEFAULT 0,
  junctions_added INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Junction clearance log (one row per junction alert)
CREATE TABLE IF NOT EXISTS junction_clearance_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id UUID REFERENCES incident_analytics(id) NOT NULL,
  junction_id UUID REFERENCES traffic_junctions(id) NOT NULL,
  
  alert_created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  expected_arrival TIMESTAMP WITH TIME ZONE NOT NULL,
  actual_arrival TIMESTAMP WITH TIME ZONE,
  cleared_at TIMESTAMP WITH TIME ZONE,
  
  clearance_time_seconds INTEGER, -- alert → cleared
  arrival_accuracy_seconds INTEGER, -- expected vs actual
  
  status TEXT, -- pending/cleared/cancelled
  cancelled_reason TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API call tracking (for performance analysis)
CREATE TABLE IF NOT EXISTS api_call_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,
  
  user_id UUID REFERENCES auth.users(id),
  user_role TEXT,
  ip_address TEXT,
  
  request_body JSONB,
  response_time_ms INTEGER,
  
  incident_id UUID REFERENCES incident_analytics(id), -- if related to an incident
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_incident_analytics_request ON incident_analytics(emergency_request_id);
CREATE INDEX IF NOT EXISTS idx_incident_analytics_created ON incident_analytics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incident_analytics_driver ON incident_analytics(final_driver_id);
CREATE INDEX IF NOT EXISTS idx_incident_analytics_hospital ON incident_analytics(hospital_id);

CREATE INDEX IF NOT EXISTS idx_driver_decisions_incident ON driver_decisions(incident_id);
CREATE INDEX IF NOT EXISTS idx_driver_decisions_driver ON driver_decisions(driver_id);

CREATE INDEX IF NOT EXISTS idx_route_changes_incident ON route_changes(incident_id);
CREATE INDEX IF NOT EXISTS idx_route_changes_created ON route_changes(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_junction_clearance_incident ON junction_clearance_log(incident_id);
CREATE INDEX IF NOT EXISTS idx_junction_clearance_junction ON junction_clearance_log(junction_id);

CREATE INDEX IF NOT EXISTS idx_api_call_log_endpoint ON api_call_log(endpoint, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_call_log_incident ON api_call_log(incident_id);
CREATE INDEX IF NOT EXISTS idx_api_call_log_user ON api_call_log(user_id);

-- RLS policies (admin-only access for analytics)
ALTER TABLE incident_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE junction_clearance_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_call_log ENABLE ROW LEVEL SECURITY;

-- Admin can see all analytics
CREATE POLICY "Admins can view all analytics" ON incident_analytics FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can view driver decisions" ON driver_decisions FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can view route changes" ON route_changes FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can view junction clearance" ON junction_clearance_log FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can view API logs" ON api_call_log FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
