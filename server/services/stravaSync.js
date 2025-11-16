const stravaOAuth = require('./stravaOAuth');
const StravaActivity = require('../models/stravaActivity');
const StravaActivityPhoto = require('../models/stravaActivityPhoto');

class StravaSyncService {
  /**
   * Sync activities from Strava API
   * CRITICAL: Implements lessons learned from Foursquare/Garmin sync
   * - Only updates last_sync when items actually imported
   * - Uses bulkInsert return value, not array length
   * - 7-day lookback for incremental sync
   */
  async syncActivities(encryptedTokens, userId, afterDate = null, onProgress = null) {
    console.log(`[STRAVA SYNC] Starting activity sync for user ${userId}, afterDate: ${afterDate}`);

    const after = afterDate ? Math.floor(afterDate.getTime() / 1000) : null;

    let allActivities = [];
    let page = 1;
    const perPage = 200; // Strava max per page

    try {
      // Fetch activities in pages
      while (true) {
        const params = {
          page,
          per_page: perPage
        };

        if (after) {
          params.after = after;
        }

        const response = await stravaOAuth.makeAuthenticatedRequest(
          encryptedTokens,
          '/athlete/activities',
          params
        );

        // Handle token refresh - response may be {data, newEncryptedTokens} or just data array
        let activities;
        if (response && typeof response === 'object' && response.data) {
          activities = response.data;
          // Token was refreshed, but we don't need to update it here since it's passed by reference
        } else {
          activities = response;
        }

        if (!activities || activities.length === 0) {
          break;
        }

        allActivities = allActivities.concat(activities);
        page++;

        if (onProgress) {
          await onProgress({ fetched: allActivities.length });
        }

        // Safety limit
        if (allActivities.length >= 10000) {
          console.log(`[STRAVA SYNC] Reached safety limit`);
          break;
        }

        // No more results
        if (activities.length < perPage) {
          break;
        }
      }

      console.log(`[STRAVA SYNC] Fetched ${allActivities.length} activities from API`);

      // Fetch detailed data for each activity (to get full polyline)
      // CRITICAL: Insert activities incrementally to preserve progress on failures
      console.log(`[STRAVA SYNC] Fetching and saving ${allActivities.length} activities in batches...`);
      const batchSize = 10; // Process 10 at a time to respect rate limits
      const insertBatchSize = 50; // Insert every 50 activities
      let totalInserted = 0;
      const detailedActivities = [];

      for (let i = 0; i < allActivities.length; i += batchSize) {
        const batch = allActivities.slice(i, i + batchSize);

        // Fetch batch concurrently
        const detailedResults = await Promise.allSettled(
          batch.map(summary =>
            stravaOAuth.makeAuthenticatedRequest(
              encryptedTokens,
              `/activities/${summary.id}`,
              {}
            )
          )
        );

        // Process results and collect detailed activities
        detailedResults.forEach((result, batchIndex) => {
          if (result.status === 'fulfilled') {
            // Handle token refresh - response may be {data, newEncryptedTokens} or just data
            let activity;
            if (result.value && typeof result.value === 'object' && result.value.data) {
              activity = result.value.data;
            } else {
              activity = result.value;
            }
            detailedActivities.push(activity);
          } else {
            console.log(`[STRAVA SYNC] Failed to fetch details for activity ${batch[batchIndex].id}, using summary data`);
            // Use summary data if detail fetch fails
            detailedActivities.push(batch[batchIndex]);
          }
        });

        // Insert every insertBatchSize activities to preserve progress
        if (detailedActivities.length >= insertBatchSize) {
          const activitiesToInsert = detailedActivities.map(activity =>
            this.transformActivity(activity, userId)
          );

          const insertedCount = await StravaActivity.bulkInsert(activitiesToInsert);
          totalInserted += insertedCount;

          console.log(`[STRAVA SYNC] Batch saved: ${insertedCount}/${activitiesToInsert.length} activities (total: ${totalInserted})`);

          // Clear the batch and report progress
          detailedActivities.length = 0;

          if (onProgress) {
            await onProgress({
              detailed: i + batchSize,
              fetched: allActivities.length,
              inserted: totalInserted
            });
          }
        }
      }

      // Insert any remaining activities
      if (detailedActivities.length > 0) {
        const activitiesToInsert = detailedActivities.map(activity =>
          this.transformActivity(activity, userId)
        );

        const insertedCount = await StravaActivity.bulkInsert(activitiesToInsert);
        totalInserted += insertedCount;

        console.log(`[STRAVA SYNC] Final batch saved: ${insertedCount}/${activitiesToInsert.length} activities`);
      }

      console.log(`[STRAVA SYNC] Activity sync complete: ${totalInserted} imported, ${allActivities.length} fetched`);

      return { imported: totalInserted, fetched: allActivities.length };
    } catch (error) {
      console.error(`[STRAVA SYNC] Activity sync error:`, error.message);
      throw error;
    }
  }

