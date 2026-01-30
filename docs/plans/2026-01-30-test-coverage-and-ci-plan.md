# Test Coverage, Garmin OAuth Removal & CI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bring the swarm-visualizer codebase from ~16% to excellent test coverage, remove the unused Garmin OAuth integration, and add a CI pipeline that gates merges on passing tests.

**Architecture:** Server tests use Jest + supertest with mocked DB/services (co-located `*.test.js` files). Client tests use Jest via react-scripts with @testing-library/react. Pure logic is extracted from components into testable utility modules. CI uses GitHub Actions with path-based filtering inspired by the 531-tracker project.

**Tech Stack:** Jest, supertest, @testing-library/react, GitHub Actions, dorny/paths-filter

---

## Current State

| Area | Source Files | Tested | Tests | Notes |
|------|-------------|--------|-------|-------|
| Server routes | 12 | 6 | 142 | Strava (73), DayInLife (24), Garmin (28, 3 failing) |
| Server services | 13 | 6 | 202 | StravaSync (85), StravaOAuth (64) excellent |
| Server models | 11 | 1 | 3 | Only dailyWeather |
| Server jobs | 5 | 0 | 0 | |
| Server middleware | 1 | 0 | 0 | |
| Client | 32 | 1 | 5 | Only venueParser |

**Test conventions (follow these exactly):**
- Server test files: co-located as `<name>.test.js` next to source
- Route tests: `supertest` against `require('../server')`, mock models + services at top
- Service tests: direct import, `jest.mock()` external deps
- Standard mocks needed in every route test:
  ```js
  jest.mock('../services/geminiSessionManager', () => ({ startCleanupInterval: jest.fn() }));
  jest.mock('../jobs/queue', () => ({
    initQueue: jest.fn().mockResolvedValue(undefined),
    getQueue: jest.fn().mockReturnValue({ work: jest.fn(), send: jest.fn() }),
    stopQueue: jest.fn()
  }));
  ```
- `beforeEach(() => jest.clearAllMocks())`
- Client tests: vanilla Jest for utils, @testing-library/react if component rendering needed

---

## Phase 1: Remove Garmin OAuth Integration

Garmin rejected the OAuth application. The OAuth code is dead. Keep Garmin JSON file upload (works without OAuth).

### Task 1: Remove Garmin OAuth server code

**Files:**
- Delete: `server/services/garminOAuth.js` (290 lines)
- Delete: `server/services/garminAuth.js` (44 lines)
- Delete: `server/routes/garmin.test.js` (entire file — tests the OAuth routes)
- Delete: `server/test-garmin-session.js`, `server/test-garmin-cookies.js`, `server/test-garmin-jwt.js` (debug scripts)
- Modify: `server/routes/garmin.js` — remove OAuth endpoints, keep upload endpoint
- Modify: `server/server.js` — keep garmin routes (upload still works)
- Modify: `server/models/user.js` — remove `updateGarminAuth`, `getGarminTokens`, `updateGarminSyncSettings`

**Step 1: Delete OAuth service files**

```bash
cd /Users/gabormikes/swarm-visualizer
rm server/services/garminOAuth.js
rm server/services/garminAuth.js
rm server/routes/garmin.test.js
rm server/test-garmin-session.js server/test-garmin-cookies.js server/test-garmin-jwt.js
```

**Step 2: Strip OAuth routes from garmin.js**

Remove these endpoints from `server/routes/garmin.js`:
- `GET /connect` (OAuth PKCE initiation)
- `GET /callback` (OAuth callback)
- `POST /sync` (queue OAuth-based sync)
- `GET /status` (OAuth connection status)
- `POST /settings` (OAuth sync settings)
- `DELETE /disconnect` (OAuth disconnect)

Keep only:
- `POST /upload` (JSON file upload — works without OAuth)

Remove the imports of `garminOAuth`, `ImportJob`, `queue` from garmin.js. Keep `multer`, `garminJsonParser`, model imports.

**Step 3: Remove Garmin OAuth methods from user.js**

Remove from `server/models/user.js`:
- `updateGarminAuth` method
- `getGarminTokens` method
- `updateGarminSyncSettings` method

Keep all other methods (findById, create, updateLastGarminSync, etc.).

**Step 4: Remove Garmin OAuth import job handler references**

Modify `server/jobs/queue.js`: remove the `import-garmin-data` job registration IF it depends on OAuth sync. Check first — if `importGarminData.js` is only used for OAuth-triggered syncs, remove it. If it's also used by the file upload flow, keep it.

Check: `server/jobs/importGarminData.js` — this calls `garminSync.incrementalSync()` and `garminSync.fullHistoricalSync()`, which both use `garminOAuth.makeAuthenticatedRequest()`. This handler is OAuth-only. Remove it.

```bash
rm server/jobs/importGarminData.js
```

Update `server/jobs/queue.js` to remove the `import-garmin-data` handler registration.

**Step 5: Clean up garminSync.js OAuth methods**

`server/services/garminSync.js` has two modes:
- OAuth-based sync (syncActivities, syncDailyMetrics via garminOAuth) — **remove**
- The file is entirely OAuth-dependent — **delete it**

```bash
rm server/services/garminSync.js
```

Note: `garminJsonParser.js` (used by file upload) is independent and stays.

**Step 6: Remove Garmin sync from dailySyncOrchestrator**

Modify `server/jobs/dailySyncOrchestrator.js`: remove any Garmin sync job queuing. Only queue Strava/Foursquare syncs.

**Step 7: Remove Garmin sync from syncAll.js**

Modify `server/services/syncAll.js`: remove Garmin sync logic. Only sync Foursquare and Strava.

**Step 8: Run server tests**

```bash
cd /Users/gabormikes/swarm-visualizer/server && npm test
```

Expected: All 14 test suites pass (garmin.test.js was deleted, so the 3 failures disappear). 249 tests, 0 failures.

**Step 9: Verify server startup**

```bash
cd /Users/gabormikes/swarm-visualizer/server
node -e "const s = require('child_process').spawn('node', ['server.js'], {stdio:'pipe'}); let o=''; s.stdout.on('data',d=>{o+=d;process.stdout.write(d)}); s.stderr.on('data',d=>{o+=d;process.stderr.write(d)}); setTimeout(()=>{s.kill();console.log('\nStartup OK')},8000)"
```

Expected: Server starts, prints "Server running on port 3001", no module errors.

**Step 10: Commit**

```bash
git add -A
git commit -m "refactor: remove Garmin OAuth integration

Garmin rejected the OAuth application. Remove all OAuth-related code:
- garminOAuth.js, garminAuth.js, garminSync.js services
- OAuth routes (connect, callback, sync, status, settings, disconnect)
- importGarminData job handler
- User model OAuth methods
- Debug test scripts

Keep Garmin JSON file upload (works without OAuth)."
```

### Task 2: Remove Garmin OAuth UI from client

**Files:**
- Modify: `client/src/pages/DataSourcesPage.jsx` — remove Garmin OAuth card (lines ~492-557), keep file upload card (lines ~559-623)
- Modify: `client/src/services/api.js` — remove any Garmin OAuth API functions if they exist

**Step 1: Remove Garmin OAuth UI from DataSourcesPage.jsx**

Remove:
- Garmin OAuth connection card (connect/disconnect buttons, status display, activity sync toggle)
- Any state variables related to Garmin OAuth (garminStatus, garminConnected, etc.)
- Any useEffect hooks that check Garmin OAuth status

Keep:
- Garmin Data Upload card (file upload input, upload button, results display)
- `handleGarminFileUpload` function

**Step 2: Remove Garmin OAuth API functions from api.js**

Remove any functions like `connectGarmin`, `disconnectGarmin`, `getGarminStatus`, `syncGarminData` — anything that calls the deleted OAuth endpoints.

Keep: any API function related to Garmin file upload.

**Step 3: Test client build**

```bash
cd /Users/gabormikes/swarm-visualizer/client && npx react-scripts build
```

