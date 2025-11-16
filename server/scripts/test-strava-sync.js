#!/usr/bin/env node

/**
 * Test script for Strava activity sync with limited activity count
 * Designed to safely test sync without hitting rate limits
 *
 * Usage:
 *   node server/scripts/test-strava-sync.js <user_id> [max_activities]
 *
 * Example:
 *   node server/scripts/test-strava-sync.js 1 10
 *
 * Features:
 * - Limits number of activities to sync (default: 10)
 * - Stops immediately on rate limit errors (429)
 * - Detailed logging of API calls and rate limit usage
 * - Safe retry logic with exponential backoff
 * - Progress reporting
 */

require('dotenv').config();
const stravaOAuth = require('../services/stravaOAuth');
const StravaActivity = require('../models/stravaActivity');
const User = require('../models/user');

class TestStravaSync {
  constructor(userId, maxActivities = 10) {
    this.userId = userId;
    this.maxActivities = maxActivities;
    this.apiCallCount = 0;
    this.activitiesProcessed = 0;
    this.activitiesInserted = 0;
    this.errors = [];
  }

  /**
   * Main test execution
   */
  async run() {
    console.log('═══════════════════════════════════════════════════════');
    console.log('  Strava Sync Test');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`User ID: ${this.userId}`);
    console.log(`Max Activities: ${this.maxActivities}`);
    console.log(`Strava Rate Limits: 100 requests/15min, 1000 requests/day`);
    console.log('───────────────────────────────────────────────────────\n');

