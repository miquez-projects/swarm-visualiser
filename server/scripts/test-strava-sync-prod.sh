#!/bin/bash

# Test Strava sync script for PRODUCTION database
# This runs locally but connects to production database
#
# Usage:
#   ./server/scripts/test-strava-sync-prod.sh [max_activities]
#
# Example:
#   ./server/scripts/test-strava-sync-prod.sh 10

set -e

MAX_ACTIVITIES=${1:-10}

echo "════════════════════════════════════════════════════════"
echo "  Strava Sync Test - PRODUCTION DATABASE"
echo "════════════════════════════════════════════════════════"
echo ""
echo "⚠️  WARNING: This will sync to PRODUCTION database"
echo ""
echo "Max activities: $MAX_ACTIVITIES"
echo ""
read -p "Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

# Check if we have production DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL not set"
    echo ""
    echo "You need to set your production DATABASE_URL:"
    echo ""
    echo "  export DATABASE_URL='your-production-database-url'"
    echo ""
    echo "You can get this from:"
    echo "  1. Render dashboard > Database > Connection String (External)"
    echo "  2. Or from your .env.production file"
    exit 1
fi

# Check if Strava credentials are set
if [ -z "$STRAVA_CLIENT_ID" ] || [ -z "$STRAVA_CLIENT_SECRET" ]; then
    echo "❌ ERROR: Strava credentials not set"
    echo ""
    echo "You need to set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET:"
    echo ""
    echo "  export STRAVA_CLIENT_ID='your-client-id'"
    echo "  export STRAVA_CLIENT_SECRET='your-client-secret'"
    exit 1
fi

echo ""
echo "Using DATABASE_URL: ${DATABASE_URL:0:30}..."
echo ""

# Get user ID from production database
echo "Fetching user ID from production database..."
USER_ID=$(psql "$DATABASE_URL" -t -c "SELECT id FROM users WHERE strava_oauth_tokens_encrypted IS NOT NULL LIMIT 1;" | tr -d ' ')

if [ -z "$USER_ID" ]; then
    echo "❌ ERROR: No user with Strava connected found in database"
    exit 1
fi

echo "✓ Found user ID: $USER_ID"
echo ""

# Run the test script
echo "Running sync..."
echo ""
node server/scripts/test-strava-sync.js "$USER_ID" "$MAX_ACTIVITIES"