Expected: Build succeeds with no errors.

**Step 4: Run client tests**

```bash
cd /Users/gabormikes/swarm-visualizer/client && npx react-scripts test --watchAll=false
```

Expected: 5 tests pass.

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove Garmin OAuth UI from client

Remove OAuth connection card, status checks, and API functions.
Keep Garmin JSON file upload functionality."
```

---

## Phase 2: Security & Foundation Tests

### Task 3: Test encryption service

**Files:**
- Test: `server/services/encryption.test.js`

**Step 1: Write the tests**

```js
const { encrypt, decrypt } = require('./encryption');

describe('Encryption Service', () => {
  // Set a deterministic key for tests
  beforeAll(() => {
    process.env.ENCRYPTION_KEY = 'test-encryption-key-for-unit-tests-32!';
  });

  describe('encrypt', () => {
    test('returns a string in iv:authTag:encrypted format', () => {
      const result = encrypt('hello world');
      const parts = result.split(':');
      expect(parts).toHaveLength(3);
      // IV is 12 bytes = 24 hex chars
      expect(parts[0]).toHaveLength(24);
      // Auth tag is 16 bytes = 32 hex chars
      expect(parts[1]).toHaveLength(32);
      // Encrypted data is non-empty hex
      expect(parts[2].length).toBeGreaterThan(0);
    });

    test('produces different ciphertexts for the same input (random IV)', () => {
      const a = encrypt('same input');
      const b = encrypt('same input');
      expect(a).not.toBe(b);
    });
  });

  describe('decrypt', () => {
    test('round-trips correctly', () => {
      const original = 'sensitive token data';
      const encrypted = encrypt(original);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(original);
    });

    test('handles special characters', () => {
      const original = '{"access_token":"abc123","refresh_token":"def456"}';
      const encrypted = encrypt(original);
      expect(decrypt(encrypted)).toBe(original);
    });

    test('handles empty string', () => {
      const encrypted = encrypt('');
      expect(decrypt(encrypted)).toBe('');
    });
  });
});
```

**Step 2: Run the test**

```bash
cd /Users/gabormikes/swarm-visualizer/server && npx jest services/encryption.test.js --verbose
```

Expected: 5 tests pass.

**Step 3: Commit**

```bash
git add server/services/encryption.test.js
git commit -m "test: add encryption service tests"
```

### Task 4: Test auth middleware

**Files:**
- Test: `server/middleware/auth.test.js`

**Step 1: Write the tests**

```js
const User = require('../models/user');

jest.mock('../models/user');
jest.mock('../services/geminiSessionManager', () => ({ startCleanupInterval: jest.fn() }));
jest.mock('../jobs/queue', () => ({
  initQueue: jest.fn().mockResolvedValue(undefined),
  getQueue: jest.fn().mockReturnValue({ work: jest.fn(), send: jest.fn() }),
  stopQueue: jest.fn()
}));

const request = require('supertest');
const app = require('../server');

describe('Auth Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('authenticateToken', () => {
    test('passes with valid token in header', async () => {
      User.findBySecretToken.mockResolvedValueOnce({ id: 1, display_name: 'Test' });

      const response = await request(app)
        .get('/api/checkins')
        .set('x-auth-token', 'valid-token');

      expect(response.status).not.toBe(401);
      expect(User.findBySecretToken).toHaveBeenCalledWith('valid-token');
    });

    test('passes with valid token in query param', async () => {
      User.findBySecretToken.mockResolvedValueOnce({ id: 1, display_name: 'Test' });

      const response = await request(app)
        .get('/api/checkins?token=valid-token');

      expect(response.status).not.toBe(401);
      expect(User.findBySecretToken).toHaveBeenCalledWith('valid-token');
    });

    test('rejects missing token with 401', async () => {
      const response = await request(app).get('/api/checkins');
      expect(response.status).toBe(401);
    });

    test('rejects invalid token with 401', async () => {
      User.findBySecretToken.mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/checkins')
        .set('x-auth-token', 'bad-token');

      expect(response.status).toBe(401);
    });

    test('updates last_login_at on first request (throttled)', async () => {
      const mockUser = { id: 1, display_name: 'Test' };
      User.findBySecretToken.mockResolvedValue(mockUser);
      User.update = jest.fn().mockResolvedValue({});

      await request(app)
        .get('/api/checkins')
        .set('x-auth-token', 'valid-token');

      // The middleware fires-and-forgets the update, so we check it was called
      // (implementation uses a 5-min throttle cache)
    });
  });
});
```

**Step 2: Run the test**

```bash
cd /Users/gabormikes/swarm-visualizer/server && npx jest middleware/auth.test.js --verbose
```

Expected: 5 tests pass.

**Step 3: Commit**

```bash
git add server/middleware/auth.test.js
git commit -m "test: add auth middleware tests"
```

### Task 5: Test queryBuilder service

**Files:**
- Test: `server/services/queryBuilder.test.js`

This is the most security-critical test — the AI copilot builds SQL through this service.

**Step 1: Write the tests**

```js
jest.mock('../db/connection', () => ({
  query: jest.fn()
}));

const db = require('../db/connection');
const queryBuilder = require('./queryBuilder');

describe('QueryBuilder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateField', () => {
    test('accepts whitelisted fields', () => {
      // Test by attempting a query with valid fields
      // validateField is called internally by buildCheckinsQuery
      expect(() => queryBuilder.validateField('venue_name')).not.toThrow();
      expect(() => queryBuilder.validateField('checkin_date')).not.toThrow();
      expect(() => queryBuilder.validateField('country')).not.toThrow();
      expect(() => queryBuilder.validateField('city')).not.toThrow();
      expect(() => queryBuilder.validateField('venue_category')).not.toThrow();
    });

    test('rejects non-whitelisted fields (SQL injection prevention)', () => {
      expect(() => queryBuilder.validateField('password')).toThrow();
      expect(() => queryBuilder.validateField('secret_token')).toThrow();
      expect(() => queryBuilder.validateField('1; DROP TABLE users')).toThrow();
      expect(() => queryBuilder.validateField('')).toThrow();
    });
  });

  describe('executeQuery', () => {
    test('enforces maximum result limit of 500', async () => {
      db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });

      await queryBuilder.executeQuery({
        userId: 1,
        type: 'checkins',
        limit: 9999
      });

      const queryCall = db.query.mock.calls[0];
      // The SQL should contain LIMIT 500 (max), not 9999
      expect(queryCall[0]).toContain('LIMIT');
      const limitParam = queryCall[1][queryCall[1].length - 1];
      expect(limitParam).toBeLessThanOrEqual(500);
    });

    test('scopes queries to the authenticated user', async () => {
      db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });

      await queryBuilder.executeQuery({
        userId: 42,
        type: 'checkins'
      });

      const queryCall = db.query.mock.calls[0];
      expect(queryCall[0]).toContain('user_id');
      expect(queryCall[1]).toContain(42);
    });
  });

  describe('getCategories', () => {
    test('returns distinct categories for user', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { venue_category: 'Coffee Shop' },
          { venue_category: 'Restaurant' }
        ]
      });

      const result = await queryBuilder.getCategories(1);

      expect(result).toEqual(['Coffee Shop', 'Restaurant']);
      expect(db.query.mock.calls[0][1]).toContain(1);
    });
  });

  describe('buildAggregationQuery', () => {
    test('supports date granularity options', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await queryBuilder.executeQuery({
        userId: 1,
        type: 'aggregation',
        groupBy: 'venue_category',
        granularity: 'month'
      });

      const sql = db.query.mock.calls[0][0];
      expect(sql).toContain('GROUP BY');
    });
  });
});
```

**Step 2: Run the test**

```bash
cd /Users/gabormikes/swarm-visualizer/server && npx jest services/queryBuilder.test.js --verbose
```

Expected: Tests pass. If `validateField` is not exported, adjust the test to exercise it indirectly through `executeQuery` with invalid fields.

**Step 3: Commit**

```bash
git add server/services/queryBuilder.test.js
git commit -m "test: add queryBuilder tests (SQL injection prevention)"
```

---

## Phase 3: Core Server Logic

### Task 6: Test geminiSessionManager

**Files:**
- Test: `server/services/geminiSessionManager.test.js`

**Step 1: Write the tests**

```js
jest.mock('./geminiService', () => ({
  getModel: jest.fn().mockReturnValue({
    startChat: jest.fn().mockReturnValue({
      sendMessage: jest.fn().mockResolvedValue({
        response: { text: jest.fn().mockReturnValue('test') }
      })
    })
  }),
  getTools: jest.fn().mockReturnValue([])
}));