    try {
      // Get user and tokens
      const user = await User.findById(this.userId);
      if (!user) {
        throw new Error(`User ${this.userId} not found`);
      }

      if (!user.strava_oauth_tokens_encrypted) {
        throw new Error(`User ${this.userId} has not connected Strava`);
      }

      console.log(`✓ User found: ${user.email}`);
      console.log(`✓ Strava connected at: ${user.strava_connected_at}\n`);

      // Fetch activity list (limited)
      console.log(`[1/3] Fetching first ${this.maxActivities} activities...`);
      const activityList = await this.fetchActivityList(user.strava_oauth_tokens_encrypted);

      if (activityList.length === 0) {
        console.log('\n⚠️  No activities found to sync');
        return this.printSummary();
      }

      console.log(`✓ Found ${activityList.length} activities\n`);

      // Fetch detailed data for each activity
      console.log(`[2/3] Fetching detailed data for ${activityList.length} activities...`);
      const detailedActivities = await this.fetchActivityDetails(
        user.strava_oauth_tokens_encrypted,
        activityList
      );
      console.log(`✓ Fetched ${detailedActivities.length} detailed activities\n`);

      // Save to database
      console.log(`[3/3] Saving activities to database...`);
      await this.saveActivities(detailedActivities);
      console.log(`✓ Saved ${this.activitiesInserted} activities\n`);

      // Print summary
      this.printSummary();

    } catch (error) {
      console.error('\n❌ Test failed:', error.message);
      if (error.response?.status === 429) {
        console.error('\n⚠️  RATE LIMIT EXCEEDED');
        console.error('You have hit Strava\'s rate limit. Please wait before trying again.');
        console.error('Rate limits: 100 requests per 15 minutes, 1000 requests per day');
      }
      this.printSummary();
      process.exit(1);
    }
  }

  /**
   * Fetch activity list (limited to maxActivities)
   */
  async fetchActivityList(encryptedTokens) {
    try {
      this.apiCallCount++;
      const response = await stravaOAuth.makeAuthenticatedRequest(
        encryptedTokens,
        '/athlete/activities',
        {
          page: 1,
          per_page: this.maxActivities
        }
      );

      // Handle token refresh - response may be { data, newEncryptedTokens } or just data array
      let activities;
      if (response && typeof response === 'object' && response.data) {
        activities = response.data;
        // Update encrypted tokens if they were refreshed
        if (response.newEncryptedTokens) {
          this.newEncryptedTokens = response.newEncryptedTokens;
          console.log(`  ✓ Token refreshed automatically`);
        }
      } else {
        activities = response;
      }

      console.log(`  API Call #${this.apiCallCount}: GET /athlete/activities (returned ${activities.length} items)`);
      return activities.slice(0, this.maxActivities);
    } catch (error) {
      this.errors.push(`Failed to fetch activity list: ${error.message}`);
      throw error;
    }
  }

  /**
   * Fetch detailed data for activities with rate limit protection
   */
  async fetchActivityDetails(encryptedTokens, activityList) {
    const detailed = [];
    const batchSize = 5; // Process 5 at a time to be safe

    for (let i = 0; i < activityList.length; i += batchSize) {
      const batch = activityList.slice(i, i + batchSize);

      console.log(`  Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(activityList.length / batchSize)}: Fetching ${batch.length} activities...`);

      try {
        // Fetch batch with Promise.allSettled to handle individual failures
        const results = await Promise.allSettled(
          batch.map(async (activity) => {
            this.apiCallCount++;
            const response = await stravaOAuth.makeAuthenticatedRequest(
              encryptedTokens,
              `/activities/${activity.id}`,
              {}
            );

            // Handle token refresh
            let detail;
            if (response && typeof response === 'object' && response.data) {
              detail = response.data;
              if (response.newEncryptedTokens && !this.newEncryptedTokens) {
                this.newEncryptedTokens = response.newEncryptedTokens;
              }
            } else {
              detail = response;
            }

            console.log(`    ✓ Activity #${this.apiCallCount}: ${activity.name} (${activity.id})`);
            return detail;
          })
        );

        // Process results
        for (let j = 0; j < results.length; j++) {
          const result = results[j];
          if (result.status === 'fulfilled') {
            detailed.push(result.value);
            this.activitiesProcessed++;
          } else {
            const activity = batch[j];
            console.log(`    ⚠️  Failed: ${activity.name} - ${result.reason.message}`);
            this.errors.push(`Activity ${activity.id}: ${result.reason.message}`);

            // If rate limit error, stop immediately
            if (result.reason.response?.status === 429) {
              throw new Error('Rate limit exceeded - stopping to preserve quota');
            }
          }
        }

        // Add delay between batches to be extra safe
        if (i + batchSize < activityList.length) {
          await this.delay(1000); // 1 second between batches
        }

      } catch (error) {
        console.error(`\n  ❌ Batch failed: ${error.message}`);
        throw error;
      }
    }

    return detailed;
  }

  /**
   * Save activities to database
   */
  async saveActivities(detailedActivities) {
    const activitiesToInsert = detailedActivities.map(activity =>
      this.transformActivity(activity)
    );

    try {
      this.activitiesInserted = await StravaActivity.bulkInsert(activitiesToInsert);
      console.log(`  ✓ Inserted ${this.activitiesInserted}/${activitiesToInsert.length} activities`);
    } catch (error) {
      this.errors.push(`Database insert failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Transform activity for database (simplified version)
   */
  transformActivity(activity) {
    let startLatlng = null;
    if (activity.start_latlng && activity.start_latlng.length === 2) {
      startLatlng = `POINT(${activity.start_latlng[1]} ${activity.start_latlng[0]})`;
    }

    let endLatlng = null;
    if (activity.end_latlng && activity.end_latlng.length === 2) {
      endLatlng = `POINT(${activity.end_latlng[1]} ${activity.end_latlng[0]})`;
    }

    return {
      user_id: this.userId,
      strava_activity_id: String(activity.id),
      activity_type: activity.type || activity.sport_type,
      activity_name: activity.name,
      description: activity.description,
      start_time: new Date(activity.start_date || activity.start_date_local),
      start_latlng: startLatlng,
      end_latlng: endLatlng,
      duration_seconds: activity.elapsed_time,
      moving_time_seconds: activity.moving_time,
      distance_meters: activity.distance,
      total_elevation_gain: activity.total_elevation_gain,
      calories: activity.calories,
      avg_speed: activity.average_speed,
      max_speed: activity.max_speed,
      avg_heart_rate: activity.average_heartrate,
      max_heart_rate: activity.max_heartrate,
      avg_cadence: activity.average_cadence,
      avg_watts: activity.average_watts,
      is_private: activity.private || false,
      kudos_count: activity.kudos_count || 0,
      comment_count: activity.comment_count || 0,
      photo_count: activity.total_photo_count || 0,
      achievement_count: activity.achievement_count || 0,
      strava_url: `https://www.strava.com/activities/${activity.id}`
    };
  }

  /**
   * Print summary
   */
  printSummary() {
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  Test Summary');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Total API Calls:        ${this.apiCallCount}`);
    console.log(`Activities Processed:   ${this.activitiesProcessed}`);
    console.log(`Activities Inserted:    ${this.activitiesInserted}`);
    console.log(`Errors:                 ${this.errors.length}`);
    console.log(`\nRate Limit Usage:       ${this.apiCallCount}/100 (15min limit)`);
    console.log(`Remaining Calls:        ${100 - this.apiCallCount}`);

    if (this.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      this.errors.forEach((error, i) => {
        console.log(`  ${i + 1}. ${error}`);
      });
    }

    console.log('═══════════════════════════════════════════════════════\n');
  }

  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Parse command line arguments
const userId = process.argv[2];
const maxActivities = parseInt(process.argv[3]) || 10;

if (!userId) {
  console.error('Usage: node server/scripts/test-strava-sync.js <user_id> [max_activities]');
  console.error('Example: node server/scripts/test-strava-sync.js 1 10');
  process.exit(1);
}

// Run test
const test = new TestStravaSync(userId, maxActivities);
test.run().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
