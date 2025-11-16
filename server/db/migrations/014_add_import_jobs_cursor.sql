-- Add cursor tracking and retry scheduling to import_jobs
-- Enables resumable sync after rate limit pauses

ALTER TABLE import_jobs ADD COLUMN sync_cursor JSONB;
ALTER TABLE import_jobs ADD COLUMN retry_after TIMESTAMP;

-- Add 'rate_limited' to status enum
ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'rate_limited';

INSERT INTO schema_migrations (version, name)
VALUES (14, '014_add_import_jobs_cursor');