const sessionManager = require('./geminiSessionManager');

describe('GeminiSessionManager', () => {
  beforeEach(() => {
    // Clear all sessions between tests
    sessionManager.sessions?.clear?.() || (sessionManager._sessions = new Map());
    jest.clearAllMocks();
  });

  describe('validateUserId', () => {
    test('accepts valid numeric user IDs', () => {
      expect(() => sessionManager.validateUserId(1)).not.toThrow();
      expect(() => sessionManager.validateUserId(999)).not.toThrow();
    });

    test('rejects invalid user IDs', () => {
      expect(() => sessionManager.validateUserId(null)).toThrow();
      expect(() => sessionManager.validateUserId(undefined)).toThrow();
      expect(() => sessionManager.validateUserId('abc')).toThrow();
    });
  });

  describe('formatHistory', () => {
    test('converts conversation history to Gemini format', () => {
      const history = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' }
      ];

      const formatted = sessionManager.formatHistory(history);

      expect(formatted).toEqual([
        { role: 'user', parts: [{ text: 'Hello' }] },
        { role: 'model', parts: [{ text: 'Hi there' }] }
      ]);
    });

    test('preserves thought signatures in assistant messages', () => {
      const history = [
        { role: 'assistant', content: '<thought>thinking</thought>Response' }
      ];

      const formatted = sessionManager.formatHistory(history);
      expect(formatted[0].parts[0].text).toContain('<thought>');
    });

    test('handles empty history', () => {
      expect(sessionManager.formatHistory([])).toEqual([]);
      expect(sessionManager.formatHistory(null)).toEqual([]);
    });
  });

  describe('getOrCreateSession', () => {
    test('creates a new session for a new user', async () => {
      const session = await sessionManager.getOrCreateSession(1, []);
      expect(session).toBeDefined();
    });

    test('returns existing session for same user', async () => {
      const session1 = await sessionManager.getOrCreateSession(1, []);
      const session2 = await sessionManager.getOrCreateSession(1, []);
      // Same session object (cached)
      expect(session1).toBe(session2);
    });
  });

  describe('cleanup', () => {
    test('removes expired sessions', async () => {
      await sessionManager.getOrCreateSession(1, []);
      // Manually expire the session by setting its timestamp
      const sessions = sessionManager.sessions || sessionManager._sessions;
      if (sessions && sessions.size > 0) {
        const entry = sessions.values().next().value;
        if (entry.lastAccessed) {
          entry.lastAccessed = Date.now() - 31 * 60 * 1000; // 31 min ago
        }
      }
      sessionManager.cleanup();
      // After cleanup, getting session should create a new one
    });
  });
});
```

**Step 2: Run the test**

```bash
cd /Users/gabormikes/swarm-visualizer/server && npx jest services/geminiSessionManager.test.js --verbose
```

Expected: Tests pass. Adjust property names if the internal API differs (e.g., `sessions` vs `_sessions`).

**Step 3: Commit**

```bash
git add server/services/geminiSessionManager.test.js
git commit -m "test: add geminiSessionManager tests"
```

### Task 7: Test User model

**Files:**
- Test: `server/models/user.test.js`

**Step 1: Write the tests**

```js
jest.mock('../db/connection', () => ({
  query: jest.fn()
}));

const db = require('../db/connection');
const User = require('./user');

describe('User Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    test('returns user when found', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, display_name: 'Test User' }]
      });

      const user = await User.findById(1);
      expect(user).toEqual({ id: 1, display_name: 'Test User' });
      expect(db.query.mock.calls[0][1]).toEqual([1]);
    });

    test('returns null when not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const user = await User.findById(999);
      expect(user).toBeNull();
    });
  });

  describe('findBySecretToken', () => {
    test('returns user when token matches', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, secret_token: 'abc123' }]
      });

      const user = await User.findBySecretToken('abc123');
      expect(user).toBeDefined();
      expect(user.id).toBe(1);
    });

    test('returns null for invalid token', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const user = await User.findBySecretToken('invalid');
      expect(user).toBeNull();
    });
  });

  describe('create', () => {
    test('creates user with auto-generated secret token', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, secret_token: 'generated-token' }]
      });

      const user = await User.create({
        foursquare_id: 'fsq123',
        display_name: 'New User'
      });

      expect(user).toBeDefined();
      const sql = db.query.mock.calls[0][0];
      expect(sql).toContain('INSERT');
    });
  });

  describe('findActive', () => {
    test('returns users who logged in within 30 days', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, display_name: 'Active User' }
        ]
      });

      const users = await User.findActive();
      expect(users).toHaveLength(1);
      const sql = db.query.mock.calls[0][0];
      expect(sql).toContain('last_login_at');
    });
  });

  describe('updateLastSync', () => {
    test('updates the last_sync_at timestamp', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      await User.updateLastSync(1);
      expect(db.query).toHaveBeenCalledTimes(1);
      const sql = db.query.mock.calls[0][0];
      expect(sql).toContain('last_sync_at');
    });
  });

  describe('updateStravaAuth', () => {
    test('stores encrypted Strava tokens', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      await User.updateStravaAuth(1, {
        access_token: 'access',
        refresh_token: 'refresh',
        athlete_id: 12345
      });
      expect(db.query).toHaveBeenCalled();
    });
  });
});
```

**Step 2: Run the test**

```bash
cd /Users/gabormikes/swarm-visualizer/server && npx jest models/user.test.js --verbose
```

Expected: Tests pass. Adjust mock responses if the actual query format differs.

**Step 3: Commit**

```bash
git add server/models/user.test.js
git commit -m "test: add User model tests"
```

### Task 8: Test Checkin model

**Files:**
- Test: `server/models/checkin.test.js`

**Step 1: Write the tests**

```js
jest.mock('../db/connection', () => ({
  query: jest.fn()
}));

const db = require('../db/connection');
const Checkin = require('./checkin');

