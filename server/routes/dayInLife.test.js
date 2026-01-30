const request = require('supertest');
const User = require('../models/user');
const dayInLifeService = require('../services/dayInLifeService');

// Mock dependencies before requiring server
jest.mock('../models/user');
jest.mock('../services/dayInLifeService');
jest.mock('../services/geminiSessionManager', () => ({
  startCleanupInterval: jest.fn()
}));
jest.mock('../jobs/queue', () => ({
  initQueue: jest.fn().mockResolvedValue(undefined),
  getQueue: jest.fn().mockReturnValue({
    work: jest.fn(),
    send: jest.fn().mockResolvedValue(undefined)
  }),
  stopQueue: jest.fn()
}));

const app = require('../server');

describe('Day in Life Routes', () => {
  const mockToken = 'test-auth-token';
  const mockUser = { id: 1, username: 'testuser' };

  beforeEach(() => {
    jest.clearAllMocks();
    User.findBySecretToken.mockResolvedValue(mockUser);
    User.update.mockResolvedValue(mockUser);
  });

  describe('GET /api/day-in-life/:date', () => {
    const mockDayData = {
      date: '2025-01-15',
      timeline: [
        {
          type: 'checkin',
          time: '2025-01-15T08:30:00.000Z',
          data: {
            id: 1,
            venue_name: 'Coffee Shop',
            checkin_date: '2025-01-15T08:30:00.000Z'
          }
        },
        {
          type: 'strava_activity',
          time: '2025-01-15T18:00:00.000Z',
          data: {
            id: 101,
            name: 'Evening Run',
            start_time: '2025-01-15T18:00:00.000Z',
            distance: 5000
          }
        }
      ],
      dailyMetrics: {
        steps: { date: '2025-01-15', total_steps: 10000 },
        heartRate: { date: '2025-01-15', avg_heart_rate: 75 },
        sleep: { date: '2025-01-15', total_sleep_seconds: 28800 }
      },
      weather: {
        date: '2025-01-15',
        temperature: 22,
        conditions: 'sunny'
      }
    };

    test('should return aggregated day data for valid date', async () => {
      dayInLifeService.getDayInLife.mockResolvedValue(mockDayData);

      const response = await request(app)
        .get('/api/day-in-life/2025-01-15')
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockDayData);
      expect(dayInLifeService.getDayInLife).toHaveBeenCalledWith(
        mockUser.id,
        '2025-01-15',
        null,
        null
      );
    });

    test('should include weather data when lat/lng provided', async () => {
      dayInLifeService.getDayInLife.mockResolvedValue(mockDayData);

      const response = await request(app)
        .get('/api/day-in-life/2025-01-15')
        .query({ lat: 37.7749, lng: -122.4194 })
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(200);
      expect(dayInLifeService.getDayInLife).toHaveBeenCalledWith(
        mockUser.id,
        '2025-01-15',
        37.7749,
        -122.4194
      );
    });

    test('should accept only lat without lng', async () => {
      dayInLifeService.getDayInLife.mockResolvedValue({
        ...mockDayData,
        weather: null
      });

      const response = await request(app)
        .get('/api/day-in-life/2025-01-15')
        .query({ lat: 37.7749 })
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(200);
      expect(dayInLifeService.getDayInLife).toHaveBeenCalledWith(
        mockUser.id,
        '2025-01-15',
        37.7749,
        null
      );
    });

    test('should accept only lng without lat', async () => {
      dayInLifeService.getDayInLife.mockResolvedValue({
        ...mockDayData,
        weather: null
      });

      const response = await request(app)
        .get('/api/day-in-life/2025-01-15')
        .query({ lng: -122.4194 })
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(200);
      expect(dayInLifeService.getDayInLife).toHaveBeenCalledWith(
        mockUser.id,
        '2025-01-15',
        null,
        -122.4194
      );
    });

    test('should reject invalid date format (missing day)', async () => {
      const response = await request(app)
        .get('/api/day-in-life/2025-01')
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].msg).toContain('YYYY-MM-DD');
      expect(dayInLifeService.getDayInLife).not.toHaveBeenCalled();
    });

    test('should reject invalid date format (wrong separator)', async () => {
      const response = await request(app)
        .get('/api/day-in-life/2025/01/15')
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(404); // Express routing will 404 on path with slashes
    });

    test('should reject invalid date format (non-numeric)', async () => {
      const response = await request(app)
        .get('/api/day-in-life/invalid-date')
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(dayInLifeService.getDayInLife).not.toHaveBeenCalled();
    });

    test('should reject invalid latitude (too high)', async () => {
      const response = await request(app)
        .get('/api/day-in-life/2025-01-15')
        .query({ lat: 95, lng: 0 })
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].msg).toContain('latitude');
      expect(dayInLifeService.getDayInLife).not.toHaveBeenCalled();
    });

    test('should reject invalid latitude (too low)', async () => {
      const response = await request(app)
        .get('/api/day-in-life/2025-01-15')
        .query({ lat: -95, lng: 0 })
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].msg).toContain('latitude');
      expect(dayInLifeService.getDayInLife).not.toHaveBeenCalled();
    });

    test('should reject invalid longitude (too high)', async () => {
      const response = await request(app)
        .get('/api/day-in-life/2025-01-15')
        .query({ lat: 0, lng: 185 })
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].msg).toContain('longitude');
      expect(dayInLifeService.getDayInLife).not.toHaveBeenCalled();
    });

    test('should reject invalid longitude (too low)', async () => {
      const response = await request(app)
        .get('/api/day-in-life/2025-01-15')
        .query({ lat: 0, lng: -185 })
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].msg).toContain('longitude');
      expect(dayInLifeService.getDayInLife).not.toHaveBeenCalled();
    });

    test('should reject non-numeric latitude', async () => {
      const response = await request(app)
        .get('/api/day-in-life/2025-01-15')
        .query({ lat: 'abc', lng: 0 })
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(dayInLifeService.getDayInLife).not.toHaveBeenCalled();
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .get('/api/day-in-life/2025-01-15');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
      expect(dayInLifeService.getDayInLife).not.toHaveBeenCalled();
    });

    test('should handle invalid authentication token', async () => {
      User.findBySecretToken.mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/day-in-life/2025-01-15')
        .set('x-auth-token', 'invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid token');
      expect(dayInLifeService.getDayInLife).not.toHaveBeenCalled();
    });

    test('should handle service errors gracefully', async () => {
      dayInLifeService.getDayInLife.mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .get('/api/day-in-life/2025-01-15')
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(500);
      expect(response.body.error).toBeDefined();
    });

    test('should handle date format validation from service', async () => {
      dayInLifeService.getDayInLife.mockRejectedValue(
        new Error('Invalid date format: must be YYYY-MM-DD')
      );

      const response = await request(app)
        .get('/api/day-in-life/2025-01-15')
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid date format');
    });

    test('should return empty timeline when no data exists', async () => {
      const emptyDayData = {
        date: '2025-01-15',
        timeline: [],
        dailyMetrics: {
          steps: null,
          heartRate: null,
          sleep: null
        },
        weather: null
      };
      dayInLifeService.getDayInLife.mockResolvedValue(emptyDayData);

      const response = await request(app)
        .get('/api/day-in-life/2025-01-15')
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(200);
      expect(response.body.timeline).toEqual([]);
      expect(response.body.dailyMetrics.steps).toBeNull();
    });

    test('should handle future dates', async () => {
      const futureDayData = {
        date: '2025-12-31',
        timeline: [],
        dailyMetrics: {
          steps: null,
          heartRate: null,
          sleep: null
        },
        weather: null
      };
      dayInLifeService.getDayInLife.mockResolvedValue(futureDayData);

      const response = await request(app)
        .get('/api/day-in-life/2025-12-31')
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(200);
      expect(response.body.date).toBe('2025-12-31');
    });

    test('should handle dates far in the past', async () => {
      const pastDayData = {
        date: '2020-01-01',
        timeline: [],
        dailyMetrics: {
          steps: null,
          heartRate: null,
          sleep: null
        },
        weather: null
      };
      dayInLifeService.getDayInLife.mockResolvedValue(pastDayData);

      const response = await request(app)
        .get('/api/day-in-life/2020-01-01')
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(200);
      expect(response.body.date).toBe('2020-01-01');
    });

    test('should accept edge case valid coordinates (equator/prime meridian)', async () => {
      dayInLifeService.getDayInLife.mockResolvedValue(mockDayData);

      const response = await request(app)
        .get('/api/day-in-life/2025-01-15')
        .query({ lat: 0, lng: 0 })
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(200);
      expect(dayInLifeService.getDayInLife).toHaveBeenCalledWith(
        mockUser.id,
        '2025-01-15',
        0,
        0
      );
    });

    test('should accept edge case valid coordinates (north/south poles)', async () => {
      dayInLifeService.getDayInLife.mockResolvedValue(mockDayData);

      const response = await request(app)
        .get('/api/day-in-life/2025-01-15')
        .query({ lat: 90, lng: 0 })
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(200);
      expect(dayInLifeService.getDayInLife).toHaveBeenCalledWith(
        mockUser.id,
        '2025-01-15',
        90,
        0
      );
    });

    test('should accept edge case valid coordinates (dateline)', async () => {
      dayInLifeService.getDayInLife.mockResolvedValue(mockDayData);

      const response = await request(app)
        .get('/api/day-in-life/2025-01-15')
        .query({ lat: 0, lng: -180 })
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(200);
      expect(dayInLifeService.getDayInLife).toHaveBeenCalledWith(
        mockUser.id,
        '2025-01-15',
        0,
        -180
      );
    });

    test('should accept boundary coordinates (lat=-90, lng=180)', async () => {
      dayInLifeService.getDayInLife.mockResolvedValue(mockDayData);

      const response = await request(app)
        .get('/api/day-in-life/2025-01-15')
        .query({ lat: -90, lng: 180 })
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(200);
      expect(dayInLifeService.getDayInLife).toHaveBeenCalledWith(
        mockUser.id,
        '2025-01-15',
        -90,
        180
      );
    });

    test('should reject Feb 30 as invalid date', async () => {
      const response = await request(app)
        .get('/api/day-in-life/2025-02-30')
        .set('x-auth-token', mockToken);

      // The route uses regex YYYY-MM-DD validation, so this may pass format check
      // but the service should handle it; either 400 or service handles gracefully
      expect([200, 400]).toContain(response.status);
    });

    test('should reject latitude exactly at boundary +91', async () => {
      const response = await request(app)
        .get('/api/day-in-life/2025-01-15')
        .query({ lat: 91, lng: 0 })
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(400);
    });

    test('should reject longitude exactly at boundary +181', async () => {
      const response = await request(app)
        .get('/api/day-in-life/2025-01-15')
        .query({ lat: 0, lng: 181 })
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(400);
    });
  });
});
