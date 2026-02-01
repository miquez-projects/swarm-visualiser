# CRA to Vite + Vitest Migration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Create React App (react-scripts) with Vite + Vitest to eliminate deprecated dependencies, speed up dev/build, and get a maintained toolchain.

**Architecture:** Swap react-scripts for Vite as bundler and Vitest as test runner. The client is a standard React SPA with Material-UI, Mapbox GL, and react-router-dom. No SVG imports, CSS modules, proxy config, or import aliases — making this a clean migration. Env vars change from `REACT_APP_` prefix to `VITE_` prefix. Tests use `jest.mock`/`jest.fn` which Vitest supports with `globals: true`.

**Tech Stack:** Vite 7 (latest 7.3.x), @vitejs/plugin-react 5 (latest 5.1.x), Vitest 4 (latest 4.0.x), jsdom, React 19, Material-UI 7

---

## Pre-Migration State

- **Bundler:** react-scripts 5.0.1 (Webpack, unmaintained)
- **Test runner:** Jest via react-scripts
- **Env prefix:** `REACT_APP_`
- **Build output:** `client/build/`
- **Entry:** `client/public/index.html` (CRA manages this)
- **Tests:** 9 suites, 84 tests, all passing
- **Deploy:** Vercel (auto-detects CRA)

## Post-Migration State

- **Bundler:** Vite 6 with @vitejs/plugin-react
- **Test runner:** Vitest with jsdom
- **Env prefix:** `VITE_`
- **Build output:** `client/dist/`
- **Entry:** `client/index.html` (Vite manages this at root)
- **Tests:** 9 suites, 84 tests, all passing (via Vitest)
- **Deploy:** Vercel (auto-detects Vite)

---

## Task 1: Install Vite and remove react-scripts

**Files:**
- Modify: `client/package.json`

**Step 1: Install Vite dependencies**

```bash
cd /Users/gabormikes/swarm-visualizer/client
npm install --save-dev vite@^7 @vitejs/plugin-react@^5 vitest@^4 jsdom
```

**Step 2: Remove react-scripts**

```bash
cd /Users/gabormikes/swarm-visualizer/client
npm uninstall react-scripts
```

**Step 3: Update scripts in package.json**

Replace the `scripts` section:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

Remove the `browserslist` section (Vite uses its own defaults — all modern browsers).

Remove the `eslintConfig` section (will be handled by Vite or a standalone ESLint config if needed later).

**Step 4: Verify package.json looks correct**

```bash
cat /Users/gabormikes/swarm-visualizer/client/package.json
```

Ensure `react-scripts` is gone from dependencies and devDependencies. Ensure `vite`, `@vitejs/plugin-react`, `vitest`, `jsdom` are in devDependencies.

**Step 5: Commit**

```bash
cd /Users/gabormikes/swarm-visualizer
git add client/package.json client/package-lock.json
git commit -m "build: replace react-scripts with vite, vitest, jsdom"
```

---

## Task 2: Create Vite config

**Files:**
- Create: `client/vite.config.js`

**Step 1: Create the Vite config file**

```js
// client/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
```

Notes:
- `port: 3000` matches CRA's default so existing dev workflow is unchanged
- `open: true` matches CRA's behavior of opening browser on start
- `outDir: 'dist'` is Vite's default (CRA used `build/`)
- `sourcemap: true` for debugging production issues

**Step 2: Commit**

```bash
cd /Users/gabormikes/swarm-visualizer
git add client/vite.config.js
git commit -m "build: add vite.config.js with React plugin and SPA routing"
```

---

## Task 3: Move and update index.html

**Files:**
- Move: `client/public/index.html` → `client/index.html`
- Modify: `client/index.html`

Vite requires `index.html` at the project root (not in `public/`). It also needs an explicit `<script>` tag to the entry point.

**Step 1: Move index.html to client root**

```bash
cp /Users/gabormikes/swarm-visualizer/client/public/index.html /Users/gabormikes/swarm-visualizer/client/index.html
```

**Step 2: Edit client/index.html**

Replace `%PUBLIC_URL%` references with `/` and add the entry script tag before `</body>`:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
    <meta name="description" content="Life Visualizer - Swarm check-in data visualization" />
    <link rel="apple-touch-icon" href="/logo192.png" />
    <link rel="manifest" href="/manifest.json" />
    <title>Life Visualizer</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
    <script type="module" src="/src/index.js"></script>
  </body>
