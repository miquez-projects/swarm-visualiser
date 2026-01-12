// Mock the database connection
jest.mock('../db/connection', () => ({
  query: jest.fn()
}));

const DailyWeather = require('./dailyWeather');
const db = require('../db/connection');

describe('DailyWeather', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  describe('upsert', () => {
    it('should insert new weather record', async () => {
      const weatherData = {
        date: '2024-01-15',
        country: 'United States',
        region: null,
        temp_celsius: 18.5,
        condition: 'clear',
        weather_icon: '☀️'
      };

      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, ...weatherData, temp_celsius: '18.5' }]
      });

      const result = await DailyWeather.upsert(weatherData);

      expect(result).toHaveProperty('id');
      expect(result.temp_celsius).toBe('18.5');
      expect(result.condition).toBe('clear');
    });

    it('should update existing weather record on conflict', async () => {
      const weatherData = {
        date: '2024-01-15',
        country: 'United States',
        region: null,
        temp_celsius: 20.0,
        condition: 'partly_cloudy',
        weather_icon: '🌤'
      };

      // First upsert
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, ...weatherData, temp_celsius: '20.0' }]
      });
      await DailyWeather.upsert(weatherData);

      // Second upsert with updated temperature
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, ...weatherData, temp_celsius: '22.0' }]
      });
      weatherData.temp_celsius = 22.0;
      const result = await DailyWeather.upsert(weatherData);

      expect(result.temp_celsius).toBe('22.0');
    });
  });

  describe('findByDateAndLocation', () => {
    it('should find weather by date and country', async () => {
      const weatherData = {
        id: 1,
        date: '2024-01-16',
        country: 'Canada',
        region: null,
        temp_celsius: '5.0',
        condition: 'snowy',
        weather_icon: '🌨'
      };

      db.query.mockResolvedValueOnce({ rows: [weatherData] });

      const result = await DailyWeather.findByDateAndLocation('2024-01-16', 'Canada', null);

      expect(result).toBeDefined();
      expect(result.country).toBe('Canada');
      expect(result.condition).toBe('snowy');
    });

    it('should return undefined if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await DailyWeather.findByDateAndLocation('2099-01-01', 'Mars', null);

      expect(result).toBeUndefined();
    });
  });
});
