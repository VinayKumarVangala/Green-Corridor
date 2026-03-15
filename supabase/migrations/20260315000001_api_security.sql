-- API Security & Rate Limiting
CREATE TABLE IF NOT EXISTS api_rate_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ip_address TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    request_count INTEGER DEFAULT 1,
    last_request_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(ip_address, endpoint)
);

-- Index for fast lookup by IP and endpoint
CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_endpoint ON api_rate_limits(ip_address, endpoint);

-- Function to clean up old rate limits (older than 1 hour)
CREATE OR REPLACE FUNCTION clean_old_rate_limits()
RETURNS void AS $$
BEGIN
    DELETE FROM api_rate_limits WHERE last_request_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;
