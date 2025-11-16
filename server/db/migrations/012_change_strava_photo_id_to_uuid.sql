-- Change strava_photo_id from BIGINT to UUID to match Strava API v3 response
-- Strava no longer returns numeric photo IDs, only unique_id (UUID)

-- Drop the existing column and recreate it as UUID
ALTER TABLE strava_activity_photos DROP COLUMN strava_photo_id;
ALTER TABLE strava_activity_photos ADD COLUMN strava_photo_id UUID UNIQUE NOT NULL;

INSERT INTO schema_migrations (version, name)
VALUES (12, '012_change_strava_photo_id_to_uuid');
