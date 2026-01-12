// Mock database connection first (before any imports that use it)
jest.mock('../db/connection', () => ({
  query: jest.fn().mockResolvedValue({ rows: [] })
}));

// Mock all dependencies
jest.mock('../models/checkin');
jest.mock('../models/stravaActivity');
jest.mock('../models/stravaActivityPhoto');
jest.mock('../models/garminActivity');
jest.mock('../models/garminDailySteps');
jest.mock('../models/garminDailyHeartRate');
jest.mock('../models/garminDailySleep');
jest.mock('./weatherService');

const dayInLifeService = require('./dayInLifeService');
const Checkin = require('../models/checkin');
const StravaActivity = require('../models/stravaActivity');
const StravaActivityPhoto = require('../models/stravaActivityPhoto');
const GarminActivity = require('../models/garminActivity');
const GarminDailySteps = require('../models/garminDailySteps');
const GarminDailyHeartRate = require('../models/garminDailyHeartRate');
const GarminDailySleep = require('../models/garminDailySleep');
const weatherService = require('./weatherService');
const db = require('../db/connection');

describe('dayInLifeService', () => {
  const userId = 'test-user-123';
  const date = '2024-01-15';
  const latitude = 37.7749;
  const longitude = -122.4194;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    // Reset db mock to default empty rows
    db.query.mockResolvedValue({ rows: [] });
    // Mock StravaActivityPhoto.findByActivityId to return empty by default
    StravaActivityPhoto.findByActivityId = jest.fn().mockResolvedValue([]);
  });

  describe('getDayInLife', () => {
    it('should aggregate all data sources for a given date and user', async () => {
      // Mock check-ins
      const mockCheckins = [
        {
          id: 1,
          venue_name: 'Coffee Shop',
          checkin_date: '2024-01-15T08:30:00Z',
          latitude: 37.7749,
          longitude: -122.4194,
          venue_category: 'Cafe'
        },
        {
          id: 2,
          venue_name: 'Office',
          checkin_date: '2024-01-15T09:00:00Z',
          latitude: 37.7849,
          longitude: -122.4294,
          venue_category: 'Office'
        }
      ];

      // Mock Strava activities
      const mockStravaActivities = [
        {
          id: 1,
          activity_name: 'Morning Run',
          activity_type: 'Run',
          start_time: '2024-01-15T07:00:00Z',
          duration_seconds: 1800,
          distance_meters: 5000,
          calories: 350
        }
      ];

      // Mock Garmin activities
      const mockGarminActivities = [
        {
          id: 1,
          activity_name: 'Evening Walk',
          activity_type: 'Walk',
          start_time: '2024-01-15T18:00:00Z',
          duration_seconds: 1200,
          distance_meters: 2000,
          calories: 150
        }
      ];

      // Mock daily metrics
      const mockSteps = [
        { user_id: userId, date: '2024-01-15', step_count: 10000 }
      ];

      const mockHeartRate = [
        {
          user_id: userId,
          date: '2024-01-15',
          min_heart_rate: 55,
          max_heart_rate: 165,
          resting_heart_rate: 60
        }
      ];

      const mockSleep = [
        {
          user_id: userId,
          date: '2024-01-15',
          sleep_duration_seconds: 28800,
          sleep_score: 85,
          deep_sleep_seconds: 7200,
          light_sleep_seconds: 14400,
          rem_sleep_seconds: 5400,
          awake_seconds: 1800
        }
      ];

      // Mock weather data
      const mockWeather = {
        date: '2024-01-15',
        temperature_max: 18,
        temperature_min: 12,
        precipitation: 0,
        weathercode: 1,
        weather_description: 'Mainly clear'
      };

      // Setup mocks
      Checkin.find.mockResolvedValue({ data: mockCheckins, total: 2 });
      StravaActivity.findByUserAndDateRange.mockResolvedValue(mockStravaActivities);
      GarminActivity.findByUserAndDateRange.mockResolvedValue(mockGarminActivities);
      GarminDailySteps.findByUserAndDateRange.mockResolvedValue(mockSteps);
      GarminDailyHeartRate.findByUserAndDateRange.mockResolvedValue(mockHeartRate);
      GarminDailySleep.findByUserAndDateRange.mockResolvedValue(mockSleep);
      weatherService.getHistoricalWeather.mockResolvedValue(mockWeather);

      // Execute
      const result = await dayInLifeService.getDayInLife(userId, date, latitude, longitude);

      // Verify all data sources were called correctly
      expect(Checkin.find).toHaveBeenCalledWith({
        userId,
        localDate: '2024-01-15'
      });

      expect(StravaActivity.findByUserAndDateRange).toHaveBeenCalledWith(
        userId,
        '2024-01-15'
      );

      expect(GarminActivity.findByUserAndDateRange).toHaveBeenCalledWith(
        userId,
        '2024-01-15'
      );

      expect(GarminDailySteps.findByUserAndDateRange).toHaveBeenCalledWith(
        userId,
        '2024-01-15',
        '2024-01-15'
      );

      expect(GarminDailyHeartRate.findByUserAndDateRange).toHaveBeenCalledWith(
        userId,
        '2024-01-15',
        '2024-01-15'
      );

      expect(GarminDailySleep.findByUserAndDateRange).toHaveBeenCalledWith(
        userId,
        '2024-01-15',
        '2024-01-15'
      );

      expect(weatherService.getHistoricalWeather).toHaveBeenCalledWith(
        latitude,
        longitude,
        date
      );

      // Verify result structure
      expect(result).toMatchObject({
        date: '2024-01-15',
        timeline: expect.any(Array),
        dailyMetrics: {
          steps: 10000,
          avgHeartRate: (55 + 165 + 60) / 3,
          sleepHours: 8,
          activities: 2
        },
        weather: mockWeather,
        // New format
        properties: expect.objectContaining({
          activities: { count: 2 },
          checkins: { count: 2 }
        }),
        events: expect.any(Array)
      });

      // Verify timeline is sorted by time
      expect(result.timeline.length).toBe(4); // 2 check-ins + 2 activities
      expect(result.timeline[0].type).toBe('strava_activity');
      expect(result.timeline[1].type).toBe('checkin');
      expect(result.timeline[2].type).toBe('checkin');
      expect(result.timeline[3].type).toBe('garmin_activity');
    });

    it('should handle missing check-ins gracefully', async () => {
      // Mock empty check-ins
      Checkin.find.mockResolvedValue({ data: [], total: 0 });
      StravaActivity.findByUserAndDateRange.mockResolvedValue([]);
      GarminActivity.findByUserAndDateRange.mockResolvedValue([]);
      GarminDailySteps.findByUserAndDateRange.mockResolvedValue([]);
      GarminDailyHeartRate.findByUserAndDateRange.mockResolvedValue([]);
      GarminDailySleep.findByUserAndDateRange.mockResolvedValue([]);
      weatherService.getHistoricalWeather.mockResolvedValue({
        date: '2024-01-15',
        temperature_max: 20,
        temperature_min: 15,
        precipitation: 0,
        weathercode: 0,
        weather_description: 'Clear sky'
      });

      const result = await dayInLifeService.getDayInLife(userId, date, latitude, longitude);

      expect(result.timeline).toEqual([]);
      expect(result.dailyMetrics.steps).toBeUndefined();
      expect(result.dailyMetrics.avgHeartRate).toBeUndefined();
      expect(result.dailyMetrics.sleepHours).toBeUndefined();
      expect(result.dailyMetrics.activities).toBe(0);
    });

    it('should handle missing Strava activities gracefully', async () => {
      const mockCheckins = [
        {
          id: 1,
          venue_name: 'Coffee Shop',
          checkin_date: '2024-01-15T08:30:00Z',
          latitude: 37.7749,
          longitude: -122.4194,
          venue_category: 'Cafe'
        }
      ];

      Checkin.find.mockResolvedValue({ data: mockCheckins, total: 1 });
      StravaActivity.findByUserAndDateRange.mockResolvedValue([]);
      GarminActivity.findByUserAndDateRange.mockResolvedValue([]);
      GarminDailySteps.findByUserAndDateRange.mockResolvedValue([]);
      GarminDailyHeartRate.findByUserAndDateRange.mockResolvedValue([]);
      GarminDailySleep.findByUserAndDateRange.mockResolvedValue([]);
      weatherService.getHistoricalWeather.mockResolvedValue({
        date: '2024-01-15',
        temperature_max: 20,
        temperature_min: 15,
        precipitation: 0,
        weathercode: 0,
        weather_description: 'Clear sky'
      });

      const result = await dayInLifeService.getDayInLife(userId, date, latitude, longitude);

      expect(result.timeline.length).toBe(1);
      expect(result.timeline[0].type).toBe('checkin');
    });

    it('should handle missing weather data gracefully', async () => {
      Checkin.find.mockResolvedValue({ data: [], total: 0 });
      StravaActivity.findByUserAndDateRange.mockResolvedValue([]);
      GarminActivity.findByUserAndDateRange.mockResolvedValue([]);
      GarminDailySteps.findByUserAndDateRange.mockResolvedValue([]);
      GarminDailyHeartRate.findByUserAndDateRange.mockResolvedValue([]);
      GarminDailySleep.findByUserAndDateRange.mockResolvedValue([]);
      weatherService.getHistoricalWeather.mockRejectedValue(new Error('No weather data available'));

      const result = await dayInLifeService.getDayInLife(userId, date, latitude, longitude);

      expect(result.weather).toBeNull();
      expect(result.timeline).toEqual([]);
    });

    it('should work when latitude/longitude are not provided (no weather)', async () => {
      Checkin.find.mockResolvedValue({ data: [], total: 0 });
      StravaActivity.findByUserAndDateRange.mockResolvedValue([]);
      GarminActivity.findByUserAndDateRange.mockResolvedValue([]);
      GarminDailySteps.findByUserAndDateRange.mockResolvedValue([]);
      GarminDailyHeartRate.findByUserAndDateRange.mockResolvedValue([]);
      GarminDailySleep.findByUserAndDateRange.mockResolvedValue([]);

      const result = await dayInLifeService.getDayInLife(userId, date);

      expect(weatherService.getHistoricalWeather).not.toHaveBeenCalled();
      expect(result.weather).toBeNull();
    });

    it('should validate required parameters', async () => {
      await expect(dayInLifeService.getDayInLife(null, date)).rejects.toThrow('userId is required');
      await expect(dayInLifeService.getDayInLife(userId, null)).rejects.toThrow('date is required');
    });

    it('should validate date format', async () => {
      await expect(dayInLifeService.getDayInLife(userId, 'invalid-date')).rejects.toThrow('Invalid date format');
      await expect(dayInLifeService.getDayInLife(userId, '2024/01/15')).rejects.toThrow('Invalid date format');
    });
  });

  describe('generateEvents', () => {
    it('should group contiguous check-ins without activity interruption', async () => {
      const mockCheckins = [
        { id: 1, checkin_date: '2024-01-15T09:00:00Z', venue_name: 'Coffee', latitude: 40.7128, longitude: -74.0060 },
        { id: 2, checkin_date: '2024-01-15T12:00:00Z', venue_name: 'Lunch', latitude: 40.7138, longitude: -74.0070 },
        { id: 3, checkin_date: '2024-01-15T14:00:00Z', venue_name: 'Museum', latitude: 40.7148, longitude: -74.0080 }
      ];
      const mockActivities = [];

      const events = await dayInLifeService.generateEvents(mockCheckins, mockActivities);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('checkin_group');
      expect(events[0].checkins).toHaveLength(3);
    });

    it('should split check-in groups when Garmin activity interrupts', async () => {
      const mockCheckins = [
        { id: 1, checkin_date: '2024-01-15T09:00:00Z', venue_name: 'Coffee', latitude: 40.7128, longitude: -74.0060 },
        { id: 2, checkin_date: '2024-01-15T14:00:00Z', venue_name: 'Museum', latitude: 40.7148, longitude: -74.0080 }
      ];
      const mockActivities = [
        { id: 1, start_time: '2024-01-15T10:00:00Z', activity_type: 'running', tracklog: null, garmin_activity_id: '123' }
      ];

      const events = await dayInLifeService.generateEvents(mockCheckins, mockActivities);

      expect(events).toHaveLength(3); // checkin, activity, checkin
      expect(events[0].type).toBe('checkin_group');
      expect(events[1].type).toContain('activity');
      expect(events[2].type).toBe('checkin_group');
    });

    it('should split check-in groups when Strava activity interrupts', async () => {
      const mockCheckins = [
        { id: 1, checkin_date: '2024-01-15T09:00:00Z', venue_name: 'Coffee', latitude: 40.7128, longitude: -74.0060 },
        { id: 2, checkin_date: '2024-01-15T14:00:00Z', venue_name: 'Museum', latitude: 40.7148, longitude: -74.0080 }
      ];
      const mockActivities = [
        { id: 1, start_time: '2024-01-15T10:00:00Z', activity_type: 'Run', tracklog: null, strava_activity_id: 456 }
      ];

      const events = await dayInLifeService.generateEvents(mockCheckins, mockActivities);

      expect(events).toHaveLength(3); // checkin, activity, checkin
      expect(events[0].type).toBe('checkin_group');
      expect(events[1].type).toContain('activity');
      expect(events[2].type).toBe('checkin_group');
    });

    it('should order events chronologically', async () => {
      const mockCheckins = [
        { id: 2, checkin_date: '2024-01-15T14:00:00Z', venue_name: 'Museum', latitude: 40.7148, longitude: -74.0080 },
        { id: 1, checkin_date: '2024-01-15T09:00:00Z', venue_name: 'Coffee', latitude: 40.7128, longitude: -74.0060 }
      ];
      const mockActivities = [
        { id: 1, start_time: '2024-01-15T10:00:00Z', activity_type: 'running', tracklog: null, garmin_activity_id: '123' }
      ];

      const events = await dayInLifeService.generateEvents(mockCheckins, mockActivities);

      expect(new Date(events[0].startTime).getTime()).toBeLessThan(new Date(events[1].startTime).getTime());
      expect(new Date(events[1].startTime).getTime()).toBeLessThan(new Date(events[2].startTime).getTime());
    });

    it('should handle both Strava and Garmin activities together', async () => {
      const mockCheckins = [
        { id: 1, checkin_date: '2024-01-15T09:00:00Z', venue_name: 'Coffee', latitude: 40.7128, longitude: -74.0060 }
      ];
      const mockActivities = [
        { id: 1, start_time: '2024-01-15T10:00:00Z', activity_type: 'running', tracklog: 'LINESTRING(-74.0060 40.7128, -74.0070 40.7138)', garmin_activity_id: '123' },
        { id: 2, start_time: '2024-01-15T15:00:00Z', activity_type: 'Ride', tracklog: 'LINESTRING(-74.0080 40.7148, -74.0090 40.7158)', strava_activity_id: 456 }
      ];

      const events = await dayInLifeService.generateEvents(mockCheckins, mockActivities);

      expect(events).toHaveLength(3); // checkin, garmin activity, strava activity
      expect(events[1].type).toBe('garmin_activity_mapped');
      expect(events[2].type).toBe('strava_activity_mapped');
    });

    it('should distinguish between mapped and unmapped Garmin activities', async () => {
      const mockActivities = [
        { id: 1, start_time: '2024-01-15T10:00:00Z', activity_type: 'running', tracklog: 'LINESTRING(-74.0060 40.7128, -74.0070 40.7138)', garmin_activity_id: '123' },
        { id: 2, start_time: '2024-01-15T15:00:00Z', activity_type: 'yoga', tracklog: null, garmin_activity_id: '456' }
      ];

      const events = await dayInLifeService.generateEvents([], mockActivities);

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('garmin_activity_mapped');
      expect(events[1].type).toBe('garmin_activity_unmapped');
    });

    it('should distinguish between mapped and unmapped Strava activities', async () => {
      const mockActivities = [
        { id: 1, start_time: '2024-01-15T10:00:00Z', activity_type: 'Run', tracklog: 'LINESTRING(-74.0060 40.7128, -74.0070 40.7138)', strava_activity_id: 123 },
        { id: 2, start_time: '2024-01-15T15:00:00Z', activity_type: 'Yoga', tracklog: null, strava_activity_id: 456 }
      ];

      const events = await dayInLifeService.generateEvents([], mockActivities);

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('strava_activity_mapped');
      expect(events[1].type).toBe('strava_activity_unmapped');
    });

    it('should include photos in check-in events', async () => {
      const mockCheckins = [
        { id: 1, checkin_date: '2024-01-15T09:00:00Z', venue_name: 'Coffee', latitude: 40.7128, longitude: -74.0060 }
      ];

      // Mock db.query for photos
      db.query.mockResolvedValue({
        rows: [
          { checkin_id: 1, photo_url: 'https://example.com/photo1.jpg', photo_url_cached: 'https://cached.com/photo1.jpg' }
        ]
      });

      const events = await dayInLifeService.generateEvents(mockCheckins, []);

      expect(events).toHaveLength(1);
      expect(events[0].checkins[0].photos).toHaveLength(1);
      expect(events[0].checkins[0].photos[0].photo_url).toBe('https://example.com/photo1.jpg');
    });

    it('should generate static map URLs for check-in groups', async () => {
      const mockCheckins = [
        { id: 1, checkin_date: '2024-01-15T09:00:00Z', venue_name: 'Coffee', latitude: 40.7128, longitude: -74.0060 },
        { id: 2, checkin_date: '2024-01-15T12:00:00Z', venue_name: 'Lunch', latitude: 40.7138, longitude: -74.0070 }
      ];

      const events = await dayInLifeService.generateEvents(mockCheckins, []);

      expect(events).toHaveLength(1);
      expect(events[0].staticMapUrl).toBeDefined();
    });

    it('should generate static map URLs for mapped activities', async () => {
      const mockActivities = [
        { id: 1, start_time: '2024-01-15T10:00:00Z', activity_type: 'running', tracklog: 'LINESTRING(-74.0060 40.7128, -74.0070 40.7138)', garmin_activity_id: '123' }
      ];

      const events = await dayInLifeService.generateEvents([], mockActivities);

      expect(events).toHaveLength(1);
      expect(events[0].staticMapUrl).toBeDefined();
      expect(events[0].staticMapUrl).not.toBeNull();
    });

    it('should not generate static map URLs for unmapped activities', async () => {
      const mockActivities = [
        { id: 1, start_time: '2024-01-15T10:00:00Z', activity_type: 'yoga', tracklog: null, garmin_activity_id: '123' }
      ];

      const events = await dayInLifeService.generateEvents([], mockActivities);

      expect(events).toHaveLength(1);
      expect(events[0].staticMapUrl).toBeNull();
    });
  });
});
