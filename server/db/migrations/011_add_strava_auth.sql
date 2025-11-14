-- Add Strava OAuth columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS strava_oauth_tokens_encrypted TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS strava_athlete_id BIGINT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS strava_connected_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_strava_sync_at TIMESTAMP;

INSERT INTO schema_migrations (version, name)
VALUES (11, '011_add_strava_auth');