describe('Checkin Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('find', () => {
    test('filters by user_id', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      await Checkin.find({ userId: 1 });
      expect(db.query.mock.calls[0][1]).toContain(1);
    });

    test('filters by date range', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      await Checkin.find({
        userId: 1,
        startDate: '2024-01-01',
        endDate: '2024-12-31'
      });
      const sql = db.query.mock.calls[0][0];
      expect(sql).toContain('checkin_date');
    });

    test('filters by category', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      await Checkin.find({
        userId: 1,
        categories: ['Coffee Shop', 'Restaurant']
      });
      const sql = db.query.mock.calls[0][0];
      expect(sql).toContain('venue_category');
    });

    test('filters by geographic bounds', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      await Checkin.find({
        userId: 1,
        bounds: { sw: { lat: 40, lng: -74 }, ne: { lat: 41, lng: -73 } }
      });
      const sql = db.query.mock.calls[0][0];
      expect(sql).toContain('latitude');
      expect(sql).toContain('longitude');
    });

    test('applies smart sampling at low zoom levels', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      await Checkin.find({ userId: 1, zoom: 3 });
      const sql = db.query.mock.calls[0][0];
      expect(sql).toContain('LIMIT');
    });
  });

  describe('getStats', () => {
    test('returns aggregated statistics', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total_checkins: '100', unique_venues: '50' }] })
        .mockResolvedValueOnce({ rows: [{ country: 'US', count: '50' }] })
        .mockResolvedValueOnce({ rows: [{ venue_category: 'Coffee', count: '30' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const stats = await Checkin.getStats({ userId: 1 });
      expect(stats).toBeDefined();
    });
  });

  describe('bulkInsert', () => {
    test('inserts multiple checkins with ON CONFLICT DO NOTHING', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 3 });

      const checkins = [
        { user_id: 1, venue_id: 'v1', venue_name: 'A', latitude: 0, longitude: 0, checkin_date: new Date() },
        { user_id: 1, venue_id: 'v2', venue_name: 'B', latitude: 0, longitude: 0, checkin_date: new Date() },
        { user_id: 1, venue_id: 'v3', venue_name: 'C', latitude: 0, longitude: 0, checkin_date: new Date() }
      ];

      const result = await Checkin.bulkInsert(checkins);
      const sql = db.query.mock.calls[0][0];
      expect(sql).toContain('INSERT');
      expect(sql).toContain('ON CONFLICT');
    });
  });

  describe('getFilterOptions', () => {
    test('returns countries, cities, and categories', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ country: 'US' }, { country: 'UK' }] })
        .mockResolvedValueOnce({ rows: [{ city: 'NYC' }] })
        .mockResolvedValueOnce({ rows: [{ venue_category: 'Coffee' }] });

      const options = await Checkin.getFilterOptions(1);
      expect(options).toBeDefined();
    });
  });
});
```

**Step 2: Run the test**

```bash
cd /Users/gabormikes/swarm-visualizer/server && npx jest models/checkin.test.js --verbose
```

Expected: Tests pass. Adjust based on actual method signatures and query structure.

**Step 3: Commit**

```bash
git add server/models/checkin.test.js
git commit -m "test: add Checkin model tests"
```

### Task 9: Test stravaRateLimitService

**Files:**
- Test: `server/services/stravaRateLimitService.test.js`

**Step 1: Write the tests**

```js
jest.mock('../db/connection', () => ({
  query: jest.fn()
}));

const db = require('../db/connection');
const { StravaRateLimitService, RateLimitError } = require('./stravaRateLimitService');

describe('StravaRateLimitService', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StravaRateLimitService();
  });

  describe('checkQuota', () => {
    test('allows request when under 15-min and daily limits', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '10' }] })  // 15-min count
        .mockResolvedValueOnce({ rows: [{ count: '100' }] }); // daily count

      await expect(service.checkQuota(1)).resolves.not.toThrow();
    });

    test('throws RateLimitError when 15-min limit exceeded', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '95' }] }); // over 95 limit

      await expect(service.checkQuota(1)).rejects.toThrow(RateLimitError);
    });

    test('throws RateLimitError when daily limit exceeded', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '10' }] })    // 15-min OK
        .mockResolvedValueOnce({ rows: [{ count: '950' }] });   // daily over 950

      await expect(service.checkQuota(1)).rejects.toThrow(RateLimitError);
    });
  });

  describe('recordRequest', () => {
    test('inserts a request record', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      await service.recordRequest(1);
      expect(db.query).toHaveBeenCalledTimes(1);
      const sql = db.query.mock.calls[0][0];
      expect(sql).toContain('INSERT');
    });
  });

  describe('getResetTime', () => {
    test('returns a future timestamp', () => {
      const resetTime = service.getResetTime();
      expect(new Date(resetTime).getTime()).toBeGreaterThan(Date.now());
    });
  });
});
```

**Step 2: Run the test**

```bash
cd /Users/gabormikes/swarm-visualizer/server && npx jest services/stravaRateLimitService.test.js --verbose
```

**Step 3: Commit**

```bash
git add server/services/stravaRateLimitService.test.js
git commit -m "test: add stravaRateLimitService tests"
```

---

## Phase 4: Job Pipeline Tests

### Task 10: Test dailySyncOrchestrator

**Files:**
- Test: `server/jobs/dailySyncOrchestrator.test.js`

**Step 1: Write the tests**

```js
jest.mock('../models/user');
jest.mock('../models/importJob');
jest.mock('../jobs/queue', () => ({
  getQueue: jest.fn().mockReturnValue({
    send: jest.fn().mockResolvedValue('job-id')
  })
}));

const User = require('../models/user');
const ImportJob = require('../models/importJob');
const { getQueue } = require('./queue');
const dailySyncOrchestrator = require('./dailySyncOrchestrator');

