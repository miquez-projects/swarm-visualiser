-- Strava activity photos
CREATE TABLE IF NOT EXISTS strava_activity_photos (
  id SERIAL PRIMARY KEY,
  strava_activity_id INTEGER REFERENCES strava_activities(id) ON DELETE CASCADE,
  strava_photo_id BIGINT UNIQUE NOT NULL,

  -- Photo URLs (Strava provides multiple sizes)
  photo_url_full TEXT NOT NULL,
  photo_url_600 TEXT,
  photo_url_300 TEXT,

  -- Photo metadata
  caption TEXT,
  location GEOGRAPHY(POINT, 4326),
  created_at_strava TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_strava_activity_photos_strava_activity_id ON strava_activity_photos(strava_activity_id);
CREATE INDEX idx_strava_photos_location ON strava_activity_photos USING GIST(location);

INSERT INTO schema_migrations (version, name)
VALUES (10, '010_add_strava_activity_photos');
