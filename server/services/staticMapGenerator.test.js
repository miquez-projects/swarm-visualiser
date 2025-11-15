const staticMapGenerator = require('./staticMapGenerator');

describe('Static Map Generator', () => {
  describe('generateCheckinMapUrl', () => {
    it('should generate valid Mapbox Static API URL for checkins', () => {
      const checkins = [
        { longitude: -74.0060, latitude: 40.7128 },
        { longitude: -74.0070, latitude: 40.7138 }
      ];

      const url = staticMapGenerator.generateCheckinMapUrl(checkins);

      expect(url).toContain('api.mapbox.com');
      expect(url).toContain('path');
      expect(url).toContain('pin-s');
      expect(url).toContain('600x400');
    });

    it('should return null for empty checkins', () => {
      const url = staticMapGenerator.generateCheckinMapUrl([]);

      expect(url).toBeNull();
    });
  });

  describe('generateActivityMapUrl', () => {
    it('should generate URL for Garmin activity with WKT tracklog', () => {
      const tracklog = 'LINESTRING(-74.0060 40.7128, -74.0070 40.7138)';

      const url = staticMapGenerator.generateActivityMapUrl(tracklog);

      expect(url).toContain('api.mapbox.com');
      expect(url).toContain('path');
    });

    it('should generate URL for Strava activity with polyline', () => {
      const polyline = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';

      const url = staticMapGenerator.generateActivityMapUrl(polyline);

      expect(url).toContain('api.mapbox.com');
      expect(url).toContain('path');
    });

    it('should return null for null tracklog', () => {
      const url = staticMapGenerator.generateActivityMapUrl(null);

      expect(url).toBeNull();
    });
  });

  describe('parseLineString', () => {
    it('should parse PostGIS LineString (Garmin format) correctly', () => {
      const wkt = 'LINESTRING(-74.0060 40.7128, -74.0070 40.7138)';

      const coords = staticMapGenerator.parseLineString(wkt);

      expect(coords).toHaveLength(2);
      expect(coords[0]).toEqual([-74.0060, 40.7128]);
      expect(coords[1]).toEqual([-74.0070, 40.7138]);
    });

    it('should return empty array for invalid WKT', () => {
      const wkt = 'INVALID';

      const coords = staticMapGenerator.parseLineString(wkt);

      expect(coords).toEqual([]);
    });
  });
});
