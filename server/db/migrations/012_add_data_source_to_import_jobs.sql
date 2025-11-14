-- Add data_source column to import_jobs table for universal sync progress tracking
-- This allows tracking imports from different sources: 'foursquare', 'strava', 'garmin', etc.

ALTER TABLE import_jobs ADD COLUMN IF NOT EXISTS data_source VARCHAR(50);

-- Create index for efficient queries filtering by user and data source
CREATE INDEX IF NOT EXISTS idx_import_jobs_user_data_source ON import_jobs(user_id, data_source);

INSERT INTO schema_migrations (version, name)
VALUES (12, '012_add_data_source_to_import_jobs');
