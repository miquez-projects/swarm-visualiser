import { boundsContained, addBuffer, calculateBounds } from './geoUtils';

describe('geoUtils', () => {
  describe('boundsContained', () => {
    const outer = { minLng: -10, maxLng: 10, minLat: -10, maxLat: 10 };

    test('returns true when inner is fully contained', () => {
      const inner = { minLng: -5, maxLng: 5, minLat: -5, maxLat: 5 };
      expect(boundsContained(inner, outer)).toBe(true);
    });

    test('returns true when inner equals outer', () => {
      expect(boundsContained(outer, outer)).toBe(true);
    });

    test('returns false when inner extends beyond outer', () => {
      const inner = { minLng: -15, maxLng: 5, minLat: -5, maxLat: 5 };
      expect(boundsContained(inner, outer)).toBe(false);
    });
  });

  describe('addBuffer', () => {
    test('adds buffer percentage to bounds', () => {
      const bounds = { minLng: 0, maxLng: 10, minLat: 0, maxLat: 10 };
      const result = addBuffer(bounds, 0.5);
      expect(result.minLng).toBe(-5);
      expect(result.maxLng).toBe(15);
      expect(result.minLat).toBe(-5);
      expect(result.maxLat).toBe(15);
    });

    test('clamps to valid lng/lat ranges', () => {
      const bounds = { minLng: -170, maxLng: 170, minLat: -85, maxLat: 85 };
      const result = addBuffer(bounds, 0.5);
      expect(result.minLng).toBe(-180);
      expect(result.maxLng).toBe(180);
      expect(result.minLat).toBe(-90);
      expect(result.maxLat).toBe(90);
    });
  });

  describe('calculateBounds', () => {
    test('calculates SW/NE bounds from venues', () => {
      const venues = [
        { latitude: 40, longitude: -74 },
        { latitude: 42, longitude: -70 },
        { latitude: 38, longitude: -76 }
      ];
      const bounds = calculateBounds(venues);
      expect(bounds).toEqual([[-76, 38], [-70, 42]]);
    });

    test('returns null for empty array', () => {
      expect(calculateBounds([])).toBeNull();
    });

    test('returns null for null input', () => {
      expect(calculateBounds(null)).toBeNull();
    });

    test('filters out null coordinates', () => {
      const venues = [
        { latitude: 40, longitude: -74 },
        { latitude: null, longitude: null }
      ];
      const bounds = calculateBounds(venues);
      expect(bounds).toEqual([[-74, 40], [-74, 40]]);
    });

    test('returns null when all coordinates are null', () => {
      const venues = [{ latitude: null, longitude: null }];
      expect(calculateBounds(venues)).toBeNull();
    });
  });
});