describe('dailySyncOrchestrator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('queues sync jobs for each active user', async () => {
    User.findActive.mockResolvedValueOnce([
      { id: 1, display_name: 'User 1' },
      { id: 2, display_name: 'User 2' }
    ]);
    ImportJob.findRunning = jest.fn().mockResolvedValue([]);
    ImportJob.create = jest.fn().mockResolvedValue({ id: 1 });

    await dailySyncOrchestrator();

    expect(User.findActive).toHaveBeenCalled();
    expect(getQueue().send).toHaveBeenCalled();
  });

  test('skips users with already-running import jobs', async () => {
    User.findActive.mockResolvedValueOnce([
      { id: 1, display_name: 'User 1' }
    ]);
    ImportJob.findRunning = jest.fn().mockResolvedValue([{ id: 99, user_id: 1 }]);

    await dailySyncOrchestrator();

    // Should not queue additional jobs for user with running import
  });

  test('handles empty active user list', async () => {
    User.findActive.mockResolvedValueOnce([]);
    await dailySyncOrchestrator();
    expect(getQueue().send).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run the test**

```bash
cd /Users/gabormikes/swarm-visualizer/server && npx jest jobs/dailySyncOrchestrator.test.js --verbose
```

Expected: Tests pass. Adjust mocks based on actual method names (findRunning, findActive, etc.).

**Step 3: Commit**

```bash
git add server/jobs/dailySyncOrchestrator.test.js
git commit -m "test: add dailySyncOrchestrator tests"
```

### Task 11: Test importStravaData job

**Files:**
- Test: `server/jobs/importStravaData.test.js`

**Step 1: Write the tests**

```js
jest.mock('../models/user');
jest.mock('../models/importJob');
jest.mock('../services/stravaSync', () => ({
  incrementalSync: jest.fn(),
  fullHistoricalSync: jest.fn()
}));
jest.mock('../services/stravaRateLimitService', () => ({
  RateLimitError: class RateLimitError extends Error {
    constructor(msg, resetTime) { super(msg); this.resetTime = resetTime; }
  }
}));
jest.mock('./queue', () => ({
  getQueue: jest.fn().mockReturnValue({
    send: jest.fn().mockResolvedValue('job-id')
  })
}));

const User = require('../models/user');
const ImportJob = require('../models/importJob');
const stravaSync = require('../services/stravaSync');
const importStravaDataHandler = require('./importStravaData');

describe('importStravaData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ImportJob.updateStatus = jest.fn().mockResolvedValue({});
    ImportJob.updateProgress = jest.fn().mockResolvedValue({});
  });

  test('runs incremental sync by default', async () => {
    stravaSync.incrementalSync.mockResolvedValueOnce({ imported: 5 });

    await importStravaDataHandler({
      data: { jobId: 1, userId: 1, syncType: 'incremental' }
    });

    expect(stravaSync.incrementalSync).toHaveBeenCalled();
    expect(ImportJob.updateStatus).toHaveBeenCalledWith(1, 'completed', expect.anything());
  });

  test('runs full sync when requested', async () => {
    stravaSync.fullHistoricalSync.mockResolvedValueOnce({ imported: 100 });

    await importStravaDataHandler({
      data: { jobId: 1, userId: 1, syncType: 'full' }
    });

    expect(stravaSync.fullHistoricalSync).toHaveBeenCalled();
  });

  test('handles rate limit errors with retry scheduling', async () => {
    const { RateLimitError } = require('../services/stravaRateLimitService');
    stravaSync.incrementalSync.mockRejectedValueOnce(
      new RateLimitError('Rate limited', Date.now() + 900000)
    );

    await importStravaDataHandler({
      data: { jobId: 1, userId: 1, syncType: 'incremental' }
    });

    // Should mark as rate_limited, not failed
    expect(ImportJob.updateStatus).toHaveBeenCalledWith(1, expect.stringContaining('limit'), expect.anything());
  });
});
```

**Step 2: Run the test**

```bash
cd /Users/gabormikes/swarm-visualizer/server && npx jest jobs/importStravaData.test.js --verbose
```

**Step 3: Commit**

```bash
git add server/jobs/importStravaData.test.js
git commit -m "test: add importStravaData job tests"
```

### Task 12: Test importCheckins job

**Files:**
- Test: `server/jobs/importCheckins.test.js`

**Step 1: Write the tests**

```js
jest.mock('../models/user');
jest.mock('../models/importJob');
jest.mock('../models/checkin');
jest.mock('../models/checkinPhoto');
jest.mock('../db/connection', () => ({ query: jest.fn() }));
jest.mock('../services/encryption', () => ({
  decrypt: jest.fn().mockReturnValue('decrypted-token')
}));
jest.mock('../services/foursquare', () => ({
  fetchCheckins: jest.fn(),
  transformCheckin: jest.fn()
}));

const User = require('../models/user');
const ImportJob = require('../models/importJob');
const Checkin = require('../models/checkin');
const foursquare = require('../services/foursquare');
const importCheckinsHandler = require('./importCheckins');

describe('importCheckins', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ImportJob.updateStatus = jest.fn().mockResolvedValue({});
    ImportJob.updateProgress = jest.fn().mockResolvedValue({});
    User.findById.mockResolvedValue({ id: 1, foursquare_token: 'encrypted' });
  });

  test('fetches and inserts checkins in batches', async () => {
    foursquare.fetchCheckins.mockResolvedValueOnce({
      checkins: [{ id: 'c1' }, { id: 'c2' }],
      hasMore: false
    });
    foursquare.transformCheckin.mockReturnValue({
      user_id: 1, venue_id: 'v1', venue_name: 'Test', latitude: 0, longitude: 0,
      checkin_date: new Date(), photos: []
    });
    Checkin.bulkInsert = jest.fn().mockResolvedValue(2);

    await importCheckinsHandler({
      data: { jobId: 1, userId: 1 }
    });

    expect(foursquare.fetchCheckins).toHaveBeenCalled();
    expect(ImportJob.updateStatus).toHaveBeenCalledWith(1, 'completed', expect.anything());
  });

  test('marks job as failed on error', async () => {
    foursquare.fetchCheckins.mockRejectedValueOnce(new Error('API error'));

    await importCheckinsHandler({
      data: { jobId: 1, userId: 1 }
    });

    expect(ImportJob.updateStatus).toHaveBeenCalledWith(1, 'failed', expect.anything());
  });
});
```

**Step 2: Run the test**

```bash
cd /Users/gabormikes/swarm-visualizer/server && npx jest jobs/importCheckins.test.js --verbose
```

**Step 3: Commit**

```bash
git add server/jobs/importCheckins.test.js
git commit -m "test: add importCheckins job tests"
```

---

## Phase 5: Remaining Server Route Tests

### Task 13: Test routes — checkins, filters, import, stats, yearInReview, copilot

**Files:**
- Test: `server/routes/checkins.test.js`
- Test: `server/routes/filters.test.js`
- Test: `server/routes/import.test.js`
- Test: `server/routes/stats.test.js`
- Test: `server/routes/yearInReview.test.js`
- Test: `server/routes/copilot.test.js`

All route tests follow the same pattern as `auth.test.js`:

```js
// Standard route test boilerplate (use in every route test file):
const request = require('supertest');
jest.mock('../models/user');
jest.mock('../services/geminiSessionManager', () => ({ startCleanupInterval: jest.fn() }));
jest.mock('../jobs/queue', () => ({
  initQueue: jest.fn().mockResolvedValue(undefined),
  getQueue: jest.fn().mockReturnValue({ work: jest.fn(), send: jest.fn() }),
  stopQueue: jest.fn()
}));
const User = require('../models/user');
const app = require('../server');

const mockToken = 'test-token';
const mockUser = { id: 1, display_name: 'Test User' };

beforeEach(() => {
  jest.clearAllMocks();
  User.findBySecretToken.mockResolvedValue(mockUser);
});
```

**Step 1: Write checkins.test.js**

```js
// (boilerplate from above)
jest.mock('../models/checkin');
const Checkin = require('../models/checkin');

describe('Checkins Routes', () => {
  // (beforeEach from above)

  describe('GET /api/checkins', () => {
    test('returns checkins for authenticated user', async () => {
      Checkin.find.mockResolvedValueOnce([{ id: 1, venue_name: 'Test' }]);

      const response = await request(app)
        .get('/api/checkins')
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(200);
      expect(Checkin.find).toHaveBeenCalled();
    });

    test('requires authentication', async () => {
      User.findBySecretToken.mockResolvedValueOnce(null);
      const response = await request(app).get('/api/checkins');
      expect(response.status).toBe(401);
    });

    test('passes filter params to model', async () => {
      Checkin.find.mockResolvedValueOnce([]);

      await request(app)
        .get('/api/checkins?startDate=2024-01-01&endDate=2024-12-31')
        .set('x-auth-token', mockToken);

      const args = Checkin.find.mock.calls[0][0];
      expect(args).toHaveProperty('startDate', '2024-01-01');
    });
  });
});
```

**Step 2: Write filters.test.js**

```js
// (boilerplate)
jest.mock('../models/checkin');
const Checkin = require('../models/checkin');

describe('Filters Routes', () => {
  describe('GET /api/filters/options', () => {
    test('returns filter options for user', async () => {
      Checkin.getFilterOptions.mockResolvedValueOnce({
        countries: ['US'], cities: ['NYC'], categories: ['Coffee']
      });

      const response = await request(app)
        .get('/api/filters/options')
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('countries');
    });
  });
});
```

**Step 3: Write import.test.js**

```js
// (boilerplate)
jest.mock('../models/importJob');
const ImportJob = require('../models/importJob');
const { getQueue } = require('../jobs/queue');

describe('Import Routes', () => {
  describe('POST /api/import/start', () => {
    test('creates import job and queues it', async () => {
      ImportJob.create = jest.fn().mockResolvedValueOnce({ id: 1, status: 'queued' });
      ImportJob.findLatest = jest.fn().mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/import/start')
        .set('x-auth-token', mockToken)
        .send({ source: 'foursquare' });

      expect(response.status).toBe(200);
    });

    test('prevents duplicate running imports', async () => {
      ImportJob.findLatest = jest.fn().mockResolvedValueOnce({ id: 1, status: 'running' });

      const response = await request(app)
        .post('/api/import/start')
        .set('x-auth-token', mockToken)
        .send({ source: 'foursquare' });

      expect(response.status).toBe(409);
    });
  });

  describe('GET /api/import/status/:jobId', () => {
    test('returns job status', async () => {
      ImportJob.findById = jest.fn().mockResolvedValueOnce({
        id: 1, user_id: 1, status: 'completed'
      });

      const response = await request(app)
        .get('/api/import/status/1')
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(200);
    });

    test('returns 403 for other users job', async () => {
      ImportJob.findById = jest.fn().mockResolvedValueOnce({
        id: 1, user_id: 999, status: 'completed'
      });

      const response = await request(app)
        .get('/api/import/status/1')
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(403);
    });
  });
});
```

**Step 4: Write stats.test.js**

```js
// (boilerplate)
jest.mock('../models/checkin');
const Checkin = require('../models/checkin');

describe('Stats Routes', () => {
  describe('GET /api/stats', () => {
    test('returns stats for authenticated user', async () => {
      Checkin.getStats.mockResolvedValueOnce({
        total_checkins: 100, unique_venues: 50
      });

      const response = await request(app)
        .get('/api/stats')
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/stats/compare', () => {
    test('compares two time periods', async () => {
      Checkin.getStats.mockResolvedValue({
        total_checkins: 50, unique_venues: 25
      });

      const response = await request(app)
        .get('/api/stats/compare?period1Start=2024-01-01&period1End=2024-06-30&period2Start=2024-07-01&period2End=2024-12-31')
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(200);
    });
  });
});
```

**Step 5: Write yearInReview.test.js**

```js
// (boilerplate)
jest.mock('../models/checkin');
jest.mock('../db/connection', () => ({ query: jest.fn() }));
const Checkin = require('../models/checkin');
const db = require('../db/connection');

describe('Year In Review Routes', () => {
  describe('GET /api/year-in-review/years', () => {
    test('returns available years', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ year: 2024 }, { year: 2023 }]
      });

      const response = await request(app)
        .get('/api/year-in-review/years')
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/year-in-review/:year', () => {
    test('returns annual summary', async () => {
      Checkin.getStats.mockResolvedValueOnce({
        total_checkins: 100, unique_venues: 50
      });
      db.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .get('/api/year-in-review/2024')
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(200);
    });

    test('validates year parameter', async () => {
      const response = await request(app)
        .get('/api/year-in-review/notayear')
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(400);
    });
  });
});
```

**Step 6: Write copilot.test.js**

```js
// (boilerplate)
jest.mock('../services/geminiSessionManager', () => ({
  startCleanupInterval: jest.fn(),
  getOrCreateSession: jest.fn().mockResolvedValue({
    sendMessage: jest.fn().mockResolvedValue({
      response: {
        text: jest.fn().mockReturnValue('AI response'),
        functionCalls: jest.fn().mockReturnValue(null)
      }
    })
  }),
  deleteSession: jest.fn()
}));
jest.mock('../services/queryBuilder', () => ({
  executeQuery: jest.fn().mockResolvedValue({ results: [], total: 0 }),
  getCategories: jest.fn().mockResolvedValue(['Coffee', 'Restaurant'])
}));

const sessionManager = require('../services/geminiSessionManager');

describe('Copilot Routes', () => {
  describe('POST /api/copilot/chat', () => {
    test('returns AI response for valid message', async () => {
      const response = await request(app)
        .post('/api/copilot/chat')
        .set('x-auth-token', mockToken)
        .send({ message: 'How many checkins do I have?' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('response');
    });

    test('requires message in body', async () => {
      const response = await request(app)
        .post('/api/copilot/chat')
        .set('x-auth-token', mockToken)
        .send({});

      expect(response.status).toBe(400);
    });

    test('requires authentication', async () => {
      User.findBySecretToken.mockResolvedValueOnce(null);
      const response = await request(app)
        .post('/api/copilot/chat')
        .send({ message: 'test' });

      expect(response.status).toBe(401);
    });
  });
});
```

**Step 7: Run all route tests**

```bash
cd /Users/gabormikes/swarm-visualizer/server && npx jest routes/ --verbose
```

Expected: All route tests pass. Fix any mock mismatches.

**Step 8: Commit**

```bash
git add server/routes/checkins.test.js server/routes/filters.test.js server/routes/import.test.js server/routes/stats.test.js server/routes/yearInReview.test.js server/routes/copilot.test.js
git commit -m "test: add tests for all remaining server routes"
```

---

## Phase 6: Client Tests

### Task 14: Create client test setup

**Files:**
- Create: `client/src/setupTests.js`

**Step 1: Create setupTests.js**

CRA automatically loads `src/setupTests.js`.

```js
import '@testing-library/jest-dom';
```

**Step 2: Run tests to verify setup**

```bash
cd /Users/gabormikes/swarm-visualizer/client && npx react-scripts test --watchAll=false
```

Expected: Existing 5 tests still pass.

**Step 3: Commit**

```bash
git add client/src/setupTests.js
git commit -m "test: add client test setup with @testing-library/jest-dom"
```

### Task 15: Test client utilities

**Files:**
- Test: `client/src/utils/timezoneUtils.test.js`
- Test: `client/src/utils/copilotStorage.test.js`

**Step 1: Write timezoneUtils tests**

```js
import { formatInLocalTimeZone, formatTimeInLocalZone, formatDateInLocalZone } from './timezoneUtils';

describe('timezoneUtils', () => {
  describe('formatInLocalTimeZone', () => {
    test('formats date in specified timezone', () => {
      const date = '2024-06-15T12:00:00Z';
      const result = formatInLocalTimeZone(date, 'America/New_York', 'time');
      // Should format as Eastern time (UTC-4 in June)
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    test('handles null timezone gracefully', () => {
      const date = '2024-06-15T12:00:00Z';
      const result = formatInLocalTimeZone(date, null, 'time');
      expect(result).toBeDefined();
    });

    test('handles different format types', () => {
      const date = '2024-06-15T12:00:00Z';
      const time = formatTimeInLocalZone(date, 'Europe/London');
      const dateStr = formatDateInLocalZone(date, 'Europe/London');
      expect(time).toBeDefined();
      expect(dateStr).toBeDefined();
    });
  });
});
```

**Step 2: Write copilotStorage tests**

```js
import { saveMessages, loadMessages, clearMessages, saveCopilotState, loadCopilotState } from './copilotStorage';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn(key => store[key] || null),
    setItem: jest.fn((key, value) => { store[key] = value; }),
    removeItem: jest.fn(key => { delete store[key]; }),
    clear: jest.fn(() => { store = {}; })
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('copilotStorage', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  describe('saveMessages / loadMessages', () => {
    test('round-trips messages through localStorage', () => {
      const messages = [{ role: 'user', content: 'Hello' }];
      saveMessages(messages);
      const loaded = loadMessages();
      expect(loaded).toEqual(messages);
    });

    test('returns empty array when no messages saved', () => {
      expect(loadMessages()).toEqual([]);
    });

    test('limits stored messages to MAX_MESSAGES (50)', () => {
      const messages = Array.from({ length: 60 }, (_, i) => ({
        role: 'user', content: `Message ${i}`
      }));
      saveMessages(messages);
      const loaded = loadMessages();
      expect(loaded.length).toBeLessThanOrEqual(50);
    });
  });

  describe('clearMessages', () => {
    test('removes messages from localStorage', () => {
      saveMessages([{ role: 'user', content: 'test' }]);
      clearMessages();
      expect(loadMessages()).toEqual([]);
    });
  });

  describe('saveCopilotState / loadCopilotState', () => {
    test('round-trips copilot state', () => {
      const state = { isOpen: true, position: { x: 100, y: 200 } };
      saveCopilotState(state);
      expect(loadCopilotState()).toEqual(state);
    });

    test('returns null when no state saved', () => {
      expect(loadCopilotState()).toBeNull();
    });
  });
});
```

**Step 3: Run the tests**

```bash
cd /Users/gabormikes/swarm-visualizer/client && npx react-scripts test --watchAll=false
```

Expected: 5 + new tests pass.

**Step 4: Commit**

```bash
git add client/src/utils/timezoneUtils.test.js client/src/utils/copilotStorage.test.js
git commit -m "test: add client utility tests (timezone, copilot storage)"
```

### Task 16: Test api.js service

**Files:**
- Test: `client/src/services/api.test.js`

**Step 1: Write the tests**

```js
import axios from 'axios';
import api, { getCheckins, getStats, validateToken, sendCopilotMessage, getFilterOptions } from './api';

jest.mock('axios', () => {
  const instance = {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() }
    },
    defaults: { baseURL: '', headers: { common: {} } }
  };
  const axiosMock = { create: jest.fn(() => instance), ...instance };
  return { __esModule: true, default: axiosMock };
});

describe('API Service', () => {
  let mockAxiosInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAxiosInstance = axios.create();
  });

  describe('getCheckins', () => {
    test('calls GET /checkins with params', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ data: [] });
      await getCheckins({ startDate: '2024-01-01' });
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/checkins', expect.objectContaining({
        params: expect.objectContaining({ startDate: '2024-01-01' })
      }));
    });
  });

  describe('getStats', () => {
    test('calls GET /stats with filter params', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ data: { total: 100 } });
      await getStats({ categories: ['Coffee'] });
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/stats', expect.anything());
    });
  });

  describe('validateToken', () => {
    test('calls GET /auth/me', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ data: { id: 1 } });
      await validateToken();
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/auth/me');
    });
  });

  describe('sendCopilotMessage', () => {
    test('calls POST /copilot/chat with message', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({ data: { response: 'hi' } });
      await sendCopilotMessage('hello', []);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/copilot/chat', expect.objectContaining({
        message: 'hello'
      }));
    });
  });

  describe('getFilterOptions', () => {
    test('calls GET /filters/options', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ data: { countries: [] } });
      await getFilterOptions();
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/filters/options');
    });
  });
});
```

**Step 2: Run the tests**

```bash
cd /Users/gabormikes/swarm-visualizer/client && npx react-scripts test --watchAll=false
```

**Step 3: Commit**

```bash
git add client/src/services/api.test.js
git commit -m "test: add API service tests"
```

### Task 17: Extract and test pure functions from complex components

**Files:**
- Create: `client/src/utils/mapUtils.js` (extract from MapView.jsx)
- Create: `client/src/utils/mapUtils.test.js`
- Create: `client/src/utils/statsUtils.js` (extract from StatsPanel.jsx)
- Create: `client/src/utils/statsUtils.test.js`
- Create: `client/src/utils/geoUtils.js` (extract from HomePage.jsx)
- Create: `client/src/utils/geoUtils.test.js`
- Modify: `client/src/components/MapView.jsx` — import from mapUtils
- Modify: `client/src/components/StatsPanel.jsx` — import from statsUtils
- Modify: `client/src/pages/HomePage.jsx` — import from geoUtils

**Step 1: Extract mapUtils.js from MapView.jsx**

Extract these pure functions:

```js
// client/src/utils/mapUtils.js

/**
 * Group checkins by venue, aggregating checkin data per venue.
 */
export function groupCheckinsByVenue(checkins) {
  // Copy the venue grouping logic from MapView.jsx (lines ~27-49)
  // Input: array of checkin objects
  // Output: array of { venue_id, venue_name, latitude, longitude, checkins: [...] }
}

/**
 * Convert venue groups to GeoJSON FeatureCollection for Mapbox.
 */
export function toGeoJSON(venueGroups) {
  // Copy from MapView.jsx (lines ~52-69)
}

/**
 * Map a venue category to a marker color.
 */
export function getMarkerColor(category) {
  // Copy from MapView.jsx (line ~98-100)
}

/**
 * Group checkins by ISO week for contribution grid.
 */
export function groupCheckinsByWeek(checkins) {
  // Copy the week calculation logic from MapView.jsx (lines ~546-560)
}

/**
 * Generate weeks grid organized by year/month for contribution display.
 */
export function generateWeeksGrid(checkinsByWeek, earliestDate, latestDate) {
  // Copy from MapView.jsx (lines ~563-616)
}
```

**Step 2: Write mapUtils tests**

```js
import { groupCheckinsByVenue, toGeoJSON, getMarkerColor, groupCheckinsByWeek } from './mapUtils';

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
  });

  describe('toGeoJSON', () => {
    test('creates valid GeoJSON FeatureCollection', () => {
      const groups = [
        { venue_id: 'v1', venue_name: 'Cafe', latitude: 40, longitude: -74, checkins: [{}] }
      ];
      const geojson = toGeoJSON(groups);
      expect(geojson.type).toBe('FeatureCollection');
      expect(geojson.features).toHaveLength(1);
      expect(geojson.features[0].geometry.type).toBe('Point');
      expect(geojson.features[0].geometry.coordinates).toEqual([-74, 40]);
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
  });
});
```

**Step 3: Extract statsUtils.js and geoUtils.js**

Follow the same pattern:

```js
// client/src/utils/statsUtils.js
export function prepareComparisonBarData(period1, period2, keyField) { /* from StatsPanel.jsx */ }
export function prepareComparisonTimelineData(timeline1, timeline2) { /* from StatsPanel.jsx */ }
export function formatDateRange(data) { /* from StatsPanel.jsx */ }
```

```js
// client/src/utils/geoUtils.js
export function boundsContained(inner, outer) { /* from HomePage.jsx */ }
export function addBuffer(bounds, percent) { /* from HomePage.jsx */ }
export function calculateBounds(venues) { /* from HomePage.jsx */ }
```

**Step 4: Write tests for statsUtils and geoUtils**

```js
// statsUtils.test.js
import { prepareComparisonBarData, formatDateRange } from './statsUtils';

describe('statsUtils', () => {
  describe('prepareComparisonBarData', () => {
    test('merges two period arrays by key field', () => {
      const p1 = [{ name: 'Coffee', count: 10 }];
      const p2 = [{ name: 'Coffee', count: 15 }, { name: 'Bar', count: 5 }];
      const result = prepareComparisonBarData(p1, p2, 'name');
      expect(result).toHaveLength(2);
    });
  });
});
```

```js
// geoUtils.test.js
import { boundsContained, addBuffer, calculateBounds } from './geoUtils';

describe('geoUtils', () => {
  describe('boundsContained', () => {
    test('returns true when inner is fully inside outer', () => {
      const inner = { sw: { lat: 41, lng: -73 }, ne: { lat: 42, lng: -72 } };
      const outer = { sw: { lat: 40, lng: -74 }, ne: { lat: 43, lng: -71 } };
      expect(boundsContained(inner, outer)).toBe(true);
    });

    test('returns false when inner extends outside outer', () => {
      const inner = { sw: { lat: 39, lng: -74 }, ne: { lat: 42, lng: -72 } };
      const outer = { sw: { lat: 40, lng: -74 }, ne: { lat: 43, lng: -71 } };
      expect(boundsContained(inner, outer)).toBe(false);
    });
  });

  describe('addBuffer', () => {
    test('expands bounds by percentage', () => {
      const bounds = { sw: { lat: 40, lng: -74 }, ne: { lat: 41, lng: -73 } };
      const buffered = addBuffer(bounds, 20);
      expect(buffered.sw.lat).toBeLessThan(40);
      expect(buffered.ne.lat).toBeGreaterThan(41);
    });

    test('clamps latitude to -90/90', () => {
      const bounds = { sw: { lat: -89, lng: 0 }, ne: { lat: 89, lng: 1 } };
      const buffered = addBuffer(bounds, 50);
      expect(buffered.sw.lat).toBeGreaterThanOrEqual(-90);
      expect(buffered.ne.lat).toBeLessThanOrEqual(90);
    });
  });

  describe('calculateBounds', () => {
    test('calculates bounding box from venues', () => {
      const venues = [
        { latitude: 40, longitude: -74 },
        { latitude: 41, longitude: -73 },
        { latitude: 39, longitude: -75 }
      ];
      const bounds = calculateBounds(venues);
      expect(bounds).toBeDefined();
    });

    test('handles single venue', () => {
      const venues = [{ latitude: 40, longitude: -74 }];
      const bounds = calculateBounds(venues);
      expect(bounds).toBeDefined();
    });
  });
});
```

**Step 5: Update components to import from new utils**

In MapView.jsx, StatsPanel.jsx, and HomePage.jsx, replace inline logic with imports from the new utils files.

**Step 6: Run all client tests**

```bash
cd /Users/gabormikes/swarm-visualizer/client && npx react-scripts test --watchAll=false
```

**Step 7: Build to verify nothing broke**

```bash
cd /Users/gabormikes/swarm-visualizer/client && npx react-scripts build
```

**Step 8: Commit**

```bash
git add client/src/utils/mapUtils.js client/src/utils/mapUtils.test.js \
       client/src/utils/statsUtils.js client/src/utils/statsUtils.test.js \
       client/src/utils/geoUtils.js client/src/utils/geoUtils.test.js \
       client/src/components/MapView.jsx client/src/components/StatsPanel.jsx \
       client/src/pages/HomePage.jsx
git commit -m "refactor: extract pure functions from components with tests

Extract testable logic from MapView, StatsPanel, HomePage into:
- mapUtils (venue grouping, GeoJSON, contribution grid)
- statsUtils (comparison data prep, date formatting)
- geoUtils (bounds containment, buffering, calculation)"
```

---

## Phase 7: Medium-Value Hardening

### Task 18: Expand existing route tests with edge cases

**Files:**
- Modify: `server/routes/venues.test.js` — add malformed input tests
- Modify: `server/routes/dayInLife.test.js` — add boundary value tests
- Modify: `server/routes/strava.test.js` — add error path tests
- Modify all new route test files from Task 13

For each route test file, add:

**Step 1: Add validation edge case tests**

Add to each route test file:

```js
// Malformed inputs
test('handles missing required params', async () => { /* ... */ });
test('handles invalid date formats', async () => { /* ... */ });
test('handles non-numeric IDs', async () => { /* ... */ });

// Error paths
test('returns 500 on internal error', async () => {
  SomeModel.find.mockRejectedValueOnce(new Error('DB error'));
  const response = await request(app).get('/api/endpoint').set('x-auth-token', mockToken);
  expect(response.status).toBe(500);
});
```

**Step 2: Run all tests**

```bash
cd /Users/gabormikes/swarm-visualizer/server && npm test
```

**Step 3: Commit**

```bash
git add server/routes/*.test.js
git commit -m "test: add edge case and error path coverage to route tests"
```

### Task 19: Client component logic tests

**Files:**
- Test: `client/src/components/SyncButton.test.js`
- Test: `client/src/components/SyncProgressBar.test.js`

These components have state machine logic (polling, progress tracking) worth testing.

**Step 1: Write SyncButton test**

Test the component's state transitions (idle → syncing → complete/error) and polling logic using @testing-library/react and mock API responses.

**Step 2: Write SyncProgressBar test**

Test progress calculation and polling interval behavior.

**Step 3: Run tests and commit**

```bash
cd /Users/gabormikes/swarm-visualizer/client && npx react-scripts test --watchAll=false
git add client/src/components/SyncButton.test.js client/src/components/SyncProgressBar.test.js
git commit -m "test: add SyncButton and SyncProgressBar component tests"
```

---

## Phase 8: CI Pipeline

### Task 20: Create GitHub Actions CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `.github/workflows/deploy.yml` — add test requirement

Inspired by the 531-tracker project's CI strategy:
- Path-based filtering (only run tests for changed code)
- Server tests on PRs when server/ changes
- Client tests on PRs when client/ changes
- Skip docs-only changes
- Unit tests on PRs only (not redundant on merge)

**Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: CI

# CI Policy:
# - Skips docs-only changes
# - Use [skip ci] in commit message to skip entirely
# - Tests run on PRs only (already passed before merge)
#
# Rationale: With feature branch workflow, unit tests run on PR.
# Re-running on merge is redundant.

on:
  pull_request:
    branches: [main]
    paths-ignore:
      - '**.md'
      - 'docs/**'
      - '.gitignore'
      - 'LICENSE'

permissions:
  contents: read
  pull-requests: read

jobs:
  # Detect which parts of the codebase changed
  changes:
    runs-on: ubuntu-latest
    outputs:
      client: ${{ steps.filter.outputs.client }}
      server: ${{ steps.filter.outputs.server }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            client:
              - 'client/**'
            server:
              - 'server/**'

  server-tests:
    needs: changes
    if: needs.changes.outputs.server == 'true'
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: server/package-lock.json

      - name: Install dependencies
        working-directory: server
        run: npm ci

      - name: Run tests
        working-directory: server
        env:
          NODE_ENV: test
          GEMINI_API_KEY: test-api-key
        run: npx jest --verbose --forceExit

  client-tests:
    needs: changes
    if: needs.changes.outputs.client == 'true'
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: client/package-lock.json

      - name: Install dependencies
        working-directory: client
        run: npm ci

      - name: Run tests
        working-directory: client
        env:
          CI: true
        run: npx react-scripts test --watchAll=false

      - name: Build check
        working-directory: client
        run: npx react-scripts build
```

**Step 2: Update deploy.yml to only deploy on main push**

The existing deploy.yml already only triggers on `push` to `main`, which is correct. No changes needed — PRs run tests via ci.yml, and merges to main trigger deploy.

Optionally, add path-based deploy filtering:

```yaml
name: Deploy to Render
on:
  push:
    branches: [main]
    paths:
      - 'server/**'
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Render Deploy
        run: curl -X POST "${{ secrets.RENDER_DEPLOY_HOOK }}"
```

This prevents unnecessary Render deploys when only client code changes (client deploys via Vercel automatically).

**Step 3: Run tests locally to verify CI commands work**

```bash
cd /Users/gabormikes/swarm-visualizer/server && NODE_ENV=test GEMINI_API_KEY=test-api-key npx jest --verbose --forceExit
cd /Users/gabormikes/swarm-visualizer/client && CI=true npx react-scripts test --watchAll=false
cd /Users/gabormikes/swarm-visualizer/client && npx react-scripts build
```

Expected: All pass.

**Step 4: Commit**

```bash
git add .github/workflows/ci.yml .github/workflows/deploy.yml
git commit -m "ci: add GitHub Actions CI with path-based test filtering

- Server tests run on PRs when server/ changes
- Client tests + build run on PRs when client/ changes
- Skips docs-only changes
- Deploy only triggers on server changes (client via Vercel)"
```

---

## Phase 9: Final Verification

### Task 21: Run full test suite and verify coverage

**Step 1: Run all server tests**

```bash
cd /Users/gabormikes/swarm-visualizer/server && npx jest --verbose --coverage
```

**Step 2: Run all client tests**

```bash
cd /Users/gabormikes/swarm-visualizer/client && npx react-scripts test --watchAll=false --coverage
```

**Step 3: Verify client build**

```bash
cd /Users/gabormikes/swarm-visualizer/client && npx react-scripts build
```

**Step 4: Review coverage report**

Check the coverage output. Expected targets:
- Server: ~70-80% of files covered, all routes and services tested
- Client: ~40-50% of files covered (pure logic tested, presentational components excluded by design)

**Step 5: Commit coverage config if needed**

If jest coverage thresholds are desired, add to `server/jest.config.js`:

```js
coverageThreshold: {
  global: {
    branches: 50,
    functions: 60,
    lines: 60,
    statements: 60
  }
}
```

---

## Summary

| Phase | Tasks | What |
|-------|-------|------|
| 1 | 1-2 | Remove Garmin OAuth (server + client) |
| 2 | 3-5 | Security tests (encryption, auth, queryBuilder) |
| 3 | 6-9 | Core server logic (sessionManager, User, Checkin, rateLimiting) |
| 4 | 10-12 | Job pipeline (orchestrator, importStrava, importCheckins) |
| 5 | 13 | All remaining route tests |
| 6 | 14-17 | Client tests (setup, utils, api, extracted pure functions) |
| 7 | 18-19 | Medium-value hardening (edge cases, component logic) |
| 8 | 20 | CI pipeline with path-based filtering |
| 9 | 21 | Final verification and coverage report |

**Expected final state:**
- ~0 pre-existing test failures (garmin tests deleted with OAuth removal)
- Server: ~25+ test files, ~400+ tests
- Client: ~10+ test files, ~60+ tests
- CI: GitHub Actions running tests on every PR
- All pure business logic extracted and tested
- Dead Garmin OAuth code removed
