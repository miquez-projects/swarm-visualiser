# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Strava rate-limited resumable sync** - Automatic handling of Strava API rate limits (100 req/15min, 1000 req/day)
  - Database-tracked API usage with proactive quota checks
  - Cursor-based sync position tracking for multi-day imports
  - Sequential request processing eliminates retry storms
  - Automatic retry scheduling via pg-boss delayed jobs
  - New 'rate_limited' job status for transparent UX
  - See design doc: `docs/plans/2025-01-16-strava-rate-limit-resumable-sync-design.md`

### Changed
- Strava sync now processes activity details sequentially instead of concurrently
- Removed exponential backoff retry logic from `stravaOAuth.js` (handled by sync service)
- Import jobs now track sync cursor and retry schedule

### Fixed
- Strava full historical imports no longer fail on rate limits
- Eliminated concurrent request retry storms
- Sync properly resumes from last position after rate limit pause
