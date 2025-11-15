CREATE TABLE IF NOT EXISTS daily_weather (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  country VARCHAR(100) NOT NULL,
  region VARCHAR(100),
  temp_celsius DECIMAL(4, 1),
  condition VARCHAR(50),
  weather_icon VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(date, country, region)
);

CREATE INDEX idx_daily_weather_date_country ON daily_weather(date, country, region);

-- Create schema_migrations table if it doesn't exist
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  applied_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO schema_migrations (version, name)
VALUES (13, '013_add_daily_weather')
ON CONFLICT (version) DO NOTHING;