  /**
   * Sync activity photos for mapped activities
   */
  async syncActivityPhotos(encryptedTokens, userId, activityIds = null, onProgress = null) {
    console.log(`[STRAVA SYNC] Starting photo sync for user ${userId}`);

    try {
      // Get activities with photos
      let activitiesWithPhotos;
      if (activityIds && activityIds.length > 0) {
        // Sync specific activities
        activitiesWithPhotos = [];
        for (const id of activityIds) {
          const activity = await StravaActivity.findById(id);
          if (activity && activity.photo_count > 0) {
            activitiesWithPhotos.push(activity);
          }
        }
      } else {
        // Sync all activities with photos
        activitiesWithPhotos = await StravaActivity.findActivitiesWithPhotos(userId);
      }

      console.log(`[STRAVA SYNC] Found ${activitiesWithPhotos.length} activities with photos`);

      let totalPhotosInserted = 0;

      for (let i = 0; i < activitiesWithPhotos.length; i++) {
        const activity = activitiesWithPhotos[i];

        try {
          // Fetch photos for this activity
          const response = await stravaOAuth.makeAuthenticatedRequest(
            encryptedTokens,
            `/activities/${activity.strava_activity_id}/photos`,
            { size: 600 } // Get 600px size URLs
          );

          // Handle token refresh - response may be {data, newEncryptedTokens} or just data
          let photos;
          if (response && typeof response === 'object' && response.data) {
            photos = response.data;
          } else {
            photos = response;
          }

          if (photos && photos.length > 0) {
            console.log(`[STRAVA SYNC] Sample photo from API:`, JSON.stringify(photos[0], null, 2));

            // Transform photos
            const photosToInsert = photos.map(photo => ({
              strava_activity_id: activity.id, // Internal DB ID
              strava_photo_id: String(photo.id), // Use photo.id (numeric), not unique_id (UUID)
              photo_url_full: photo.urls?.['600'] || photo.urls?.[0],
              photo_url_600: photo.urls?.['600'],
              photo_url_300: photo.urls?.['300'],
              caption: photo.caption,
              location: photo.location && photo.location.length === 2
                ? `POINT(${photo.location[1]} ${photo.location[0]})`
                : null,
              created_at_strava: photo.created_at ? new Date(photo.created_at) : null
            }));

            const insertedCount = await StravaActivityPhoto.bulkInsert(photosToInsert);
            totalPhotosInserted += insertedCount;

            console.log(`[STRAVA SYNC] Activity ${activity.strava_activity_id}: ${insertedCount}/${photos.length} photos inserted`);
          }

          if (onProgress && (i + 1) % 5 === 0) {
            await onProgress({
              activitiesProcessed: i + 1,
              totalActivities: activitiesWithPhotos.length,
              photosInserted: totalPhotosInserted
            });
          }
        } catch (error) {
          console.error(`[STRAVA SYNC] Failed to fetch photos for activity ${activity.strava_activity_id}:`, error.message);
        }
      }

      console.log(`[STRAVA SYNC] Photo sync complete: ${totalPhotosInserted} photos inserted`);

      return {
        activitiesProcessed: activitiesWithPhotos.length,
        photosInserted: totalPhotosInserted
      };
    } catch (error) {
      console.error(`[STRAVA SYNC] Photo sync error:`, error.message);
      throw error;
    }
  }

  /**
   * Full historical sync
   */
  async fullHistoricalSync(encryptedTokens, userId, yearsBack = 5, onProgress = null) {
    const today = new Date();
    const startDate = new Date();
    startDate.setFullYear(today.getFullYear() - yearsBack);

    console.log(`[STRAVA SYNC] Full historical sync from ${startDate.toISOString().split('T')[0]}`);

    // Sync activities
    const activityResult = await this.syncActivities(encryptedTokens, userId, startDate, onProgress);

    // Sync photos for activities with photos
    const photoResult = await this.syncActivityPhotos(encryptedTokens, userId, null, onProgress);

    return {
      success: true,
      activities: activityResult,
      photos: photoResult
    };
  }

  /**
   * Incremental sync with 7-day lookback
   * CRITICAL: Goes back 7 days to catch missed data
   */
  async incrementalSync(encryptedTokens, userId, lastSyncDate, onProgress = null) {
    const startDate = lastSyncDate ? new Date(lastSyncDate) : new Date();
    startDate.setDate(startDate.getDate() - 7); // CRITICAL: 7-day lookback

    console.log(`[STRAVA SYNC] Incremental sync from ${startDate.toISOString().split('T')[0]}`);

    // Sync activities
    const activityResult = await this.syncActivities(encryptedTokens, userId, startDate, onProgress);

    // Sync photos for newly imported activities
    const photoResult = await this.syncActivityPhotos(encryptedTokens, userId, null, onProgress);

    return {
      success: true,
      activities: activityResult,
      photos: photoResult
    };
  }

