jest.mock('../db/connection', () => ({ query: jest.fn() }));

const db = require('../db/connection');
const queryBuilder = require('./queryBuilder');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('QueryBuilder', () => {
  describe('validateField', () => {
    test('accepts whitelisted fields', () => {
      const allowed = ['venue_name', 'checkin_date', 'country', 'city', 'venue_category', 'id', 'venue_id', 'latitude', 'longitude', 'created_at'];
      allowed.forEach(field => {
        expect(queryBuilder.validateField(field)).toBe(field);
      });
    });

    test('rejects non-whitelisted fields (SQL injection prevention)', () => {
      const malicious = [
        'DROP TABLE checkins',
        '1; DROP TABLE checkins--',
        'venue_name; DELETE FROM checkins',
        'nonexistent_field',
        'user_id',
        '* FROM checkins; --',
      ];
      malicious.forEach(field => {
        expect(() => queryBuilder.validateField(field)).toThrow('Field not allowed');
      });
    });

    test('rejects non-string field types', () => {
      expect(() => queryBuilder.validateField(123)).toThrow('Invalid field type');
      expect(() => queryBuilder.validateField(null)).toThrow('Invalid field type');
      expect(() => queryBuilder.validateField(undefined)).toThrow('Invalid field type');
    });
  });

  describe('executeQuery', () => {
    test('enforces maximum result limit of 500', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '1000' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await queryBuilder.executeQuery({
        queryType: 'checkins',
        limit: 9999,
      }, 'user-1');

      // The count query + main query
      const mainQuerySql = db.query.mock.calls[1][0];
      expect(mainQuerySql).toContain('LIMIT 500');
      expect(result.metadata.limited).toBe(true);
    });

    test('scopes queries to authenticated user', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      await queryBuilder.executeQuery({ queryType: 'checkins' }, 'user-42');

      // Both count and main query should have user_id = $1 with the userId value
      expect(db.query.mock.calls[0][1]).toEqual(['user-42']);
      expect(db.query.mock.calls[1][1]).toEqual(['user-42']);
    });

    test('throws on invalid query type', async () => {
      await expect(queryBuilder.executeQuery({ queryType: 'invalid' }, 'u1'))
        .rejects.toThrow('Invalid query type');
    });
  });

  describe('getCategories', () => {
    test('returns distinct categories for user', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ venue_category: 'Bar' }, { venue_category: 'Restaurant' }]
      });

      const result = await queryBuilder.getCategories('user-1');

      expect(result).toEqual(['Bar', 'Restaurant']);
      expect(db.query.mock.calls[0][1]).toEqual(['user-1']);
      expect(db.query.mock.calls[0][0]).toContain('DISTINCT venue_category');
      expect(db.query.mock.calls[0][0]).toContain('user_id = $1');
    });
  });

  describe('buildAggregationQuery', () => {
    test('supports date granularity options', () => {
      const granularities = {
        day: 'DATE(checkin_date)',
        week: "DATE_TRUNC('week', checkin_date)",
        month: "DATE_TRUNC('month', checkin_date)",
        year: "DATE_TRUNC('year', checkin_date)",
      };

      Object.entries(granularities).forEach(([granularity, expected]) => {
        const result = queryBuilder.buildAggregationQuery({
          queryType: 'aggregation',
          aggregation: { function: 'count' },
          groupBy: [{ field: 'checkin_date', granularity }],
        }, 'user-1');

        expect(result.sql).toContain(expected);
        expect(result.sql).toContain('GROUP BY');
      });
    });

    test('rejects invalid aggregation function', () => {
      expect(() => queryBuilder.buildAggregationQuery({
        aggregation: { function: 'DROP' },
        groupBy: [],
      }, 'u1')).toThrow('Invalid aggregation function');
    });

    test('rejects invalid date granularity', () => {
      expect(() => queryBuilder.buildAggregationQuery({
        aggregation: { function: 'count' },
        groupBy: [{ field: 'checkin_date', granularity: 'century' }],
      }, 'u1')).toThrow('Invalid date granularity');
    });
  });
});
