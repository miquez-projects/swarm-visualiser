-- Migration: Add last_login_at column to users table
-- Date: 2025-11-04
-- Description: Tracks user activity for daily sync filtering (skip users inactive > 30 days)

ALTER TABLE users
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

-- Set initial value to NOW() for existing users
UPDATE users
SET last_login_at = NOW()
WHERE last_login_at IS NULL;

-- Create index for performance (filtering by last_login_at in daily sync)
CREATE INDEX IF NOT EXISTS idx_users_last_login_at ON users(last_login_at);
