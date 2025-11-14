-- Strava activities table (replaces Garmin activities for activity tracking)
CREATE TABLE IF NOT EXISTS strava_activities (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  strava_activity_id BIGINT NOT NULL,

  -- Activity metadata
  activity_type VARCHAR(100),  -- Run, Ride, Swim, Workout, Yoga, etc.
  activity_name TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMP NOT NULL,
  start_latlng GEOGRAPHY(POINT, 4326),
  end_latlng GEOGRAPHY(POINT, 4326),

  -- Activity metrics
  duration_seconds INTEGER NOT NULL,
  moving_time_seconds INTEGER,
  distance_meters DECIMAL(10, 2),
  total_elevation_gain DECIMAL(10, 2),
  calories INTEGER,

  -- Performance metrics
  avg_speed DECIMAL(5, 2),
  max_speed DECIMAL(5, 2),
  avg_heart_rate INTEGER,
  max_heart_rate INTEGER,
  avg_cadence DECIMAL(5, 2),
  avg_watts DECIMAL(7, 2),

  -- GPS tracklog for mapped activities (PostGIS LineString)
  tracklog GEOGRAPHY(LINESTRING, 4326),

  -- Strava-specific features
  is_private BOOLEAN DEFAULT false,
  kudos_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  photo_count INTEGER DEFAULT 0,
  achievement_count INTEGER DEFAULT 0,

  -- Links
  strava_url TEXT NOT NULL,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_strava_activities_user_activity ON strava_activities(user_id, strava_activity_id);
CREATE INDEX idx_strava_activities_user_id ON strava_activities(user_id);
CREATE INDEX idx_strava_activities_start_time ON strava_activities(start_time);
CREATE INDEX idx_strava_activities_type ON strava_activities(activity_type);
CREATE INDEX idx_strava_activities_tracklog ON strava_activities USING GIST(tracklog);

-- Trigger to automatically update updated_at on strava_activities table
DROP TRIGGER IF EXISTS update_strava_activities_updated_at ON strava_activities;
CREATE TRIGGER update_strava_activities_updated_at
    BEFORE UPDATE ON strava_activities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

INSERT INTO schema_migrations (version, name)
VALUES (9, '009_add_strava_activities');
