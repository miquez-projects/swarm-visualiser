# Claude Code Development Notes

This file contains important reminders and workflows for Claude Code when working on this project.

## Project Context

### Architecture
- **Frontend**: React + Material-UI + Mapbox GL JS (deployed on Vercel)
- **Backend**: Node.js + Express + PostgreSQL + PostGIS (Docker on Hetzner VPS)
- **AI Copilot**: Google Gemini 2.5 Flash with function calling

### Deployment
- **VPS**: Hetzner CAX21 (Helsinki) — shared with Resonance and 531-tracker
- **Backend URL**: https://swarm-api.gabormikes.com
- **Frontend URL**: https://swarm-visualiser.vercel.app
- **Docker Compose**: `/opt/services/` on the VPS (managed from the Resonance repo under `services/`)
- **Reverse Proxy**: Caddy (in Resonance's stack) handles TLS and routes `swarm-api.gabormikes.com` → swarm-api container on port 3001
- **CD**: GitHub Actions pushes code via rsync + rebuilds Docker container on the VPS

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

## Production Access

### SSH into the VPS
```bash
ssh resonance    # connects to resonance@95.217.189.44 (Helsinki)
```

### View production logs
```bash
ssh resonance "cd /opt/services && docker compose logs swarm-api --tail=100"
ssh resonance "cd /opt/services && docker compose logs swarm-api -f"  # follow
```

### Access production database
```bash
# Via SSH tunnel (port 5433 for services DB)
ssh -L 5433:localhost:5433 resonance
# Then in another terminal:
psql -h localhost -p 5433 -U services -d services
# Tables are in the 'public' schema
```

Or directly on the VPS:
```bash
ssh resonance "cd /opt/services && docker compose exec -T services-db psql -U services -d services"
```

### Restart the service
```bash
ssh resonance "cd /opt/services && docker compose restart swarm-api"
```

### Shared database warning
The database is shared with 531-tracker via schema isolation:
- **swarm-visualizer**: `public` schema
- **531-tracker**: `tracker` schema

## Development Workflow

1. Make changes locally
2. Test with local development server: `npm run dev`
3. Push to GitHub (triggers automatic Hetzner deployment for `server/**` changes)
4. Monitor via `ssh resonance "cd /opt/services && docker compose logs swarm-api -f"`

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
- **Client tests**: `cd client && npx vitest run`
- **Test files**: Co-located `*.test.js` files next to source
- **Test pattern**: Jest + supertest (server), Vitest + @testing-library/react (client)
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

1. **Check logs**: `ssh resonance "cd /opt/services && docker compose logs swarm-api --tail=100"`
2. **Search for errors**: `ssh resonance "cd /opt/services && docker compose logs swarm-api 2>&1 | grep -i error"`
3. **Check container status**: `ssh resonance "cd /opt/services && docker compose ps"`
4. **Check database**: `ssh resonance "cd /opt/services && docker compose exec -T services-db psql -U services -d services -c 'SELECT count(*) FROM checkins;'"`
5. **Check frontend console**: Browser DevTools
