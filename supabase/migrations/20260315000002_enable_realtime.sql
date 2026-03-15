-- Enable Realtime for tracking tables
BEGIN;
  -- Check if publication exists and add tables
  -- This is idempotent for hackathon purposes
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
      CREATE PUBLICATION supabase_realtime;
    END IF;
  END $$;

  ALTER PUBLICATION supabase_realtime ADD TABLE emergency_requests;
  ALTER PUBLICATION supabase_realtime ADD TABLE ambulance_drivers;
  ALTER PUBLICATION supabase_realtime ADD TABLE ambulance_assignments;
COMMIT;