  /**
   * Transform Strava activity to database format
   */
  transformActivity(activity, userId) {
    // Build tracklog if polyline exists
    let tracklog = null;
    if (activity.map?.polyline) {
      // Use detailed polyline if available
      const coords = this.decodePolyline(activity.map.polyline);
      if (coords.length > 0) {
        const lineString = coords
          .map(([lat, lon]) => `${lon} ${lat}`)
          .join(',');
        tracklog = `LINESTRING(${lineString})`;
      }
    } else if (activity.map?.summary_polyline) {
      // Fall back to summary polyline
      const coords = this.decodePolyline(activity.map.summary_polyline);
      if (coords.length > 0) {
        const lineString = coords
          .map(([lat, lon]) => `${lon} ${lat}`)
          .join(',');
        tracklog = `LINESTRING(${lineString})`;
      }
    }

    // Build start/end latlng
    let startLatlng = null;
    if (activity.start_latlng && activity.start_latlng.length === 2) {
      startLatlng = `POINT(${activity.start_latlng[1]} ${activity.start_latlng[0]})`;
    }

    let endLatlng = null;
    if (activity.end_latlng && activity.end_latlng.length === 2) {
      endLatlng = `POINT(${activity.end_latlng[1]} ${activity.end_latlng[0]})`;
    }

    // Helper function to safely convert to integer (Strava returns decimals for some integer fields)
    const toInt = (value) => value != null ? Math.round(value) : null;

    return {
      user_id: userId,
      strava_activity_id: String(activity.id),
      activity_type: this.mapActivityType(activity.type || activity.sport_type),
      activity_name: activity.name,
      description: activity.description,
      start_time: new Date(activity.start_date || activity.start_date_local),
      start_latlng: startLatlng,
      end_latlng: endLatlng,
      duration_seconds: toInt(activity.elapsed_time),
      moving_time_seconds: toInt(activity.moving_time),
      distance_meters: activity.distance,
      total_elevation_gain: activity.total_elevation_gain,
      calories: toInt(activity.calories),
      avg_speed: activity.average_speed,
      max_speed: activity.max_speed,
      avg_heart_rate: toInt(activity.average_heartrate),
      max_heart_rate: toInt(activity.max_heartrate),
      avg_cadence: activity.average_cadence,
      avg_watts: activity.average_watts,
      tracklog,
      is_private: activity.private || false,
      kudos_count: toInt(activity.kudos_count) || 0,
      comment_count: toInt(activity.comment_count) || 0,
      photo_count: toInt(activity.total_photo_count) || 0,
      achievement_count: toInt(activity.achievement_count) || 0,
      strava_url: `https://www.strava.com/activities/${activity.id}`
    };
  }

  /**
   * Map Strava activity types to internal types
   */
  mapActivityType(stravaType) {
    const typeMap = {
      'Run': 'Running',
      'Ride': 'Cycling',
      'Swim': 'Swimming',
      'Walk': 'Walking',
      'Hike': 'Hiking',
      'AlpineSki': 'Skiing',
      'BackcountrySki': 'Skiing',
      'NordicSki': 'Skiing',
      'Snowboard': 'Snowboarding',
      'IceSkate': 'Ice Skating',
      'InlineSkate': 'Inline Skating',
      'Workout': 'Gym',
      'WeightTraining': 'Strength',
      'Yoga': 'Yoga',
      'Elliptical': 'Elliptical',
      'StairStepper': 'Stair Stepper',
      'Rowing': 'Rowing',
      'RockClimbing': 'Rock Climbing',
      'Canoeing': 'Canoeing',
      'Kayaking': 'Kayaking',
      'Surfing': 'Surfing',
      'Snowshoe': 'Snowshoeing',
      'Soccer': 'Soccer',
      'Golf': 'Golf',
      'Tennis': 'Tennis',
      'Badminton': 'Badminton',
      'Squash': 'Squash',
      'Pickleball': 'Pickleball',
      'VirtualRide': 'Virtual Cycling',
      'VirtualRun': 'Virtual Running',
      'EMountainBikeRide': 'E-Mountain Biking',
      'EBikeRide': 'E-Biking',
      'Velomobile': 'Velomobile',
      'Handcycle': 'Handcycle',
      'Wheelchair': 'Wheelchair',
      'Crossfit': 'CrossFit',
      'HighIntensityIntervalTraining': 'HIIT',
      'Pilates': 'Pilates'
    };

    return typeMap[stravaType] || stravaType;
  }

  /**
   * Decode Google polyline format (same as Garmin)
   * Strava uses Google's polyline encoding algorithm
   */
  decodePolyline(encoded) {
    const coords = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
      let b, shift = 0, result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      coords.push([lat / 1e5, lng / 1e5]);
    }

    return coords;
  }

  getDefaultStartDate() {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 5);
    return date;
  }
}

module.exports = new StravaSyncService();
