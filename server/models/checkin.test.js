jest.mock('../db/connection', () => ({ query: jest.fn() }));

const db = require('../db/connection');
const Checkin = require('./checkin');

beforeEach(() => {
  jest.resetAllMocks();
});

describe('Checkin.find', () => {
  const mockRows = [
    { id: 1, venue_name: 'Coffee Shop', latitude: 47.5, longitude: 19.0 },
  ];

  beforeEach(() => {
    db.query
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({ rows: mockRows });
  });

  test('returns data with default limit when no filters', async () => {
    const result = await Checkin.find();
    expect(result.data).toEqual(mockRows);
    expect(result.total).toBe(1);
    expect(result.limit).toBe(5000);
    expect(result.offset).toBe(0);
    // count query
    expect(db.query.mock.calls[0][0]).toContain('SELECT COUNT(*)');
    // data query
    expect(db.query.mock.calls[1][0]).toContain('ORDER BY checkin_date DESC');
  });

  test('filters by userId', async () => {
    await Checkin.find({ userId: 'u1' });
    expect(db.query.mock.calls[0][0]).toContain('user_id = $1');
    expect(db.query.mock.calls[0][1]).toContain('u1');
  });

  test('filters by date range', async () => {
    await Checkin.find({ startDate: '2024-01-01', endDate: '2024-12-31' });
    expect(db.query.mock.calls[0][0]).toContain('checkin_date >= $1');
    expect(db.query.mock.calls[0][0]).toContain('checkin_date <= $2');
  });

  test('filters by category', async () => {
    await Checkin.find({ category: 'Coffee Shop' });
    expect(db.query.mock.calls[0][0]).toContain('venue_category = $1');
  });

  test('filters by category array', async () => {
    await Checkin.find({ category: ['Coffee Shop', 'Bar'] });
    expect(db.query.mock.calls[0][0]).toContain('venue_category = ANY($1)');
  });

  test('filters by bounds', async () => {
    await Checkin.find({ bounds: '18.0,46.0,20.0,48.0' });
    expect(db.query.mock.calls[0][0]).toContain('latitude BETWEEN');
    // Verify correct param order: minLat, maxLat, minLng, maxLng
    expect(db.query.mock.calls[0][1]).toEqual(
      expect.arrayContaining([46.0, 48.0, 18.0, 20.0])
    );
  });

  test('throws on invalid bounds', async () => {
    await expect(Checkin.find({ bounds: 'bad,data,here,now' })).rejects.toThrow('Invalid bounds format');
  });

  test('throws on out-of-range bounds', async () => {
    await expect(Checkin.find({ bounds: '0,-100,10,10' })).rejects.toThrow('Invalid bounds range');
  });

  test('throws when min >= max in bounds', async () => {
    await expect(Checkin.find({ bounds: '10,10,5,5' })).rejects.toThrow('min values must be less than max values');
  });

  test('uses sampling at low zoom without semantic filters', async () => {
    await Checkin.find({ zoom: 3 });
    expect(db.query.mock.calls[1][0]).toContain('DISTINCT ON');
    expect(db.query.mock.calls[1][0]).toContain('FLOOR(latitude * 10)');
  });

  test('does not sample at high zoom', async () => {
    await Checkin.find({ zoom: 10 });
    expect(db.query.mock.calls[1][0]).not.toContain('DISTINCT ON');
    expect(db.query.mock.calls[1][0]).toContain('ORDER BY checkin_date DESC');
  });

  test('does not sample at low zoom with semantic filter', async () => {
    await Checkin.find({ zoom: 3, country: 'Hungary' });
    expect(db.query.mock.calls[1][0]).not.toContain('DISTINCT ON');
  });

  test('uses higher default limit with semantic filters', async () => {
    const result = await Checkin.find({ country: 'Hungary' });
    expect(result.limit).toBe(50000);
  });
});

