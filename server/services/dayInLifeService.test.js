const dayInLifeService = require('./dayInLifeService');
const Checkin = require('../models/checkin');
const StravaActivity = require('../models/stravaActivity');
const GarminActivity = require('../models/garminActivity');
const GarminDailySteps = require('../models/garminDailySteps');
const GarminDailyHeartRate = require('../models/garminDailyHeartRate');
const GarminDailySleep = require('../models/garminDailySleep');
const weatherService = require('./weatherService');

// Mock all dependencies
jest.mock('../models/checkin');
jest.mock('../models/stravaActivity');
jest.mock('../models/garminActivity');
jest.mock('../models/garminDailySteps');
jest.mock('../models/garminDailyHeartRate');
jest.mock('../models/garminDailySleep');
jest.mock('./weatherService');

describe('dayInLifeService', () => {
  const userId = 'test-user-123';
  const date = '2024-01-15';
  const latitude = 37.7749;
  const longitude = -122.4194;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
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
        startDate: '2024-01-15T00:00:00.000Z',
        endDate: '2024-01-15T23:59:59.999Z'
      });

      expect(StravaActivity.findByUserAndDateRange).toHaveBeenCalledWith(
        userId,
        '2024-01-15T00:00:00.000Z',
        '2024-01-15T23:59:59.999Z'
      );

      expect(GarminActivity.findByUserAndDateRange).toHaveBeenCalledWith(
        userId,
        '2024-01-15T00:00:00.000Z',
        '2024-01-15T23:59:59.999Z'
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
      expect(result).toEqual({
        date: '2024-01-15',
        timeline: expect.any(Array),
        dailyMetrics: {
          steps: mockSteps[0],
          heartRate: mockHeartRate[0],
          sleep: mockSleep[0]
        },
        weather: mockWeather
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
      expect(result.dailyMetrics.steps).toBeNull();
      expect(result.dailyMetrics.heartRate).toBeNull();
      expect(result.dailyMetrics.sleep).toBeNull();
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
});
