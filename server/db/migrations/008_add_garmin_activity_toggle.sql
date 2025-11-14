-- Add toggle for Garmin activity sync
-- Default to true for backward compatibility (existing users keep activity sync)
ALTER TABLE users ADD COLUMN IF NOT EXISTS garmin_sync_activities BOOLEAN DEFAULT true;

-- Add helpful comment
COMMENT ON COLUMN users.garmin_sync_activities IS 'When false, Garmin sync only imports daily metrics (steps, HR, sleep), not activities';
