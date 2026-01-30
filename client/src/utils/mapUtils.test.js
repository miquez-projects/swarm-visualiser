import { groupCheckinsByVenue, toGeoJSON, getMarkerColor, groupCheckinsByWeek, generateWeeksGrid } from './mapUtils';

describe('mapUtils', () => {
  describe('groupCheckinsByVenue', () => {
    test('groups multiple checkins at same venue', () => {
      const checkins = [
        { venue_id: 'v1', venue_name: 'Cafe', latitude: 40, longitude: -74, checkin_date: '2024-01-01' },
        { venue_id: 'v1', venue_name: 'Cafe', latitude: 40, longitude: -74, checkin_date: '2024-01-02' },
        { venue_id: 'v2', venue_name: 'Bar', latitude: 41, longitude: -73, checkin_date: '2024-01-01' }
      ];
      const groups = groupCheckinsByVenue(checkins);
      expect(groups).toHaveLength(2);
      const cafe = groups.find(g => g.venue_id === 'v1');
      expect(cafe.checkins).toHaveLength(2);
    });

    test('handles empty checkins array', () => {
      expect(groupCheckinsByVenue([])).toEqual([]);
    });

    test('handles null/undefined', () => {
      expect(groupCheckinsByVenue(null)).toEqual([]);
      expect(groupCheckinsByVenue(undefined)).toEqual([]);
    });

    test('uses lat,lng as key when venue_id is missing', () => {
      const checkins = [
        { venue_name: 'Place', latitude: 40, longitude: -74, checkin_date: '2024-01-01' },
        { venue_name: 'Place', latitude: 40, longitude: -74, checkin_date: '2024-01-02' }
      ];
      const groups = groupCheckinsByVenue(checkins);
      expect(groups).toHaveLength(1);
      expect(groups[0].checkins).toHaveLength(2);
    });

    test('preserves venue metadata', () => {
      const checkins = [
        { venue_id: 'v1', venue_name: 'Cafe', venue_category: 'Coffee Shop', latitude: 40, longitude: -74, city: 'NYC', country: 'US', checkin_date: '2024-01-01' }
      ];
      const groups = groupCheckinsByVenue(checkins);
      expect(groups[0]).toMatchObject({
        venue_id: 'v1',
        venue_name: 'Cafe',
        venue_category: 'Coffee Shop',
        city: 'NYC',
        country: 'US'
      });
    });
  });

  describe('toGeoJSON', () => {
    test('creates valid GeoJSON FeatureCollection', () => {
      const groups = [
        { venue_id: 'v1', venue_name: 'Cafe', venue_category: 'Coffee Shop', latitude: 40, longitude: -74, city: 'NYC', country: 'US', checkins: [{}] }
      ];
      const geojson = toGeoJSON(groups);
      expect(geojson.type).toBe('FeatureCollection');
      expect(geojson.features).toHaveLength(1);
      expect(geojson.features[0].geometry.type).toBe('Point');
      expect(geojson.features[0].geometry.coordinates).toEqual([-74, 40]);
    });

    test('includes correct properties', () => {
      const groups = [
        { venue_id: 'v1', venue_name: 'Cafe', venue_category: 'Coffee Shop', latitude: 40, longitude: -74, city: 'NYC', country: 'US', checkins: [{}, {}] }
      ];
      const geojson = toGeoJSON(groups);
      expect(geojson.features[0].properties).toEqual({
        venueId: 'v1',
        venueName: 'Cafe',
        checkinCount: 2,
        category: 'Coffee Shop',
        city: 'NYC',
        country: 'US'
      });
    });

    test('handles empty array', () => {
      const geojson = toGeoJSON([]);
      expect(geojson.type).toBe('FeatureCollection');
      expect(geojson.features).toEqual([]);
    });
  });

  describe('getMarkerColor', () => {
    test('returns correct color for known categories', () => {
      expect(getMarkerColor('Coffee Shop')).toBe('#8f3d00');
      expect(getMarkerColor('Restaurant')).toBe('#a63d30');
    });

    test('returns Unknown color for unknown categories', () => {
      expect(getMarkerColor('Unknown Category XYZ')).toBe('#5a6566');
    });

    test('returns same color as Unknown for missing category', () => {
      expect(getMarkerColor('Nonexistent')).toBe('#5a6566');
      expect(getMarkerColor('Unknown')).toBe('#5a6566');
    });
  });

  describe('groupCheckinsByWeek', () => {
    test('groups checkins into week buckets by Monday', () => {
      const checkins = [
        { checkin_date: '2024-01-08T10:00:00Z' }, // Monday
        { checkin_date: '2024-01-09T10:00:00Z' }, // Tuesday same week
        { checkin_date: '2024-01-15T10:00:00Z' }, // Next Monday
      ];
      const result = groupCheckinsByWeek(checkins);
      expect(result['2024-01-08']).toBe(2);
      expect(result['2024-01-15']).toBe(1);
    });

    test('handles empty array', () => {
      expect(groupCheckinsByWeek([])).toEqual({});
    });

    test('groups Sunday into previous week', () => {
      // 2024-01-14 is a Sunday, should group with Monday 2024-01-08
      const checkins = [{ checkin_date: '2024-01-14T10:00:00Z' }];
      const result = groupCheckinsByWeek(checkins);
      expect(result['2024-01-08']).toBe(1);
    });
  });

  describe('generateWeeksGrid', () => {
    test('generates year/month/week structure', () => {
      const checkinsByWeek = { '2024-01-08': 3, '2024-01-15': 1 };
      const start = new Date('2024-01-08');
      const end = new Date('2024-01-20');
      const result = generateWeeksGrid(checkinsByWeek, start, end);

      expect(result).toHaveLength(1);
      expect(result[0].year).toBe(2024);
      expect(result[0].months[0].month).toBe(0); // January
      expect(result[0].months[0].weeks).toHaveLength(2);
      expect(result[0].months[0].weeks[0]).toEqual({ weekStart: '2024-01-08', count: 3 });
      expect(result[0].months[0].weeks[1]).toEqual({ weekStart: '2024-01-15', count: 1 });
    });

    test('returns empty array when start > end', () => {
      const result = generateWeeksGrid({}, new Date('2024-02-01'), new Date('2024-01-01'));
      expect(result).toEqual([]);
    });

    test('spans multiple years', () => {
      const start = new Date('2023-12-25');
      const end = new Date('2024-01-08');
      const result = generateWeeksGrid({}, start, end);
      expect(result).toHaveLength(2);
      expect(result[0].year).toBe(2023);
      expect(result[1].year).toBe(2024);
    });
  });
});
