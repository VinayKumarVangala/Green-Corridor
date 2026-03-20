-- ML Model Registry
-- Stores trained model weights, metadata, and A/B test state

CREATE TABLE IF NOT EXISTS ml_models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Identity
  model_type TEXT NOT NULL CHECK (model_type IN ('response_time', 'congestion')),
  version INTEGER NOT NULL,                  -- monotonically increasing per type
  slot TEXT NOT NULL CHECK (slot IN ('champion', 'challenger', 'archived')),

  -- Weights (serialized as JSONB — coefficients + intercept)
  weights JSONB NOT NULL,                    -- { coefficients: number[], intercept: number, featureNames: string[] }

  -- Training metadata
  trained_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  training_samples INTEGER NOT NULL,
  feature_count INTEGER NOT NULL,

  -- Validation metrics
  mae DECIMAL(10,4),                         -- Mean Absolute Error (seconds for response_time)
  rmse DECIMAL(10,4),                        -- Root Mean Squared Error
  r2 DECIMAL(6,4),                           -- R² coefficient of determination
  baseline_mae DECIMAL(10,4),               -- MAE of naive baseline (mean predictor)
  improvement_pct DECIMAL(6,2),             -- (baseline_mae - mae) / baseline_mae * 100

  -- Deployment
  deployed_at TIMESTAMP WITH TIME ZONE,
  retired_at TIMESTAMP WITH TIME ZONE,
  deployed_by TEXT,                          -- 'auto' | 'admin'

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- A/B test sessions
CREATE TABLE IF NOT EXISTS ml_ab_tests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  model_type TEXT NOT NULL,
  champion_model_id UUID REFERENCES ml_models(id),
  challenger_model_id UUID REFERENCES ml_models(id),

  -- Traffic split
  challenger_traffic_pct INTEGER DEFAULT 10 CHECK (challenger_traffic_pct BETWEEN 0 AND 100),

  -- Accumulated metrics (updated on each prediction)
  champion_predictions INTEGER DEFAULT 0,
  challenger_predictions INTEGER DEFAULT 0,
  champion_mae_sum DECIMAL(14,4) DEFAULT 0,  -- sum of |predicted - actual| for champion
  challenger_mae_sum DECIMAL(14,4) DEFAULT 0,

  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'promoted', 'rolled_back', 'completed')),
  conclusion TEXT,                           -- human-readable outcome

  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Prediction log (sample — 1-in-10 stored for feedback loop)
CREATE TABLE IF NOT EXISTS ml_predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  model_id UUID REFERENCES ml_models(id),
  model_type TEXT NOT NULL,
  ab_slot TEXT,                              -- 'champion' | 'challenger'

  features JSONB NOT NULL,
  predicted_value DECIMAL(10,2) NOT NULL,   -- seconds (response_time) or 0-1 (congestion)
  actual_value DECIMAL(10,2),               -- filled in post-incident

  emergency_request_id UUID REFERENCES emergency_requests(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ml_models_type_slot ON ml_models(model_type, slot);
CREATE INDEX IF NOT EXISTS idx_ml_models_version ON ml_models(model_type, version DESC);
CREATE INDEX IF NOT EXISTS idx_ml_ab_tests_type_status ON ml_ab_tests(model_type, status);
CREATE INDEX IF NOT EXISTS idx_ml_predictions_model ON ml_predictions(model_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ml_predictions_request ON ml_predictions(emergency_request_id);

-- RLS (service role writes, admin reads)
ALTER TABLE ml_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_ab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view ML models" ON ml_models FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can view AB tests" ON ml_ab_tests FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can view predictions" ON ml_predictions FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
