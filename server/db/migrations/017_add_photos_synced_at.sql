-- Migration 017: Add photos_synced_at to track photo sync progress
-- This prevents re-fetching photos for activities that have already been synced

-- Add photos_synced_at column to strava_activities
ALTER TABLE strava_activities
ADD COLUMN IF NOT EXISTS photos_synced_at TIMESTAMP;

-- Add index for efficient queries (find activities needing photo sync)
CREATE INDEX IF NOT EXISTS idx_strava_activities_photos_sync
ON strava_activities(user_id, photos_synced_at)
WHERE photo_count > 0 AND photos_synced_at IS NULL;

-- Add comment
COMMENT ON COLUMN strava_activities.photos_synced_at IS 'Timestamp when photos were last synced for this activity. NULL means not yet synced.';
