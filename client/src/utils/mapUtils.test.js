import { groupCheckinsByVenue, toGeoJSON, getMarkerColor } from './mapUtils';

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
    test('returns a color string for known categories', () => {
      const color = getMarkerColor('Coffee Shop');
      expect(typeof color).toBe('string');
    });

    test('returns a default color for unknown categories', () => {
      const color = getMarkerColor('Unknown Category XYZ');
      expect(typeof color).toBe('string');
    });

    test('returns same color as Unknown for missing category', () => {
      const unknownColor = getMarkerColor('Unknown');
      const missingColor = getMarkerColor('Nonexistent');
      expect(missingColor).toBe(unknownColor);
    });
  });
});
