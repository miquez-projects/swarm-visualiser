-- Track Strava API requests for rate limit management
-- Supports both 15-minute (100 req) and daily (1000 req) windows

CREATE TABLE strava_api_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  requested_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_strava_requests_time ON strava_api_requests(requested_at);
CREATE INDEX idx_strava_requests_user ON strava_api_requests(user_id, requested_at);

INSERT INTO schema_migrations (version, name)
VALUES (13, '013_create_strava_api_requests');
