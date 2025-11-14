-- Garmin Activities
CREATE TABLE IF NOT EXISTS garmin_activities (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  garmin_activity_id VARCHAR(255) NOT NULL,
  activity_type VARCHAR(100),
  activity_name TEXT,
  start_time TIMESTAMP NOT NULL,
  duration_seconds INTEGER,
  distance_meters DECIMAL(10, 2),
  calories INTEGER,
  avg_heart_rate INTEGER,
  max_heart_rate INTEGER,
  tracklog GEOGRAPHY(LINESTRING, 4326),
  garmin_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, garmin_activity_id)
);

CREATE INDEX idx_garmin_activities_user_id ON garmin_activities(user_id);
CREATE INDEX idx_garmin_activities_start_time ON garmin_activities(start_time);
CREATE INDEX idx_garmin_activities_tracklog ON garmin_activities USING GIST(tracklog);

-- Garmin Daily Steps
CREATE TABLE IF NOT EXISTS garmin_daily_steps (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  step_count INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX idx_garmin_daily_steps_user_date ON garmin_daily_steps(user_id, date);

-- Garmin Daily Heart Rate
CREATE TABLE IF NOT EXISTS garmin_daily_heart_rate (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  min_heart_rate INTEGER,
  max_heart_rate INTEGER,
  resting_heart_rate INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX idx_garmin_daily_hr_user_date ON garmin_daily_heart_rate(user_id, date);

-- Garmin Daily Sleep
CREATE TABLE IF NOT EXISTS garmin_daily_sleep (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  sleep_duration_seconds INTEGER,
  sleep_score INTEGER,
  deep_sleep_seconds INTEGER,
  light_sleep_seconds INTEGER,
  rem_sleep_seconds INTEGER,
  awake_seconds INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX idx_garmin_daily_sleep_user_date ON garmin_daily_sleep(user_id, date);

INSERT INTO schema_migrations (version, name)
VALUES (6, '006_add_garmin_tables');
