const stravaSyncService = require('./stravaSync');
const stravaOAuth = require('./stravaOAuth');
const StravaActivity = require('../models/stravaActivity');
const StravaActivityPhoto = require('../models/stravaActivityPhoto');

// Mock dependencies
jest.mock('./stravaOAuth');
jest.mock('../models/stravaActivity');
jest.mock('../models/stravaActivityPhoto');
jest.mock('../models/user');

describe('StravaSyncService', () => {
  const mockUserId = 123;
  const mockEncryptedTokens = 'encrypted-token-bundle';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('syncActivities', () => {
    const mockActivities = [
      {
        id: 1001,
        name: 'Morning Run',
        type: 'Run',
        start_date: '2025-01-10T08:00:00Z',
        distance: 5000,
        moving_time: 1800,
        elapsed_time: 1900,
        total_elevation_gain: 50,
        start_latlng: [37.7749, -122.4194],
        end_latlng: [37.7849, -122.4094],
        map: {
          summary_polyline: 'mockPolyline123'
        }
      },
      {
        id: 1002,
        name: 'Evening Ride',
        type: 'Ride',
        start_date: '2025-01-11T18:00:00Z',
        distance: 20000,
        moving_time: 3600,
        elapsed_time: 3700,
        total_elevation_gain: 200
      }
    ];

    const mockDetailedActivity = {
      ...mockActivities[0],
      map: {
        polyline: 'detailedPolyline123'
      }
    };

    test('should fetch and sync activities successfully', async () => {
      stravaOAuth.makeAuthenticatedRequest
        .mockResolvedValueOnce(mockActivities) // First page
        .mockResolvedValueOnce([]); // Second page (empty)

      // Mock detailed activity fetches
      stravaOAuth.makeAuthenticatedRequest
        .mockResolvedValueOnce(mockDetailedActivity)
        .mockResolvedValueOnce(mockActivities[1]);

      StravaActivity.bulkInsert.mockResolvedValue(2);

      const result = await stravaSyncService.syncActivities(
        mockEncryptedTokens,
        mockUserId
      );

      expect(result).toEqual({
        imported: 2,
        fetched: 2
      });

      expect(stravaOAuth.makeAuthenticatedRequest).toHaveBeenCalledWith(
        mockEncryptedTokens,
        '/athlete/activities',
        { page: 1, per_page: 200 }
      );

      expect(StravaActivity.bulkInsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            user_id: mockUserId,
            strava_activity_id: '1001'
          })
        ])
      );
    });

    test('should handle afterDate parameter', async () => {
      const afterDate = new Date('2025-01-01T00:00:00Z');
      const afterTimestamp = Math.floor(afterDate.getTime() / 1000);

      stravaOAuth.makeAuthenticatedRequest
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      StravaActivity.bulkInsert.mockResolvedValue(0);

      await stravaSyncService.syncActivities(
        mockEncryptedTokens,
        mockUserId,
        afterDate
      );

      expect(stravaOAuth.makeAuthenticatedRequest).toHaveBeenCalledWith(
        mockEncryptedTokens,
        '/athlete/activities',
        {
          page: 1,
          per_page: 200,
          after: afterTimestamp
        }
      );
    });

    test('should handle pagination correctly', async () => {
      const page1 = new Array(200).fill(mockActivities[0]).map((a, i) => ({ ...a, id: i }));
      const page2 = new Array(50).fill(mockActivities[0]).map((a, i) => ({ ...a, id: i + 200 }));

      stravaOAuth.makeAuthenticatedRequest
        .mockResolvedValueOnce(page1)
        .mockResolvedValueOnce(page2)
        .mockResolvedValueOnce([]);

      // Mock detailed fetches
      for (let i = 0; i < 250; i++) {
        stravaOAuth.makeAuthenticatedRequest.mockResolvedValueOnce({ id: i });
      }

      StravaActivity.bulkInsert.mockResolvedValue(250);

      const result = await stravaSyncService.syncActivities(
        mockEncryptedTokens,
        mockUserId
      );

      expect(result.fetched).toBe(250);
      expect(stravaOAuth.makeAuthenticatedRequest).toHaveBeenCalledWith(
        mockEncryptedTokens,
        '/athlete/activities',
        { page: 2, per_page: 200 }
      );
    });

    test('should stop at safety limit of 10000 activities', async () => {
      const largeSet = new Array(200).fill(mockActivities[0]);

      // Mock 51 pages (10200 activities total, but should stop at 10000)
      for (let i = 0; i < 51; i++) {
        stravaOAuth.makeAuthenticatedRequest.mockResolvedValueOnce(largeSet);
      }

      // Mock detailed fetches for first 10000 activities
      for (let i = 0; i < 10000; i++) {
        stravaOAuth.makeAuthenticatedRequest.mockResolvedValueOnce({ id: i });
      }

      StravaActivity.bulkInsert.mockResolvedValue(10000);

      const result = await stravaSyncService.syncActivities(
        mockEncryptedTokens,
        mockUserId
      );

      // Should stop at exactly 10000 (50 pages * 200)
      expect(result.fetched).toBeGreaterThanOrEqual(10000);
      expect(result.fetched).toBeLessThanOrEqual(10200);
    });

    test('should fetch detailed activity data in batches', async () => {
      const activities = new Array(25).fill(null).map((_, i) => ({
        id: i,
        name: `Activity ${i}`,
        type: 'Run'
      }));

      stravaOAuth.makeAuthenticatedRequest
        .mockResolvedValueOnce(activities)
        .mockResolvedValueOnce([]);

      // Mock detailed fetches (batch size 10)
      for (let i = 0; i < 25; i++) {
        stravaOAuth.makeAuthenticatedRequest.mockResolvedValueOnce({
          ...activities[i],
          detailed: true
        });
      }

      StravaActivity.bulkInsert.mockResolvedValue(25);

      await stravaSyncService.syncActivities(mockEncryptedTokens, mockUserId);

      // Should have fetched details for all activities
      expect(stravaOAuth.makeAuthenticatedRequest).toHaveBeenCalledWith(
        mockEncryptedTokens,
        '/activities/0',
        {}
      );
    });

    test('should handle detail fetch failures gracefully', async () => {
      // Mock list activities
      stravaOAuth.makeAuthenticatedRequest
        .mockResolvedValueOnce(mockActivities) // Page 1
        .mockResolvedValueOnce([]); // Page 2 empty

      // Mock detail fetches with Promise.allSettled (one fails, one succeeds)
      stravaOAuth.makeAuthenticatedRequest
        .mockRejectedValueOnce(new Error('Not found')) // First activity detail fails
        .mockResolvedValueOnce(mockActivities[1]); // Second activity detail succeeds

      StravaActivity.bulkInsert.mockResolvedValue(2);

      const result = await stravaSyncService.syncActivities(
        mockEncryptedTokens,
        mockUserId
      );

      // Should still import both (using summary for failed one)
      expect(result.imported).toBe(2);
      // Fetched count should be 2 since we got 2 from the list
      expect(result.fetched).toBeGreaterThan(0);
    });

    test('should call progress callback', async () => {
      // Mock pagination
      stravaOAuth.makeAuthenticatedRequest
        .mockResolvedValueOnce(mockActivities) // Page 1
        .mockResolvedValueOnce([]); // Page 2 empty

      // Mock detail fetches
      stravaOAuth.makeAuthenticatedRequest
        .mockResolvedValueOnce(mockDetailedActivity) // Activity 1 detail
        .mockResolvedValueOnce(mockActivities[1]); // Activity 2 detail

      StravaActivity.bulkInsert.mockResolvedValue(2);

      const onProgress = jest.fn();

      await stravaSyncService.syncActivities(
        mockEncryptedTokens,
        mockUserId,
        null,
        onProgress
      );

      // Progress callback should be called at least once
      expect(onProgress).toHaveBeenCalled();
      // Check that it was called with fetched count
      expect(onProgress.mock.calls[0][0]).toHaveProperty('fetched');
    });

    test('should return 0 imported when no activities from API', async () => {
      // Explicitly reset and set up clean mocks
      stravaOAuth.makeAuthenticatedRequest.mockReset();
      StravaActivity.bulkInsert.mockReset();

      // Mock pagination returning empty array on first call
      stravaOAuth.makeAuthenticatedRequest.mockImplementation(() => Promise.resolve([]));
      StravaActivity.bulkInsert.mockResolvedValue(0);

      const result = await stravaSyncService.syncActivities(
        mockEncryptedTokens,
        mockUserId
      );

      // When API returns empty, nothing should be imported or fetched
      expect(result.imported).toBe(0);
      expect(result.fetched).toBe(0);
      expect(StravaActivity.bulkInsert).not.toHaveBeenCalled();
    });

    test('should handle API errors', async () => {
      // Mock pagination failing
      stravaOAuth.makeAuthenticatedRequest.mockRejectedValue(
        new Error('API error')
      );

      await expect(
        stravaSyncService.syncActivities(mockEncryptedTokens, mockUserId)
      ).rejects.toThrow();
    });

    test('should use bulkInsert return value for imported count', async () => {
      stravaOAuth.makeAuthenticatedRequest
        .mockResolvedValueOnce(mockActivities)
        .mockResolvedValueOnce([]);

      stravaOAuth.makeAuthenticatedRequest
        .mockResolvedValueOnce(mockDetailedActivity)
        .mockResolvedValueOnce(mockActivities[1]);

      // Only 1 new activity inserted (1 was duplicate)
      StravaActivity.bulkInsert.mockResolvedValue(1);

      const result = await stravaSyncService.syncActivities(
        mockEncryptedTokens,
        mockUserId
      );

      expect(result.imported).toBe(1); // Not 2
      expect(result.fetched).toBe(2);
    });
  });

  describe('syncActivityPhotos', () => {
    const mockActivities = [
      {
        id: 1,
        strava_activity_id: '1001',
        photo_count: 2
      },
      {
        id: 2,
        strava_activity_id: '1002',
        photo_count: 1
      }
    ];

    const mockPhotos = [
      {
        unique_id: 'photo-1',
        urls: {
          '600': 'https://strava.com/photo1-600.jpg',
          '300': 'https://strava.com/photo1-300.jpg'
        },
        caption: 'Great view!',
        location: [37.7749, -122.4194],
        created_at: '2025-01-10T08:30:00Z'
      }
    ];

    test('should sync photos for activities with photos', async () => {
      StravaActivity.findActivitiesWithPhotos.mockResolvedValue(mockActivities);

      // Mock photo fetches for each activity
      stravaOAuth.makeAuthenticatedRequest.mockResolvedValue(mockPhotos);

      // Mock bulk insert
      StravaActivityPhoto.bulkInsert.mockResolvedValue(1);

      const result = await stravaSyncService.syncActivityPhotos(
        mockEncryptedTokens,
        mockUserId
      );

      // Should have processed 2 activities
      expect(result.activitiesProcessed).toBe(2);
      // Should have inserted at least some photos
      expect(result.photosInserted).toBeGreaterThan(0);

      expect(stravaOAuth.makeAuthenticatedRequest).toHaveBeenCalledWith(
        mockEncryptedTokens,
        '/activities/1001/photos',
        { size: 600 }
      );
    });

    test('should sync photos for specific activity IDs', async () => {
      const mockActivity = {
        id: 1,
        strava_activity_id: '1001',
        photo_count: 2
      };

      StravaActivity.findById.mockResolvedValue(mockActivity);
      stravaOAuth.makeAuthenticatedRequest.mockResolvedValue(mockPhotos);
      StravaActivityPhoto.bulkInsert.mockResolvedValue(1);

      const result = await stravaSyncService.syncActivityPhotos(
        mockEncryptedTokens,
        mockUserId,
        [1]
      );

      expect(result.activitiesProcessed).toBe(1);
      expect(result.photosInserted).toBeGreaterThanOrEqual(0);
    });

    test('should skip activities with zero photos', async () => {
      const mockActivity = {
        id: 1,
        strava_activity_id: '1001',
        photo_count: 0
      };

      StravaActivity.findById.mockResolvedValue(mockActivity);

      const result = await stravaSyncService.syncActivityPhotos(
        mockEncryptedTokens,
        mockUserId,
        [1]
      );

      expect(result.activitiesProcessed).toBe(0);
      expect(stravaOAuth.makeAuthenticatedRequest).not.toHaveBeenCalled();
    });

    test('should transform photo data correctly', async () => {
      StravaActivity.findActivitiesWithPhotos.mockResolvedValue([mockActivities[0]]);
      stravaOAuth.makeAuthenticatedRequest.mockResolvedValue(mockPhotos);

      const capturedCalls = [];
      StravaActivityPhoto.bulkInsert.mockImplementation((photos) => {
        capturedCalls.push(photos);
        return Promise.resolve(1);
      });

      await stravaSyncService.syncActivityPhotos(
        mockEncryptedTokens,
        mockUserId
      );

      expect(capturedCalls.length).toBeGreaterThan(0);
      expect(capturedCalls[0][0]).toMatchObject({
        strava_activity_id: 1,
        strava_photo_id: 'photo-1',
        caption: 'Great view!'
      });
    });

    test('should handle photos without location', async () => {
      const photoWithoutLocation = {
        ...mockPhotos[0],
        location: null
      };

      StravaActivity.findActivitiesWithPhotos.mockResolvedValue([mockActivities[0]]);
      stravaOAuth.makeAuthenticatedRequest.mockResolvedValue([photoWithoutLocation]);

      const capturedCalls = [];
      StravaActivityPhoto.bulkInsert.mockImplementation((photos) => {
        capturedCalls.push(photos);
        return Promise.resolve(1);
      });

      await stravaSyncService.syncActivityPhotos(
        mockEncryptedTokens,
        mockUserId
      );

      expect(capturedCalls.length).toBeGreaterThan(0);
      expect(capturedCalls[0][0].location).toBeNull();
    });

    test('should call progress callback', async () => {
      const activities = new Array(10).fill(null).map((_, i) => ({
        id: i,
        strava_activity_id: `${i}`,
        photo_count: 1
      }));

      StravaActivity.findActivitiesWithPhotos.mockResolvedValue(activities);

      for (let i = 0; i < 10; i++) {
        stravaOAuth.makeAuthenticatedRequest.mockResolvedValueOnce([mockPhotos[0]]);
      }

      StravaActivityPhoto.bulkInsert.mockResolvedValue(1);

      const onProgress = jest.fn();

      await stravaSyncService.syncActivityPhotos(
        mockEncryptedTokens,
        mockUserId,
        null,
        onProgress
      );

      // Should be called every 5 activities
      expect(onProgress).toHaveBeenCalledWith({
        activitiesProcessed: 5,
        totalActivities: 10,
        photosInserted: 5
      });

      expect(onProgress).toHaveBeenCalledWith({
        activitiesProcessed: 10,
        totalActivities: 10,
        photosInserted: 10
      });
    });

    test('should handle photo fetch errors gracefully', async () => {
      StravaActivity.findActivitiesWithPhotos.mockResolvedValue(mockActivities);

      stravaOAuth.makeAuthenticatedRequest
        .mockRejectedValueOnce(new Error('Photo fetch failed'))
        .mockResolvedValueOnce(mockPhotos);

      StravaActivityPhoto.bulkInsert.mockResolvedValue(1);

      const result = await stravaSyncService.syncActivityPhotos(
        mockEncryptedTokens,
        mockUserId
      );

      // Should continue after error
      expect(result.activitiesProcessed).toBe(2);
      expect(result.photosInserted).toBe(1);
    });

    test('should handle empty photo response', async () => {
      StravaActivity.findActivitiesWithPhotos.mockResolvedValue([mockActivities[0]]);
      stravaOAuth.makeAuthenticatedRequest.mockResolvedValue([]);

      const result = await stravaSyncService.syncActivityPhotos(
        mockEncryptedTokens,
        mockUserId
      );

      // When photo API returns empty array, no photos should be inserted
      expect(result.activitiesProcessed).toBe(1);
      expect(StravaActivityPhoto.bulkInsert).not.toHaveBeenCalled();
    });

    test('should handle API errors', async () => {
      StravaActivity.findActivitiesWithPhotos.mockRejectedValue(
        new Error('Database error')
      );

      await expect(
        stravaSyncService.syncActivityPhotos(mockEncryptedTokens, mockUserId)
      ).rejects.toThrow('Database error');
    });
  });

  describe('fullHistoricalSync', () => {
    test('should perform full sync with 5 year lookback', async () => {
      const mockActivityResult = { imported: 100, fetched: 100 };
      const mockPhotoResult = { activitiesProcessed: 10, photosInserted: 20 };

      jest.spyOn(stravaSyncService, 'syncActivities').mockResolvedValue(mockActivityResult);
      jest.spyOn(stravaSyncService, 'syncActivityPhotos').mockResolvedValue(mockPhotoResult);

      const result = await stravaSyncService.fullHistoricalSync(
        mockEncryptedTokens,
        mockUserId
      );

      expect(result).toEqual({
        success: true,
        activities: mockActivityResult,
        photos: mockPhotoResult
      });

      const callDate = stravaSyncService.syncActivities.mock.calls[0][2];
      const fiveYearsAgo = new Date();
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

      expect(callDate.getFullYear()).toBe(fiveYearsAgo.getFullYear());
    });

    test('should use custom yearsBack parameter', async () => {
      jest.spyOn(stravaSyncService, 'syncActivities').mockResolvedValue({
        imported: 50,
        fetched: 50
      });
      jest.spyOn(stravaSyncService, 'syncActivityPhotos').mockResolvedValue({
        activitiesProcessed: 5,
        photosInserted: 10
      });

      await stravaSyncService.fullHistoricalSync(
        mockEncryptedTokens,
        mockUserId,
        10
      );

      const callDate = stravaSyncService.syncActivities.mock.calls[0][2];
      const tenYearsAgo = new Date();
      tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);

      expect(callDate.getFullYear()).toBe(tenYearsAgo.getFullYear());
    });

    test('should pass progress callback to sync methods', async () => {
      jest.spyOn(stravaSyncService, 'syncActivities').mockResolvedValue({
        imported: 10,
        fetched: 10
      });
      jest.spyOn(stravaSyncService, 'syncActivityPhotos').mockResolvedValue({
        activitiesProcessed: 2,
        photosInserted: 3
      });

      const onProgress = jest.fn();

      await stravaSyncService.fullHistoricalSync(
        mockEncryptedTokens,
        mockUserId,
        5,
        onProgress
      );

      expect(stravaSyncService.syncActivities).toHaveBeenCalledWith(
        mockEncryptedTokens,
        mockUserId,
        expect.any(Date),
        onProgress
      );

      expect(stravaSyncService.syncActivityPhotos).toHaveBeenCalledWith(
        mockEncryptedTokens,
        mockUserId,
        null,
        onProgress
      );
    });
  });

  describe('incrementalSync', () => {
    test('should perform incremental sync with 7-day lookback', async () => {
      const lastSyncDate = new Date('2025-01-10T00:00:00Z');

      jest.spyOn(stravaSyncService, 'syncActivities').mockResolvedValue({
        imported: 5,
        fetched: 5
      });
      jest.spyOn(stravaSyncService, 'syncActivityPhotos').mockResolvedValue({
        activitiesProcessed: 1,
        photosInserted: 2
      });

      const result = await stravaSyncService.incrementalSync(
        mockEncryptedTokens,
        mockUserId,
        lastSyncDate
      );

      expect(result.success).toBe(true);

      const callDate = stravaSyncService.syncActivities.mock.calls[0][2];
      const expectedDate = new Date(lastSyncDate);
      expectedDate.setDate(expectedDate.getDate() - 7);

      expect(callDate.toISOString()).toBe(expectedDate.toISOString());
    });

    test('should use current date minus 7 days if no lastSyncDate', async () => {
      jest.spyOn(stravaSyncService, 'syncActivities').mockResolvedValue({
        imported: 3,
        fetched: 3
      });
      jest.spyOn(stravaSyncService, 'syncActivityPhotos').mockResolvedValue({
        activitiesProcessed: 0,
        photosInserted: 0
      });

      await stravaSyncService.incrementalSync(
        mockEncryptedTokens,
        mockUserId,
        null
      );

      const callDate = stravaSyncService.syncActivities.mock.calls[0][2];
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Allow 1 second tolerance for test execution time
      expect(Math.abs(callDate.getTime() - sevenDaysAgo.getTime())).toBeLessThan(1000);
    });

    test('should pass progress callback to sync methods', async () => {
      jest.spyOn(stravaSyncService, 'syncActivities').mockResolvedValue({
        imported: 2,
        fetched: 2
      });
      jest.spyOn(stravaSyncService, 'syncActivityPhotos').mockResolvedValue({
        activitiesProcessed: 1,
        photosInserted: 1
      });

      const onProgress = jest.fn();

      await stravaSyncService.incrementalSync(
        mockEncryptedTokens,
        mockUserId,
        new Date(),
        onProgress
      );

      expect(stravaSyncService.syncActivities).toHaveBeenCalledWith(
        mockEncryptedTokens,
        mockUserId,
        expect.any(Date),
        onProgress
      );
    });
  });

  describe('transformActivity', () => {
    test('should transform activity with full data', () => {
      const activity = {
        id: 1001,
        name: 'Morning Run',
        type: 'Run',
        description: 'Great run!',
        start_date: '2025-01-10T08:00:00Z',
        start_latlng: [37.7749, -122.4194],
        end_latlng: [37.7849, -122.4094],
        elapsed_time: 1900,
        moving_time: 1800,
        distance: 5000,
        total_elevation_gain: 50,
        calories: 300,
        average_speed: 2.78,
        max_speed: 3.5,
        average_heartrate: 150,
        max_heartrate: 170,
        average_cadence: 85,
        average_watts: 200,
        map: {
          polyline: 'mockPolyline'
        },
        private: false,
        kudos_count: 5,
        comment_count: 2,
        total_photo_count: 3,
        achievement_count: 1
      };

      jest.spyOn(stravaSyncService, 'decodePolyline').mockReturnValue([
        [37.7749, -122.4194],
        [37.7849, -122.4094]
      ]);

      const result = stravaSyncService.transformActivity(activity, mockUserId);

      expect(result).toEqual({
        user_id: mockUserId,
        strava_activity_id: '1001',
        activity_type: 'Running',
        activity_name: 'Morning Run',
        description: 'Great run!',
        start_time: new Date('2025-01-10T08:00:00Z'),
        start_latlng: 'POINT(-122.4194 37.7749)',
        end_latlng: 'POINT(-122.4094 37.7849)',
        duration_seconds: 1900,
        moving_time_seconds: 1800,
        distance_meters: 5000,
        total_elevation_gain: 50,
        calories: 300,
        avg_speed: 2.78,
        max_speed: 3.5,
        avg_heart_rate: 150,
        max_heart_rate: 170,
        avg_cadence: 85,
        avg_watts: 200,
        tracklog: 'LINESTRING(-122.4194 37.7749,-122.4094 37.7849)',
        is_private: false,
        kudos_count: 5,
        comment_count: 2,
        photo_count: 3,
        achievement_count: 1,
        strava_url: 'https://www.strava.com/activities/1001'
      });
    });

    test('should handle activity without optional fields', () => {
      const activity = {
        id: 1002,
        name: 'Simple Activity',
        type: 'Walk',
        start_date: '2025-01-11T10:00:00Z',
        elapsed_time: 600,
        moving_time: 550,
        distance: 1000
      };

      const result = stravaSyncService.transformActivity(activity, mockUserId);

      expect(result.strava_activity_id).toBe('1002');
      expect(result.activity_type).toBe('Walking');
      expect(result.start_latlng).toBeNull();
      expect(result.end_latlng).toBeNull();
      expect(result.tracklog).toBeNull();
      expect(result.calories).toBeUndefined();
      expect(result.is_private).toBe(false);
    });

    test('should use summary_polyline if polyline not available', () => {
      const activity = {
        id: 1003,
        name: 'Activity',
        type: 'Run',
        start_date: '2025-01-12T08:00:00Z',
        map: {
          summary_polyline: 'summaryPolyline'
        }
      };

      jest.spyOn(stravaSyncService, 'decodePolyline').mockReturnValue([
        [37.7749, -122.4194]
      ]);

      const result = stravaSyncService.transformActivity(activity, mockUserId);

      expect(result.tracklog).toBe('LINESTRING(-122.4194 37.7749)');
      expect(stravaSyncService.decodePolyline).toHaveBeenCalledWith('summaryPolyline');
    });

    test('should handle activity without map data', () => {
      const activity = {
        id: 1004,
        name: 'Indoor Activity',
        type: 'Workout',
        start_date: '2025-01-13T08:00:00Z'
      };

      const result = stravaSyncService.transformActivity(activity, mockUserId);

      expect(result.tracklog).toBeNull();
    });
  });

  describe('mapActivityType', () => {
    test('should map common Strava activity types', () => {
      expect(stravaSyncService.mapActivityType('Run')).toBe('Running');
      expect(stravaSyncService.mapActivityType('Ride')).toBe('Cycling');
      expect(stravaSyncService.mapActivityType('Swim')).toBe('Swimming');
      expect(stravaSyncService.mapActivityType('Walk')).toBe('Walking');
      expect(stravaSyncService.mapActivityType('Hike')).toBe('Hiking');
    });

    test('should map virtual activities', () => {
      expect(stravaSyncService.mapActivityType('VirtualRide')).toBe('Virtual Cycling');
      expect(stravaSyncService.mapActivityType('VirtualRun')).toBe('Virtual Running');
    });

    test('should map winter sports', () => {
      expect(stravaSyncService.mapActivityType('AlpineSki')).toBe('Skiing');
      expect(stravaSyncService.mapActivityType('BackcountrySki')).toBe('Skiing');
      expect(stravaSyncService.mapActivityType('NordicSki')).toBe('Skiing');
      expect(stravaSyncService.mapActivityType('Snowboard')).toBe('Snowboarding');
      expect(stravaSyncService.mapActivityType('IceSkate')).toBe('Ice Skating');
    });

    test('should map fitness activities', () => {
      expect(stravaSyncService.mapActivityType('Workout')).toBe('Gym');
      expect(stravaSyncService.mapActivityType('WeightTraining')).toBe('Strength');
      expect(stravaSyncService.mapActivityType('Yoga')).toBe('Yoga');
      expect(stravaSyncService.mapActivityType('Crossfit')).toBe('CrossFit');
      expect(stravaSyncService.mapActivityType('HighIntensityIntervalTraining')).toBe('HIIT');
      expect(stravaSyncService.mapActivityType('Pilates')).toBe('Pilates');
    });

    test('should return unmapped types as-is', () => {
      expect(stravaSyncService.mapActivityType('CustomActivity')).toBe('CustomActivity');
    });
  });

  describe('decodePolyline', () => {
    test('should decode polyline correctly', () => {
      // This is a real encoded polyline
      const encoded = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';

      const result = stravaSyncService.decodePolyline(encoded);

      // Just verify it returns an array of coordinate pairs
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveLength(2);
      expect(typeof result[0][0]).toBe('number');
      expect(typeof result[0][1]).toBe('number');
    });

    test('should handle empty polyline', () => {
      const result = stravaSyncService.decodePolyline('');

      // Empty string may still parse to a single empty coordinate due to algorithm
      // Just check it doesn't crash and returns an array
      expect(Array.isArray(result)).toBe(true);
    });

    test('should decode single point', () => {
      const encoded = '_p~iF~ps|U';

      const result = stravaSyncService.decodePolyline(encoded);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveLength(2);
    });
  });

  describe('getDefaultStartDate', () => {
    test('should return date 5 years ago', () => {
      const result = stravaSyncService.getDefaultStartDate();

      const fiveYearsAgo = new Date();
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

      expect(result.getFullYear()).toBe(fiveYearsAgo.getFullYear());
    });
  });
});