</html>
```

Key changes:
- `%PUBLIC_URL%/favicon.ico` → `/favicon.ico` (3 replacements)
- Added `<script type="module" src="/src/index.js"></script>` before `</body>`
- Updated description from "Web site created using create-react-app"

**Step 3: Delete the old public/index.html**

```bash
rm /Users/gabormikes/swarm-visualizer/client/public/index.html
```

**Step 4: Commit**

```bash
cd /Users/gabormikes/swarm-visualizer
git add client/index.html client/public/index.html
git commit -m "build: move index.html to client root for Vite, remove PUBLIC_URL"
```

---

## Task 4: Rename environment variables from REACT_APP_ to VITE_

**Files:**
- Modify: `client/.env`
- Modify: `client/.env.example`
- Modify: `client/src/services/api.js`
- Modify: `client/src/components/MapView.jsx`
- Modify: `client/src/pages/DataSourcesPage.jsx`
- Modify: `client/src/pages/ImportPage.jsx`

**Step 1: Update .env**

```
VITE_API_URL=http://localhost:3001
VITE_MAPBOX_TOKEN=pk.eyJ1IjoibWlxdWV6OTg5IiwiYSI6ImNtaGRsczQzajAzN3cybHM2a2RreG8wNTkifQ.fPQzVcpA-FWzCgJQx0e6VA
```

**Step 2: Update .env.example**

```
VITE_API_URL=http://localhost:3001
VITE_MAPBOX_TOKEN=your_mapbox_token_here
```

**Step 3: Update source files**

In each file, replace `process.env.REACT_APP_` with `import.meta.env.VITE_`:

**`client/src/services/api.js`:**
- `process.env.REACT_APP_API_URL` → `import.meta.env.VITE_API_URL`
- `process.env.NODE_ENV` → `import.meta.env.MODE` (Vite exposes `MODE` instead of `NODE_ENV`)

**`client/src/components/MapView.jsx`:**
- `process.env.REACT_APP_MAPBOX_TOKEN` → `import.meta.env.VITE_MAPBOX_TOKEN`

**`client/src/pages/DataSourcesPage.jsx`:**
- `process.env.REACT_APP_API_URL` → `import.meta.env.VITE_API_URL`

**`client/src/pages/ImportPage.jsx`:**
- `process.env.REACT_APP_API_URL` → `import.meta.env.VITE_API_URL`

**Step 4: Verify no remaining REACT_APP_ references in source**

```bash
grep -r "REACT_APP_\|process\.env\." /Users/gabormikes/swarm-visualizer/client/src/ --include="*.js" --include="*.jsx"
```

Expected: no matches (only `import.meta.env` references).

**Step 5: Commit**

```bash
cd /Users/gabormikes/swarm-visualizer
git add client/.env client/.env.example client/src/services/api.js client/src/components/MapView.jsx client/src/pages/DataSourcesPage.jsx client/src/pages/ImportPage.jsx
git commit -m "build: rename env vars from REACT_APP_ to VITE_ prefix"
```

---

## Task 5: Configure Vitest

**Files:**
- Modify: `client/vite.config.js` — add Vitest config
- Modify: `client/src/setupTests.js` — add Vitest globals

**Step 1: Add Vitest config to vite.config.js**

```js
// client/vite.config.js
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
    css: true
  }
});
```

Key settings:
- `globals: true` — makes `describe`, `it`, `expect`, `jest` (→`vi`) available globally, so existing tests work without imports
- `environment: 'jsdom'` — simulates browser DOM for component tests
- `setupFiles` — points to existing setupTests.js
- `css: true` — handles CSS imports in tests

**Step 2: Update setupTests.js**

```js
// client/src/setupTests.js
import '@testing-library/jest-dom';
```

This stays the same — `@testing-library/jest-dom` works with both Jest and Vitest.

**Step 3: Commit**

```bash
cd /Users/gabormikes/swarm-visualizer
git add client/vite.config.js client/src/setupTests.js
git commit -m "build: configure Vitest with jsdom environment and global APIs"
```

---

## Task 6: Migrate test files from Jest to Vitest

**Files:**
- Modify: `client/src/services/api.test.js`
- Modify: `client/src/components/SyncButton.test.js`
- Modify: `client/src/components/SyncProgressBar.test.js`
- (Other test files use no Jest-specific APIs beyond `describe`/`it`/`expect` — no changes needed)

The following test files use **only** `describe`/`it`/`expect` and need NO changes (Vitest `globals: true` provides these):
- `client/src/utils/timezoneUtils.test.js`
- `client/src/utils/copilotStorage.test.js`
- `client/src/utils/mapUtils.test.js`
- `client/src/utils/statsUtils.test.js`
- `client/src/utils/geoUtils.test.js`
- `client/src/components/copilot/venueParser.test.js`

**Step 1: Migrate api.test.js**

Vitest with `globals: true` exposes `vi` as the equivalent of `jest`. Replace all `jest.fn()` with `vi.fn()` and `jest.mock()` with `vi.mock()`:

In `client/src/services/api.test.js`:
- `jest.fn()` → `vi.fn()` (all occurrences)
- `jest.mock('axios', ...)` → `vi.mock('axios', ...)`
- `mockGet.mockReset()` → `mockGet.mockReset()` (unchanged — `.mockReset()` works on both)
- `mockGet.mockResolvedValue()` → `mockGet.mockResolvedValue()` (unchanged)
- `mockGet.mockRejectedValue()` → `mockGet.mockRejectedValue()` (unchanged)

**Step 2: Migrate SyncButton.test.js**

In `client/src/components/SyncButton.test.js`:
- `jest.mock(...)` → `vi.mock(...)` (2 occurrences)
- `jest.fn()` → `vi.fn()` (all occurrences inside mock factories)
- `jest.clearAllMocks()` → `vi.clearAllMocks()`
- `jest.useFakeTimers()` → `vi.useFakeTimers()`
- `jest.useRealTimers()` → `vi.useRealTimers()`
- `jest.advanceTimersByTime(...)` → `vi.advanceTimersByTime(...)`

**Step 3: Migrate SyncProgressBar.test.js**

In `client/src/components/SyncProgressBar.test.js`:
- `jest.mock(...)` → `vi.mock(...)`
- `jest.fn()` → `vi.fn()` (all occurrences)
- `jest.clearAllMocks()` → `vi.clearAllMocks()`
- `jest.useFakeTimers()` → `vi.useFakeTimers()`
- `jest.useRealTimers()` → `vi.useRealTimers()`
- `jest.advanceTimersByTime(...)` → `vi.advanceTimersByTime(...)`

**Step 4: Run tests**

```bash
cd /Users/gabormikes/swarm-visualizer/client && npx vitest run --reporter=verbose
```

Expected: 9 suites, 84 tests, all passing.

**Step 5: Commit**

```bash
cd /Users/gabormikes/swarm-visualizer
git add client/src/services/api.test.js client/src/components/SyncButton.test.js client/src/components/SyncProgressBar.test.js
git commit -m "test: migrate Jest API calls to Vitest (vi.fn, vi.mock, vi.useFakeTimers)"
```

---

## Task 7: Clean up CRA artifacts and update .gitignore

**Files:**
- Delete: `client/src/reportWebVitals.js`
- Modify: `client/src/index.js` — remove reportWebVitals import
- Modify: `client/.gitignore` — change `/build` to `/dist`
- Delete: `client/public/manifest.json` (optional — PWA manifest from CRA boilerplate)
- Delete: `client/public/logo192.png` (CRA boilerplate)
- Delete: `client/public/logo512.png` (CRA boilerplate)
- Delete: `client/public/robots.txt` (CRA boilerplate — Vite serves static files from `public/` automatically)

**Step 1: Remove reportWebVitals**

Delete `client/src/reportWebVitals.js`.

Update `client/src/index.js` to remove the import and call:

```js
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**Step 2: Update .gitignore**

