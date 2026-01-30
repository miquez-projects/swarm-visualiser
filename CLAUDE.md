# Claude Code Development Notes

This file contains important reminders and workflows for Claude Code when working on this project.

## 🔴 ALWAYS START WITH THIS

**Before starting any development work:**

```bash
# Start Render log streaming
npm run logs:start
```

This automatically streams logs from the production Render deployment to `logs/render-stream.log` so we can monitor the deployed service without manual copy-paste from the dashboard.

**To view logs:**
```bash
# Watch in real-time
npm run logs:view

# Search logs
grep "error" logs/render-stream.log
grep "copilot" logs/render-stream.log
```

**To stop when done:**
```bash
npm run logs:stop
```

See [docs/RENDER_LOGS.md](docs/RENDER_LOGS.md) for full documentation.

---

## Project Context

### Architecture
- **Frontend**: React + Material-UI + Mapbox GL JS (deployed on Vercel)
- **Backend**: Node.js + Express + PostgreSQL + PostGIS (deployed on Render)
- **AI Copilot**: Google Gemini 2.5 Flash with function calling

### Key Services
- **Render Service**: `srv-d41sc0ali9vc73bbtekg` (swarm-visualizer-api)
- **Database**: PostgreSQL on Render (PostGIS-enabled)
  - **Production DB URL**: `postgresql://swarm_visualizer_user:1nlk2RVUmnpg2G2HO4QmaMhncX3ysg40@dpg-d41s9rer433s73cv4t00-a.frankfurt-postgres.render.com/swarm_visualizer`
- **Frontend URL**: https://swarm-visualiser.vercel.app

### Important Files
- `/server/routes/copilot.js` - AI Copilot endpoint with function calling
- `/server/services/geminiSessionManager.js` - Manages Gemini chat sessions
- `/client/src/components/copilot/` - Copilot UI components
- `/server/utils/copilotTools.js` - Function definitions for Gemini

### Recent Work
- **Strava Rate Limiting**: Implemented resumable sync with rate limit handling (migrations 014/015)
  - Pauses sync when rate-limited, resumes after cooldown
  - Cursor-based pagination for resumable sync
  - See docs/plans/2025-01-11-strava-rate-limit-implementation-plan.md
- **Mobile UX Improvements** (commit 02bb962):
  - Fixed DatePicker to not close when selecting year/month
  - Moved navigation to context menu on mobile
  - Stacked date picker under heading on Day in Life page
  - Changed filter sidebar icon to FilterList on mobile
  - Hidden Garmin OAuth option (application rejected)
- **Gemini AI Copilot**: Thought signature preservation and conversation history
- **Garmin Integration**: Daily calorie tracking for Day in Life page

### Known Issues
- None currently

---

## Development Workflow

1. **Start log streaming** (see above)
2. Make changes locally
3. Test with local development server: `npm run dev`
4. Push to GitHub (triggers automatic Render deployment)
5. Monitor deployment via log stream
6. Test on production

---

## Useful Commands

```bash
# Development
npm run dev                  # Start both client and server
npm run dev:server           # Server only
npm run dev:client           # Client only

# Database
node server/db/run-migration.js migrations/XXX.sql

# Testing
npm test

# Logs
npm run logs:start           # Start log stream
npm run logs:view            # Watch logs
npm run logs:stop            # Stop log stream

# Git
git status
git diff
git log --oneline -10
```

---

## CI / Testing Strategy

- **CI runs on pushes to main and on PRs** via GitHub Actions
- **Path-based filtering**: server tests only run when `server/**` changes, client tests only when `client/**` changes
- **Docs-only changes** (`.md`, `docs/`) skip CI entirely
- **Server tests**: `cd server && npx jest --verbose --forceExit`
- **Client tests**: `cd client && npx react-scripts test --watchAll=false`
- **Test files**: Co-located `*.test.js` files next to source
- **Test pattern**: Jest + supertest (server), Jest + @testing-library/react (client)
- **Mocking**: Server tests mock DB via `jest.mock('../db/connection')`, client tests mock axios

### Commit Conventions for CI Efficiency

Use [conventional commits](https://www.conventionalcommits.org/) to make CI behavior predictable:

- `feat:`, `fix:`, `refactor:` — triggers CI for affected paths (server/client)
- `test:` — triggers CI (test files live alongside source)
- `docs:` — **skips CI** (paths-ignore covers `**.md` and `docs/**`)
- `ci:` — only triggers if workflow files change (not in `server/` or `client/`)
- `chore:` — triggers CI only if touching server/client files
- Add `[skip ci]` to commit message to skip CI entirely (e.g., typo fixes, config-only changes)
- Keep server and client changes in **separate commits/PRs** when possible to avoid running both test suites unnecessarily

---

## Environment Variables

**Server (.env)**:
- `DATABASE_URL` - PostgreSQL connection string
- `FOURSQUARE_CLIENT_ID` - Foursquare OAuth
- `FOURSQUARE_CLIENT_SECRET` - Foursquare OAuth
- `FOURSQUARE_CALLBACK_URL` - OAuth redirect
- `SESSION_SECRET` - Express session secret
- `GEMINI_API_KEY` - Google Gemini API key

**Client**:
- `REACT_APP_MAPBOX_TOKEN` - Mapbox API token
- `REACT_APP_API_URL` - Backend API URL

---

## Debugging Production Issues

1. **Check logs**: `tail -f logs/render-stream.log`
2. **Search for errors**: `grep -i error logs/render-stream.log`
3. **Check Gemini API calls**: `grep "Gemini" logs/render-stream.log`
4. **Check database**: Review PostgreSQL connection errors
5. **Check frontend console**: Browser DevTools

---

## Notes for Future Sessions

- Always start log streaming at the beginning of each session
- Logs persist in `logs/render-stream.log` until manually cleared
- The log streaming process runs in background and survives terminal restarts
- Check if already running before starting: `cat logs/render-stream.pid`

<!-- Deploy test: 2026-01-17T20:52:13Z -->

<!-- Deploy test 2: 2026-01-17T21:04:13Z -->

<!-- Deploy test 3: 2026-01-17T21:08:52Z -->

<!-- Deploy test 4: 2026-01-17T21:15:36Z -->

<!-- Deploy test 5: 2026-01-17T21:18:35Z -->
