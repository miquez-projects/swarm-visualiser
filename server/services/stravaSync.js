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

        const activities = await stravaOAuth.makeAuthenticatedRequest(
          encryptedTokens,
          '/athlete/activities',
          params
        );

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

      // Fetch detailed activity data for tracklog
      const detailedActivities = [];
      for (let i = 0; i < allActivities.length; i++) {
        const summary = allActivities[i];

        try {
          // Fetch detailed activity (includes full polyline)
          const detailed = await stravaOAuth.makeAuthenticatedRequest(
            encryptedTokens,
            `/activities/${summary.id}`
          );

          detailedActivities.push(detailed);

          if (onProgress && (i + 1) % 10 === 0) {
            await onProgress({
              fetched: allActivities.length,
              detailed: detailedActivities.length
            });
          }
        } catch (error) {
          console.error(`[STRAVA SYNC] Failed to fetch details for activity ${summary.id}:`, error.message);
          // Fall back to summary data if detail fetch fails
          detailedActivities.push(summary);
        }
      }

      // Transform and bulk insert
      const activitiesToInsert = detailedActivities.map(activity =>
        this.transformActivity(activity, userId)
      );

      // CRITICAL: Use bulkInsert return value, not array length
      const insertedCount = activitiesToInsert.length > 0
        ? await StravaActivity.bulkInsert(activitiesToInsert)
        : 0;

      console.log(`[STRAVA SYNC] Activity sync complete: ${insertedCount} imported, ${allActivities.length} fetched`);

      return { imported: insertedCount, fetched: allActivities.length };
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
          const photos = await stravaOAuth.makeAuthenticatedRequest(
            encryptedTokens,
            `/activities/${activity.strava_activity_id}/photos`,
            { size: 600 } // Get 600px size URLs
          );

          if (photos && photos.length > 0) {
            // Transform photos
            const photosToInsert = photos.map(photo => ({
              strava_activity_id: activity.id, // Internal DB ID
              strava_photo_id: photo.unique_id || photo.id,
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

    return {
      user_id: userId,
      strava_activity_id: String(activity.id),
      activity_type: this.mapActivityType(activity.type || activity.sport_type),
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
      tracklog,
      is_private: activity.private || false,
      kudos_count: activity.kudos_count || 0,
      comment_count: activity.comment_count || 0,
      photo_count: activity.total_photo_count || 0,
      achievement_count: activity.achievement_count || 0,
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
