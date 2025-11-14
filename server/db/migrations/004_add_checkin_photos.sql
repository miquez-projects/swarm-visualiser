-- Migration: Add check-in photos support
-- Date: 2025-01-14
-- Description: Adds checkin_photos table to store photos from Foursquare check-ins

-- Create checkin_photos table
CREATE TABLE IF NOT EXISTS checkin_photos (
  id SERIAL PRIMARY KEY,
  checkin_id INTEGER NOT NULL REFERENCES checkins(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  photo_url_cached TEXT,
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create index on checkin_id for efficient lookups
CREATE INDEX IF NOT EXISTS idx_checkin_photos_checkin_id ON checkin_photos(checkin_id);

-- Track migration
INSERT INTO migrations (name) VALUES ('004_add_checkin_photos.sql')
ON CONFLICT DO NOTHING;
