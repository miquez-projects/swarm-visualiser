-- Add Garmin OAuth columns to users table
ALTER TABLE users DROP COLUMN IF EXISTS garmin_session_token_encrypted;
ALTER TABLE users ADD COLUMN IF NOT EXISTS garmin_oauth_tokens_encrypted TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS garmin_connected_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_garmin_sync_at TIMESTAMP;
