import { formatDateRange, prepareComparisonBarData, prepareComparisonTimelineData } from './statsUtils';

describe('statsUtils', () => {
  describe('formatDateRange', () => {
    test('returns formatted date range', () => {
      const data = {
        date_range: {
          first_checkin: '2024-01-01T00:00:00Z',
          last_checkin: '2024-12-31T00:00:00Z'
        }
      };
      const result = formatDateRange(data);
      expect(result).toContain(' - ');
      expect(typeof result).toBe('string');
    });

    test('returns "No data" for null input', () => {
      expect(formatDateRange(null)).toBe('No data');
    });

    test('returns "No data" for missing date_range', () => {
      expect(formatDateRange({})).toBe('No data');
    });

    test('returns "No data" for missing first_checkin', () => {
      expect(formatDateRange({ date_range: { last_checkin: '2024-12-31' } })).toBe('No data');
    });
  });

  describe('prepareComparisonBarData', () => {
    test('merges two period arrays by key', () => {
      const p1 = [{ country: 'US', count: '10' }, { country: 'UK', count: '5' }];
      const p2 = [{ country: 'US', count: '8' }, { country: 'FR', count: '3' }];
      const result = prepareComparisonBarData(p1, p2, 'country');

      expect(result.length).toBeLessThanOrEqual(5);
      const us = result.find(r => r.name === 'US');
      expect(us.period1).toBe(10);
      expect(us.period2).toBe(8);
    });

    test('handles items only in period 2', () => {
      const p1 = [];
      const p2 = [{ country: 'FR', count: '3' }];
      const result = prepareComparisonBarData(p1, p2, 'country');
      expect(result).toHaveLength(1);
      expect(result[0].period1).toBe(0);
      expect(result[0].period2).toBe(3);
    });

    test('sorts by total descending and limits to 5', () => {
      const items = Array.from({ length: 8 }, (_, i) => ({ cat: `cat${i}`, count: String(i + 1) }));
      const result = prepareComparisonBarData(items, [], 'cat');
      expect(result).toHaveLength(5);
      expect(result[0].total).toBeGreaterThanOrEqual(result[4].total);
    });
  });

  describe('prepareComparisonTimelineData', () => {
    test('creates indexed data points from two timelines', () => {
      const t1 = [{ count: '5' }, { count: '10' }];
      const t2 = [{ count: '3' }, { count: '7' }, { count: '2' }];
      const result = prepareComparisonTimelineData(t1, t2);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ index: 1, period1: 5, period2: 3 });
      expect(result[2].period1).toBeNull();
      expect(result[2].period2).toBe(2);
    });

    test('handles empty timelines', () => {
      expect(prepareComparisonTimelineData([], [])).toEqual([]);
    });
  });
});
