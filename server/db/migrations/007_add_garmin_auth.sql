-- Replace garmin_session_token_encrypted with OAuth tokens
ALTER TABLE users DROP COLUMN IF EXISTS garmin_session_token_encrypted;
ALTER TABLE users ADD COLUMN IF NOT EXISTS garmin_oauth_tokens_encrypted TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS garmin_connected_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_garmin_sync_at TIMESTAMP;

-- Update schema_migrations
INSERT INTO schema_migrations (version, name)
VALUES (7, '007_add_garmin_oauth')
ON CONFLICT (version) DO UPDATE SET name = '007_add_garmin_oauth';