In `client/.gitignore`, replace `/build` with `/dist`.

Also add to the end:
```
# Vite
.vite/
```

**Step 3: Decide on CRA boilerplate files**

Keep `robots.txt` and `favicon.ico` — they're useful. Delete CRA-specific logos and manifest if you're not using PWA features:

```bash
rm /Users/gabormikes/swarm-visualizer/client/public/manifest.json
rm /Users/gabormikes/swarm-visualizer/client/public/logo192.png
rm /Users/gabormikes/swarm-visualizer/client/public/logo512.png
```

Also remove the manifest `<link>` and apple-touch-icon `<link>` from `client/index.html` if deleting these files:

```html
<!-- REMOVE these two lines from client/index.html -->
<link rel="apple-touch-icon" href="/logo192.png" />
<link rel="manifest" href="/manifest.json" />
```

**Step 4: Remove the `web-vitals` dependency**

```bash
cd /Users/gabormikes/swarm-visualizer/client && npm uninstall web-vitals
```

**Step 5: Commit**

```bash
cd /Users/gabormikes/swarm-visualizer
git add -A client/
git commit -m "build: clean up CRA boilerplate (reportWebVitals, logos, manifest)"
```

---

## Task 8: Verify build and dev server

**Step 1: Run the dev server**

```bash
cd /Users/gabormikes/swarm-visualizer/client && npx vite
```

Expected: Server starts on http://localhost:3000, near-instant startup. Verify the app loads in the browser — check:
- Map renders (Mapbox token works via `import.meta.env.VITE_MAPBOX_TOKEN`)
- Navigation works (react-router-dom routes)
- No console errors

Stop the dev server (Ctrl+C).

**Step 2: Run production build**

```bash
cd /Users/gabormikes/swarm-visualizer/client && npx vite build
```

