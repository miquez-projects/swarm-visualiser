-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Checkins table
CREATE TABLE IF NOT EXISTS checkins (
    id SERIAL PRIMARY KEY,
    venue_id VARCHAR(255),
    venue_name TEXT NOT NULL,
    venue_category VARCHAR(255),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    location GEOGRAPHY(POINT, 4326),
    checkin_date TIMESTAMP NOT NULL,
    city VARCHAR(255),
    country VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_checkin_date ON checkins(checkin_date);
CREATE INDEX IF NOT EXISTS idx_country ON checkins(country);
CREATE INDEX IF NOT EXISTS idx_category ON checkins(venue_category);
CREATE INDEX IF NOT EXISTS idx_location ON checkins USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_city ON checkins(city);

-- Composite index for viewport-based queries
CREATE INDEX IF NOT EXISTS idx_user_lat_lng ON checkins(user_id, latitude, longitude);

-- Function to automatically create geography point from lat/lng
CREATE OR REPLACE FUNCTION update_location()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
        NEW.location = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update location before insert/update
DROP TRIGGER IF EXISTS set_location ON checkins;
CREATE TRIGGER set_location
    BEFORE INSERT OR UPDATE ON checkins
    FOR EACH ROW
    EXECUTE FUNCTION update_location();
