const weatherService = require('./weatherService');
const axios = require('axios');

// Mock axios
jest.mock('axios');

describe('Weather Service', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    // Clear cache before each test
    weatherService.clearCache();
  });

  describe('getHistoricalWeather', () => {
    const mockApiResponse = {
      data: {
        latitude: 40.7128,
        longitude: -74.006,
        daily: {
          time: ['2024-01-15'],
          temperature_2m_max: [15.5],
          temperature_2m_min: [5.2],
          precipitation_sum: [2.3],
          weathercode: [61]
        }
      }
    };

    test('fetches historical weather data successfully', async () => {
      axios.get.mockResolvedValue(mockApiResponse);

      const result = await weatherService.getHistoricalWeather(
        40.7128,
        -74.006,
        '2024-01-15'
      );

      expect(result).toEqual({
        date: '2024-01-15',
        temperature_max: 15.5,
        temperature_min: 5.2,
        precipitation: 2.3,
        weathercode: 61,
        weather_description: 'Rain: Slight intensity'
      });

      expect(axios.get).toHaveBeenCalledWith(
        'https://archive-api.open-meteo.com/v1/archive',
        {
          params: {
            latitude: 40.7128,
            longitude: -74.006,
            start_date: '2024-01-15',
            end_date: '2024-01-15',
            daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode',
            timezone: 'auto'
          }
        }
      );
    });

    test('validates latitude parameter', async () => {
      await expect(
        weatherService.getHistoricalWeather(91, -74.006, '2024-01-15')
      ).rejects.toThrow('Invalid latitude: must be between -90 and 90');

      await expect(
        weatherService.getHistoricalWeather(-91, -74.006, '2024-01-15')
      ).rejects.toThrow('Invalid latitude: must be between -90 and 90');
    });

    test('validates longitude parameter', async () => {
      await expect(
        weatherService.getHistoricalWeather(40.7128, 181, '2024-01-15')
      ).rejects.toThrow('Invalid longitude: must be between -180 and 180');

      await expect(
        weatherService.getHistoricalWeather(40.7128, -181, '2024-01-15')
      ).rejects.toThrow('Invalid longitude: must be between -180 and 180');
    });

    test('validates date format', async () => {
      await expect(
        weatherService.getHistoricalWeather(40.7128, -74.006, '2024/01/15')
      ).rejects.toThrow('Invalid date format: must be YYYY-MM-DD');

      await expect(
        weatherService.getHistoricalWeather(40.7128, -74.006, 'invalid-date')
      ).rejects.toThrow('Invalid date format: must be YYYY-MM-DD');
    });

    test('validates date is not in the future', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const futureDateStr = futureDate.toISOString().split('T')[0];

      await expect(
        weatherService.getHistoricalWeather(40.7128, -74.006, futureDateStr)
      ).rejects.toThrow('Date cannot be in the future');
    });

    test('caches results to avoid duplicate API calls', async () => {
      axios.get.mockResolvedValue(mockApiResponse);

      // First call - should hit the API
      const result1 = await weatherService.getHistoricalWeather(
        40.7128,
        -74.006,
        '2024-01-15'
      );

      // Second call with same parameters - should use cache
      const result2 = await weatherService.getHistoricalWeather(
        40.7128,
        -74.006,
        '2024-01-15'
      );

      // API should only be called once
      expect(axios.get).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(result2);
    });

    test('handles API errors gracefully', async () => {
      axios.get.mockRejectedValue(new Error('Network error'));

      await expect(
        weatherService.getHistoricalWeather(40.7128, -74.006, '2024-01-15')
      ).rejects.toThrow('Failed to fetch weather data: Network error');
    });

    test('handles missing weather data in API response', async () => {
      axios.get.mockResolvedValue({
        data: {
          latitude: 40.7128,
          longitude: -74.006,
          daily: {
            time: []
          }
        }
      });

      await expect(
        weatherService.getHistoricalWeather(40.7128, -74.006, '2024-01-15')
      ).rejects.toThrow('No weather data available for the specified date');
    });

    test('handles different weather codes correctly', async () => {
      const weatherCodes = [
        { code: 0, description: 'Clear sky' },
        { code: 1, description: 'Mainly clear' },
        { code: 2, description: 'Partly cloudy' },
        { code: 3, description: 'Overcast' },
        { code: 45, description: 'Fog' },
        { code: 51, description: 'Drizzle: Light intensity' },
        { code: 61, description: 'Rain: Slight intensity' },
        { code: 71, description: 'Snow fall: Slight intensity' },
        { code: 95, description: 'Thunderstorm' }
      ];

      for (const { code, description } of weatherCodes) {
        axios.get.mockResolvedValue({
          data: {
            latitude: 40.7128,
            longitude: -74.006,
            daily: {
              time: ['2024-01-15'],
              temperature_2m_max: [15.5],
              temperature_2m_min: [5.2],
              precipitation_sum: [0],
              weathercode: [code]
            }
          }
        });

        // Clear cache between iterations
        weatherService.clearCache();

        const result = await weatherService.getHistoricalWeather(
          40.7128,
          -74.006,
          '2024-01-15'
        );

        expect(result.weather_description).toBe(description);
      }
    });

    test('returns "Unknown" for unrecognized weather codes', async () => {
      axios.get.mockResolvedValue({
        data: {
          latitude: 40.7128,
          longitude: -74.006,
          daily: {
            time: ['2024-01-15'],
            temperature_2m_max: [15.5],
            temperature_2m_min: [5.2],
            precipitation_sum: [0],
            weathercode: [999] // Invalid code
          }
        }
      });

      const result = await weatherService.getHistoricalWeather(
        40.7128,
        -74.006,
        '2024-01-15'
      );

      expect(result.weather_description).toBe('Unknown');
    });
  });

  describe('getWeatherForDateRange', () => {
    test('fetches weather for multiple dates', async () => {
      const mockApiResponse = {
        data: {
          latitude: 40.7128,
          longitude: -74.006,
          daily: {
            time: ['2024-01-15', '2024-01-16', '2024-01-17'],
            temperature_2m_max: [15.5, 16.2, 14.8],
            temperature_2m_min: [5.2, 6.1, 4.9],
            precipitation_sum: [2.3, 0, 1.5],
            weathercode: [61, 0, 51]
          }
        }
      };

      axios.get.mockResolvedValue(mockApiResponse);

      const result = await weatherService.getWeatherForDateRange(
        40.7128,
        -74.006,
        '2024-01-15',
        '2024-01-17'
      );

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        date: '2024-01-15',
        temperature_max: 15.5,
        temperature_min: 5.2,
        precipitation: 2.3,
        weathercode: 61,
        weather_description: 'Rain: Slight intensity'
      });
      expect(result[1].date).toBe('2024-01-16');
      expect(result[2].date).toBe('2024-01-17');

      expect(axios.get).toHaveBeenCalledWith(
        'https://archive-api.open-meteo.com/v1/archive',
        {
          params: {
            latitude: 40.7128,
            longitude: -74.006,
            start_date: '2024-01-15',
            end_date: '2024-01-17',
            daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode',
            timezone: 'auto'
          }
        }
      );
    });

    test('validates end_date is not before start_date', async () => {
      await expect(
        weatherService.getWeatherForDateRange(
          40.7128,
          -74.006,
          '2024-01-17',
          '2024-01-15'
        )
      ).rejects.toThrow('End date must be after or equal to start date');
    });
  });

  describe('clearCache', () => {
    test('clears the cache successfully', async () => {
      const mockApiResponse = {
        data: {
          latitude: 40.7128,
          longitude: -74.006,
          daily: {
            time: ['2024-01-15'],
            temperature_2m_max: [15.5],
            temperature_2m_min: [5.2],
            precipitation_sum: [2.3],
            weathercode: [61]
          }
        }
      };

      axios.get.mockResolvedValue(mockApiResponse);

      // First call
      await weatherService.getHistoricalWeather(40.7128, -74.006, '2024-01-15');
      expect(axios.get).toHaveBeenCalledTimes(1);

      // Clear cache
      weatherService.clearCache();

      // Second call - should hit API again
      await weatherService.getHistoricalWeather(40.7128, -74.006, '2024-01-15');
      expect(axios.get).toHaveBeenCalledTimes(2);
    });
  });
});
