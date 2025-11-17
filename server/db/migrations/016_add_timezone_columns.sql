-- Migration 016: Add timezone columns for local time display
-- Adds timezone identifier (e.g., "America/Guatemala", "Asia/Tokyo") to store
-- the timezone where the check-in/activity occurred based on lat/lng

-- Add timezone to checkins
ALTER TABLE checkins
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50);

-- Add timezone to strava_activities (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'strava_activities') THEN
    ALTER TABLE strava_activities ADD COLUMN IF NOT EXISTS timezone VARCHAR(50);
  END IF;
END $$;

-- Add timezone to garmin_activities (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'garmin_activities') THEN
    ALTER TABLE garmin_activities ADD COLUMN IF NOT EXISTS timezone VARCHAR(50);
  END IF;
END $$;

-- Add indexes for timezone-aware queries
CREATE INDEX IF NOT EXISTS idx_checkins_timezone ON checkins(timezone);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'strava_activities') THEN
    CREATE INDEX IF NOT EXISTS idx_strava_activities_timezone ON strava_activities(timezone);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'garmin_activities') THEN
    CREATE INDEX IF NOT EXISTS idx_garmin_activities_timezone ON garmin_activities(timezone);
  END IF;
END $$;

-- Add comments
COMMENT ON COLUMN checkins.timezone IS 'IANA timezone identifier (e.g., America/New_York) derived from lat/lng';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'strava_activities') THEN
    COMMENT ON COLUMN strava_activities.timezone IS 'IANA timezone identifier derived from start_latlng';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'garmin_activities') THEN
    COMMENT ON COLUMN garmin_activities.timezone IS 'IANA timezone identifier derived from start coordinates';
  END IF;
END $$;
