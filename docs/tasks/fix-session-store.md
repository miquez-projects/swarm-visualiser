# Task: Fix Production Session Store

**Priority**: Medium
**Status**: Not Started
**Created**: 2025-01-15

## Problem

Currently using `connect.session()` MemoryStore in production, which causes:
- Sessions lost on server restart (users must re-authenticate)
- Memory leaks over time as sessions accumulate
- Won't scale past a single process
- Not suitable for production deployment

**Warning Message**:
```
Warning: connect.session() MemoryStore is not
designed for a production environment, as it will leak
memory, and will not scale past a single process.
```

## Solution

Replace in-memory session store with PostgreSQL-backed persistent storage.

### Implementation Steps

1. **Install Dependencies**
   ```bash
   npm install connect-pg-simple
   ```

2. **Create Session Table**
   ```sql
   CREATE TABLE "session" (
     "sid" varchar NOT NULL COLLATE "default",
     "sess" json NOT NULL,
     "expire" timestamp(6) NOT NULL
   )
   WITH (OIDS=FALSE);

   ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;

   CREATE INDEX "IDX_session_expire" ON "session" ("expire");
   ```

3. **Update server/server.js**

   Replace:
   ```javascript
   app.use(session({
     secret: process.env.SESSION_SECRET,
     resave: false,
     saveUninitialized: false,
     cookie: { secure: process.env.NODE_ENV === 'production' }
   }));
   ```

   With:
   ```javascript
   const pgSession = require('connect-pg-simple')(session);

   app.use(session({
     store: new pgSession({
       conString: process.env.DATABASE_URL,
       tableName: 'session'
     }),
     secret: process.env.SESSION_SECRET,
     resave: false,
     saveUninitialized: false,
     cookie: {
       secure: process.env.NODE_ENV === 'production',
       maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
     }
   }));
   ```

4. **Create Migration**
   ```bash
   # Create migration file
   # server/db/migrations/014_add_session_table.sql
   ```

5. **Test**
   - Deploy to staging
   - Verify sessions persist across server restarts
   - Check for memory leaks
   - Verify OAuth flows still work (Garmin, Foursquare, Strava)

## Benefits

- Sessions persist across deployments (users stay logged in)
- No memory leaks from accumulating sessions
- Can scale horizontally with multiple server instances
- Production-ready session management

## Files to Modify

- `server/package.json` - Add connect-pg-simple dependency
- `server/server.js` - Update session configuration
- `server/db/migrations/014_add_session_table.sql` - Create session table

## Related

- OAuth implementations: Garmin, Foursquare, Strava
- User authentication flow
- Session management in routes/auth.js

## Notes

This is a non-breaking change that improves production stability. Current in-memory sessions work but are not ideal for production use.