Expected: Build completes in a few seconds, output in `client/dist/`.

**Step 3: Preview production build**

```bash
cd /Users/gabormikes/swarm-visualizer/client && npx vite preview
```

Expected: Serves the production build. Verify the app loads correctly.

**Step 4: Run all tests**

```bash
cd /Users/gabormikes/swarm-visualizer/client && npx vitest run --reporter=verbose
```

Expected: 9 suites, 84 tests, all passing.

**Step 5: Commit (only if any fixes were needed)**

```bash
cd /Users/gabormikes/swarm-visualizer
git add -A client/
git commit -m "fix: resolve any issues found during Vite migration verification"
```

---

## Task 9: Update CI workflow and CLAUDE.md

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `CLAUDE.md`

**Step 1: Update CI workflow**

In `.github/workflows/ci.yml`, update the `client-tests` job:

```yaml
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
        run: npx vitest run --reporter=verbose

      - name: Build check
        working-directory: client
        run: npx vite build
```

Changes:
- `npx react-scripts test --watchAll=false` → `npx vitest run --reporter=verbose`
- `npx react-scripts build` → `npx vite build`
- Removed `CI: true` env var (no longer needed — Vitest doesn't use it, and Vite doesn't treat warnings as errors by default)

**Step 2: Update CLAUDE.md**

In the CI / Testing Strategy section, update:
- `**Client tests**: \`cd client && npx react-scripts test --watchAll=false\`` → `**Client tests**: \`cd client && npx vitest run\``
- `**Test pattern**: Jest + supertest (server), Jest + @testing-library/react (client)` → `**Test pattern**: Jest + supertest (server), Vitest + @testing-library/react (client)`

In the Useful Commands section, update:
- `npm run dev:client           # Client only` — already correct (root package.json calls `cd client && npm start`, update to `cd client && npm run dev`)

In the Development Workflow section, no changes needed.

Also update the root `package.json` script:
- `"dev:client": "cd client && npm start"` → `"dev:client": "cd client && npm run dev"`

**Step 3: Update root package.json**

In `/Users/gabormikes/swarm-visualizer/package.json`:
- Change `"dev:client": "cd client && npm start"` to `"dev:client": "cd client && npm run dev"`

**Step 4: Commit**

```bash
cd /Users/gabormikes/swarm-visualizer
git add .github/workflows/ci.yml CLAUDE.md package.json
git commit -m "ci: update CI and docs for Vite + Vitest migration"
```

---

## Task 10: Update Vercel environment variables

**This is a manual step — not automatable.**

In the Vercel dashboard for the `swarm-visualiser` project:

1. Go to Settings → Environment Variables
2. Rename (or add new):
   - `REACT_APP_API_URL` → `VITE_API_URL` (same value)
   - `REACT_APP_MAPBOX_TOKEN` → `VITE_MAPBOX_TOKEN` (same value)
3. Vercel will auto-detect Vite and use `vite build` instead of `react-scripts build`
4. The output directory changes from `build` to `dist` — Vite's `vite.config.js` tells Vercel this automatically
5. Trigger a redeploy to verify

**Step 1: Push all changes**

```bash
cd /Users/gabormikes/swarm-visualizer && git push origin main
```

**Step 2: Update Vercel env vars (manual)**

Go to https://vercel.com and update the environment variables as described above.

**Step 3: Verify deployment**

After Vercel redeploys, verify:
- App loads at https://swarm-visualiser.vercel.app
- Map renders (Mapbox token works)
- API calls work (API URL correct)
- All routes work (SPA fallback configured)

---

## Rollback Plan

If anything goes wrong after pushing:

```bash
git revert HEAD~N..HEAD  # Revert the migration commits
git push origin main
```

Then restore the original `REACT_APP_` env vars in Vercel.

---

## Summary of Changes

| What | Before | After |
|------|--------|-------|
| Bundler | react-scripts 5.0.1 (Webpack) | Vite 7 |
| Test runner | Jest via react-scripts | Vitest |
| Env prefix | `REACT_APP_` | `VITE_` |
| Env access | `process.env.REACT_APP_*` | `import.meta.env.VITE_*` |
| Build output | `client/build/` | `client/dist/` |
| HTML location | `client/public/index.html` | `client/index.html` |
| Dev command | `react-scripts start` | `vite` |
| Build command | `react-scripts build` | `vite build` |
| Test command | `react-scripts test` | `vitest run` |
| CI test command | `npx react-scripts test --watchAll=false` | `npx vitest run --reporter=verbose` |
| CI build command | `npx react-scripts build` | `npx vite build` |
| npm deps | ~1500 packages | ~300 packages |
| Dev server startup | ~5 seconds | ~200ms |
