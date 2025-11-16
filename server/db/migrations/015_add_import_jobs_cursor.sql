-- Add cursor tracking and retry scheduling to import_jobs
-- Enables resumable sync after rate limit pauses

ALTER TABLE import_jobs ADD COLUMN IF NOT EXISTS sync_cursor JSONB;
ALTER TABLE import_jobs ADD COLUMN IF NOT EXISTS retry_after TIMESTAMP;

-- Note: status is VARCHAR(50), so 'rate_limited' can be used without schema change

INSERT INTO schema_migrations (version, name)
VALUES (15, '015_add_import_jobs_cursor');
