-- Add Garmin daily calories table
CREATE TABLE IF NOT EXISTS garmin_daily_calories (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_calories INTEGER, -- Total calories burned (wellnessKilocalories)
  active_calories INTEGER, -- Calories from active exercise
  bmr_calories INTEGER, -- Base metabolic rate calories
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX idx_garmin_daily_calories_user_date ON garmin_daily_calories(user_id, date);

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_garmin_daily_calories_updated_at ON garmin_daily_calories;
CREATE TRIGGER update_garmin_daily_calories_updated_at
    BEFORE UPDATE ON garmin_daily_calories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

INSERT INTO schema_migrations (version, name)
VALUES (11, '011_add_garmin_daily_calories');
