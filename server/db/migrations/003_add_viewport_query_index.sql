-- Migration: Add composite index for viewport-based queries
-- Depends on: 001_add_multi_user_support (user_id column)

-- Composite index for viewport-based queries with user filtering
-- Order: user_id first enables user-scoped queries, then lat/lng for BETWEEN clauses
-- Optimizes: WHERE user_id = ? AND latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?
CREATE INDEX IF NOT EXISTS idx_user_lat_lng ON checkins(user_id, latitude, longitude);
