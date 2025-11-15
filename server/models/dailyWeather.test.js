const DailyWeather = require('./dailyWeather');

describe('DailyWeather', () => {
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

      // Insert first time
      await DailyWeather.upsert(weatherData);

      // Update with new temperature
      weatherData.temp_celsius = 22.0;
      const result = await DailyWeather.upsert(weatherData);

      expect(result.temp_celsius).toBe('22.0');
    });
  });

  describe('findByDateAndLocation', () => {
    it('should find weather by date and country', async () => {
      const weatherData = {
        date: '2024-01-16',
        country: 'Canada',
        region: null,
        temp_celsius: 5.0,
        condition: 'snowy',
        weather_icon: '🌨'
      };

      await DailyWeather.upsert(weatherData);

      const result = await DailyWeather.findByDateAndLocation('2024-01-16', 'Canada', null);

      expect(result).toBeDefined();
      expect(result.country).toBe('Canada');
      expect(result.condition).toBe('snowy');
    });

    it('should return undefined if not found', async () => {
      const result = await DailyWeather.findByDateAndLocation('2099-01-01', 'Mars', null);

      expect(result).toBeUndefined();
    });
  });
});