describe('Checkin.getStats', () => {
  function mockStatsQueries({ total = '100', venues = '50', firstCheckin = '2024-01-01', lastCheckin = '2024-06-01', topCountries = [], topCategories = [], topVenue = [], timeline = [], unmappable = '0' } = {}) {
    db.query
      .mockResolvedValueOnce({ rows: [{ total }] })
      .mockResolvedValueOnce({ rows: [{ total: venues }] })
      .mockResolvedValueOnce({ rows: [{ first_checkin: firstCheckin, last_checkin: lastCheckin }] })
      .mockResolvedValueOnce({ rows: topCountries })
      .mockResolvedValueOnce({ rows: topCategories })
      .mockResolvedValueOnce({ rows: topVenue })
      .mockResolvedValueOnce({ rows: timeline })
      .mockResolvedValueOnce({ rows: [{ count: unmappable }] });
  }

  test('returns aggregated statistics', async () => {
    mockStatsQueries({
      topCountries: [{ country: 'HU', count: '80' }],
      topCategories: [{ category: 'Coffee', count: '30' }],
      topVenue: [{ venue_name: 'Starbucks', count: '10' }],
      timeline: [{ year: 2024, month: 1, count: '15' }],
      unmappable: '2',
    });

    const result = await Checkin.getStats({ userId: 'u1' });

    expect(result.total_checkins).toBe(100);
    expect(result.total_venues).toBe(50);
    expect(result.date_range).toEqual({ first_checkin: '2024-01-01', last_checkin: '2024-06-01' });
    expect(result.top_countries).toEqual([{ country: 'HU', count: '80' }]);
    expect(result.top_categories).toEqual([{ category: 'Coffee', count: '30' }]);
    expect(result.top_venue).toEqual({ venue_name: 'Starbucks', count: '10' });
    expect(result.timeline).toEqual([{ year: 2024, month: 1, count: '15' }]);
    expect(result.unmappable_count).toBe(2);
  });

  test('returns null top_venue when no venues', async () => {
    mockStatsQueries({
      total: '0', venues: '0', firstCheckin: null, lastCheckin: null,
      topVenue: [], unmappable: '0',
    });

    const result = await Checkin.getStats();
    expect(result.top_venue).toBeNull();
  });
});

describe('Checkin.getFilterOptions', () => {
  test('returns distinct countries, cities, categories', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ country: 'Hungary' }, { country: 'Germany' }] })
      .mockResolvedValueOnce({ rows: [{ city: 'Budapest' }] })
      .mockResolvedValueOnce({ rows: [{ venue_category: 'Coffee Shop' }] });

    const result = await Checkin.getFilterOptions('u1');

    expect(result.countries).toEqual(['Hungary', 'Germany']);
    expect(result.cities).toEqual(['Budapest']);
    expect(result.categories).toEqual(['Coffee Shop']);

    for (let i = 0; i < 3; i++) {
      expect(db.query.mock.calls[i][1]).toEqual(['u1']);
    }
  });
});

describe('Checkin.insert', () => {
  test('inserts a checkin and returns it', async () => {
    const checkin = {
      user_id: 'u1', venue_id: 'v1', venue_name: 'Test Cafe',
      venue_category: 'Coffee Shop', latitude: 47.5, longitude: 19.0,
      checkin_date: '2024-01-01T12:00:00Z', city: 'Budapest',
      country: 'Hungary', timezone: 'Europe/Budapest',
    };
    const returned = { id: 1, ...checkin };
    db.query.mockResolvedValueOnce({ rows: [returned] });

    const result = await Checkin.insert(checkin);
    expect(result).toEqual(returned);
    expect(db.query.mock.calls[0][0]).toContain('INSERT INTO checkins');
    expect(db.query.mock.calls[0][0]).toContain('RETURNING *');
    expect(db.query.mock.calls[0][1]).toEqual([
      'u1', 'v1', 'Test Cafe', 'Coffee Shop', 47.5, 19.0,
      '2024-01-01T12:00:00Z', 'Budapest', 'Hungary', 'Europe/Budapest',
    ]);
  });

  test('uses defaults for missing optional fields', async () => {
    db.query.mockResolvedValueOnce({ rows: [{}] });
    await Checkin.insert({ venue_name: 'X', checkin_date: '2024-01-01' });
    const params = db.query.mock.calls[0][1];
    expect(params[0]).toBeNull();       // user_id
    expect(params[3]).toBe('Unknown');  // venue_category
    expect(params[7]).toBe('Unknown');  // city
    expect(params[8]).toBe('Unknown');  // country
  });
});

describe('Checkin.bulkInsert', () => {
  test('returns 0 for empty array', async () => {
    expect(await Checkin.bulkInsert([])).toBe(0);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('returns 0 for null', async () => {
    expect(await Checkin.bulkInsert(null)).toBe(0);
  });

  test('throws on missing required fields', async () => {
    await expect(Checkin.bulkInsert([{ venue_name: 'X' }])).rejects.toThrow('Invalid checkins');
  });

  test('inserts multiple checkins with ON CONFLICT DO NOTHING', async () => {
    db.query.mockResolvedValueOnce({ rowCount: 2 });

    const checkins = [
      { venue_name: 'A', checkin_date: '2024-01-01', city: 'Budapest', country: 'HU' },
      { venue_name: 'B', checkin_date: '2024-01-02' },
    ];

    const result = await Checkin.bulkInsert(checkins);
    expect(result).toBe(2);
    expect(db.query.mock.calls[0][0]).toContain('ON CONFLICT DO NOTHING');
    expect(db.query.mock.calls[0][1]).toHaveLength(20);
  });
});
