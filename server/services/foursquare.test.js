const { transformCheckin } = require('./foursquare');

describe('Foursquare Service', () => {
  describe('transformCheckin', () => {
    const userId = 123;

    test('transforms checkin with photos correctly', () => {
      const foursquareCheckin = {
        id: 'checkin123',
        createdAt: 1609459200, // 2021-01-01 00:00:00 UTC
        venue: {
          id: 'venue123',
          name: 'Test Venue',
          categories: [
            {
              name: 'Coffee Shop'
            }
          ],
          location: {
            lat: 40.7128,
            lng: -74.0060,
            city: 'New York',
            country: 'United States'
          }
        },
        photos: {
          count: 2,
          items: [
            {
              id: 'photo1',
              prefix: 'https://example.com/photos/',
              suffix: '/photo1.jpg',
              width: 1920,
              height: 1080
            },
            {
              id: 'photo2',
              prefix: 'https://example.com/photos/',
              suffix: '/photo2.jpg',
              width: 1280,
              height: 720
            }
          ]
        }
      };

      const result = transformCheckin(foursquareCheckin, userId);

      expect(result).toEqual({
        user_id: userId,
        venue_id: 'venue123',
        venue_name: 'Test Venue',
        venue_category: 'Coffee Shop',
        latitude: 40.7128,
        longitude: -74.0060,
        checkin_date: new Date(1609459200 * 1000),
        city: 'New York',
        country: 'United States',
        timezone: 'America/New_York',
        photos: [
          {
            url: 'https://example.com/photos/original/photo1.jpg',
            width: 1920,
            height: 1080
          },
          {
            url: 'https://example.com/photos/original/photo2.jpg',
            width: 1280,
            height: 720
          }
        ]
      });
    });

    test('transforms checkin without photos correctly', () => {
      const foursquareCheckin = {
        id: 'checkin456',
        createdAt: 1609459200,
        venue: {
          id: 'venue456',
          name: 'Another Venue',
          categories: [
            {
              name: 'Restaurant'
            }
          ],
          location: {
            lat: 51.5074,
            lng: -0.1278,
            city: 'London',
            country: 'United Kingdom'
          }
        }
        // No photos property
      };

      const result = transformCheckin(foursquareCheckin, userId);

      expect(result).toEqual({
        user_id: userId,
        venue_id: 'venue456',
        venue_name: 'Another Venue',
        venue_category: 'Restaurant',
        latitude: 51.5074,
        longitude: -0.1278,
        checkin_date: new Date(1609459200 * 1000),
        city: 'London',
        country: 'United Kingdom',
        timezone: 'Europe/London',
        photos: []
      });
    });

    test('handles checkin with empty photos array', () => {
      const foursquareCheckin = {
        id: 'checkin789',
        createdAt: 1609459200,
        venue: {
          id: 'venue789',
          name: 'Third Venue',
          categories: [],
          location: {
            lat: 48.8566,
            lng: 2.3522
          }
        },
        photos: {
          count: 0,
          items: []
        }
      };

      const result = transformCheckin(foursquareCheckin, userId);

      expect(result.photos).toEqual([]);
      expect(result.venue_category).toBeNull();
      expect(result.city).toBeNull();
      expect(result.country).toBeNull();
    });

    test('handles photos without dimensions', () => {
      const foursquareCheckin = {
        id: 'checkin999',
        createdAt: 1609459200,
        venue: {
          id: 'venue999',
          name: 'Photo Venue',
          categories: [{ name: 'Bar' }],
          location: {
            lat: 34.0522,
            lng: -118.2437,
            city: 'Los Angeles',
            country: 'USA'
          }
        },
        photos: {
          count: 1,
          items: [
            {
              id: 'photo3',
              prefix: 'https://example.com/photos/',
              suffix: '/photo3.jpg'
              // No width or height
            }
          ]
        }
      };

      const result = transformCheckin(foursquareCheckin, userId);

      expect(result.photos).toEqual([
        {
          url: 'https://example.com/photos/original/photo3.jpg',
          width: null,
          height: null
        }
      ]);
    });
  });
});
