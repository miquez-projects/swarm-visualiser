-- Add Garmin authentication columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS garmin_session_token_encrypted TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS garmin_connected_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_garmin_sync_at TIMESTAMP;

INSERT INTO schema_migrations (version, name)
VALUES (7, '007_add_garmin_auth');
