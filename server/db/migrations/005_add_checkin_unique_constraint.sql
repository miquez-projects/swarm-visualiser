-- Migration: Add unique constraint to checkins table
-- Date: 2025-01-14
-- Description: Adds unique constraint on (user_id, venue_id, checkin_date) to prevent duplicate imports

-- First, check if there are any existing duplicates
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO duplicate_count
  FROM (
    SELECT user_id, venue_id, checkin_date, COUNT(*) as count
    FROM checkins
    GROUP BY user_id, venue_id, checkin_date
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_count > 0 THEN
    RAISE NOTICE 'Found % groups of duplicate check-ins. These will need to be resolved before adding constraint.', duplicate_count;
  ELSE
    RAISE NOTICE 'No duplicates found. Safe to add constraint.';
  END IF;
END $$;

-- Remove any duplicates, keeping the earliest record by ID
DELETE FROM checkins a
USING checkins b
WHERE a.id > b.id
  AND a.user_id = b.user_id
  AND a.venue_id = b.venue_id
  AND a.checkin_date = b.checkin_date;

-- Add unique constraint
ALTER TABLE checkins
ADD CONSTRAINT checkins_user_venue_date_unique
UNIQUE (user_id, venue_id, checkin_date);

-- Track migration
INSERT INTO migrations (name) VALUES ('005_add_checkin_unique_constraint.sql')
ON CONFLICT DO NOTHING;
