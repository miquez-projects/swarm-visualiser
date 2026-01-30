# Dependabot PR Merge Plan

**Date**: 2026-01-30
**Goal**: Merge all 8 open Dependabot PRs safely, in order, with verification at each step.

## Project Context

- **Repo path**: `/Users/gabormikes/swarm-visualizer`
- **GitHub repo**: Use `gh` CLI (already authenticated) for all PR operations.
- **Structure**: Monorepo with three `package.json` files:
  - Root (`/package.json`) — shared/dev deps, scripts like `npm run dev` (starts both client + server via concurrently)
  - `/client/package.json` — React frontend (CRA-based)
  - `/server/package.json` — Node.js/Express backend
- **Test commands**:
  - Client tests: `cd /Users/gabormikes/swarm-visualizer/client && npx react-scripts test --watchAll=false`
  - Server tests: `cd /Users/gabormikes/swarm-visualizer/server && npm test`
- **Build check** (client): `cd /Users/gabormikes/swarm-visualizer/client && npx react-scripts build`
- **Server startup check**: Start the server with `cd /Users/gabormikes/swarm-visualizer/server && timeout 10 node server.js || true` — success means it prints a "listening" message and doesn't crash within 10 seconds. The server requires env vars to fully run, so a crash with a DB connection error is acceptable; a crash due to a missing module or syntax error is NOT acceptable.
- **All verification is automated** — do NOT attempt to open a browser, visually inspect UI, or test OAuth flows.

---

## Pre-flight

1. Confirm clean state:
   ```bash
   cd /Users/gabormikes/swarm-visualizer
   git checkout main
   git pull origin main
   git status
   ```
   Abort if there are uncommitted changes.

2. Confirm current state installs and tests pass:
   ```bash
   cd /Users/gabormikes/swarm-visualizer/client && npm install
   cd /Users/gabormikes/swarm-visualizer/server && npm install
   cd /Users/gabormikes/swarm-visualizer/client && npx react-scripts test --watchAll=false
   cd /Users/gabormikes/swarm-visualizer/server && npm test
   ```
   If tests fail before any merges, stop and report the failures — do not proceed.

3. Determine whether PR #22 (pg-boss at root) is needed:
   ```bash
   grep "pg-boss" /Users/gabormikes/swarm-visualizer/package.json
   ```
   - If pg-boss is NOT in root `package.json`: close PR #22 with:
     ```bash
     gh pr close 22 --comment "Root package.json does not depend on pg-boss; dependency lives in /server only."
     ```
     Skip step 8 below.
   - If pg-boss IS in root `package.json`: check if it's actually imported anywhere at root level:
     ```bash
     grep -r "pg-boss" /Users/gabormikes/swarm-visualizer/*.js /Users/gabormikes/swarm-visualizer/src/ /Users/gabormikes/swarm-visualizer/lib/ 2>/dev/null
     ```
     - If no results: remove pg-boss from root `package.json`, commit, push, and close PR #22 with a comment explaining the dep was unused.
     - If results found: keep PR #22 for step 8.

---

## Batch 1 — Safe, independent PRs (no overlap with others)

For each step: merge, pull, install, run tests.

### Step 1: Merge PR #18 — @testing-library/react 16.3.1 → 16.3.2

```bash
gh pr merge 18 --merge
git pull origin main
cd /Users/gabormikes/swarm-visualizer/client && npm install
npx react-scripts test --watchAll=false
```
**Pass criteria**: Client tests pass. This is a test-only dependency — if tests break, this bump is the cause.

### Step 2: Merge PR #20 — react-router-dom 7.12.0 → 7.13.0

```bash
gh pr merge 20 --merge
git pull origin main
cd /Users/gabormikes/swarm-visualizer/client && npm install
npx react-scripts test --watchAll=false
npx react-scripts build
```
**Pass criteria**: Client tests pass AND client builds successfully (build catches import/type errors that tests might miss for a routing library).

### Step 3: Merge PR #23 — @mui/x-date-pickers 8.25.0 → 8.26.0

```bash
gh pr merge 23 --merge
git pull origin main
cd /Users/gabormikes/swarm-visualizer/client && npm install
npx react-scripts test --watchAll=false
npx react-scripts build
```
**Pass criteria**: Client tests pass AND client builds successfully. Note: this touches a component that had recent UX fixes (DatePicker behavior). Build verification is the best automated check available — manual browser testing of the DatePicker is recommended separately but is outside the scope of this automated plan.

---

## Batch 2 — Server dependencies

### Step 4: Merge PR #24 — server group (axios, cors, pg, pg-boss)

```bash
gh pr merge 24 --merge
git pull origin main
cd /Users/gabormikes/swarm-visualizer/server && npm install
npm test
```
Then check the server can at least load without module errors:
```bash
cd /Users/gabormikes/swarm-visualizer/server && timeout 10 node server.js 2>&1 || true
```
**Pass criteria**: Server tests pass. Server startup does not crash with a module/syntax error (DB connection errors are expected and acceptable without env vars).

### Step 5: Check and merge PR #19 — express-session 1.18.2 → 1.19.0

First check if it's still mergeable after step 4:
```bash
gh pr view 19 --json state,mergeable
```
- If `state` is `OPEN` and `mergeable` is `MERGEABLE`:
  ```bash
  gh pr merge 19 --merge
  git pull origin main
  cd /Users/gabormikes/swarm-visualizer/server && npm install && npm test
  ```
  **Pass criteria**: Server tests pass.
- If it has conflicts: post `@dependabot rebase` as a comment on PR #19 and skip for now. Report this as a follow-up item.
- If it was auto-closed: skip, note in report.

---

## Batch 3 — Client and root dependencies

### Step 6: Merge PR #25 — client group (axios, mapbox-gl, recharts)

```bash
gh pr merge 25 --merge
git pull origin main
cd /Users/gabormikes/swarm-visualizer/client && npm install
npx react-scripts test --watchAll=false
npx react-scripts build
```
**Pass criteria**: Client tests pass AND client builds successfully.

### Step 7: Check and merge PR #21 — root group (axios, express-session)

```bash
gh pr view 21 --json state,mergeable
```
- If `OPEN` and `MERGEABLE`:
  ```bash
  gh pr merge 21 --merge
  git pull origin main
  cd /Users/gabormikes/swarm-visualizer && npm install
  cd /Users/gabormikes/swarm-visualizer/client && npx react-scripts test --watchAll=false
  cd /Users/gabormikes/swarm-visualizer/server && npm test
  ```
  **Pass criteria**: Both client and server tests pass.
- If conflicted or closed: skip, note in report.

### Step 8: Merge PR #22 — pg-boss 11.1.1 → 12.6.0 (root) — CONDITIONAL

Only execute if pre-flight determined this PR is needed (root `package.json` has pg-boss and it's actually used).

```bash
gh pr merge 22 --merge
git pull origin main
cd /Users/gabormikes/swarm-visualizer && npm install
cd /Users/gabormikes/swarm-visualizer/server && npm test
```
**Pass criteria**: Server tests pass (pg-boss is a job queue library — server tests are the relevant check).

---

## Post-merge verification

Run the full test suite one final time to confirm everything works together:

```bash
cd /Users/gabormikes/swarm-visualizer/client && npx react-scripts test --watchAll=false
cd /Users/gabormikes/swarm-visualizer/server && npm test
cd /Users/gabormikes/swarm-visualizer/client && npx react-scripts build
```

Check for remaining open Dependabot PRs:
```bash
gh pr list --state open --json number,title,author --jq '[.[] | select(.author.login == "app/dependabot")]'
```

---

## Rollback

If any merge causes test or build failures:

1. Identify the merge commit: `git log --oneline -5`
2. Revert it: `git revert -m 1 <merge-commit-sha>`
3. Push: `git push origin main`
4. Do NOT proceed with subsequent steps — stop and report the failure, including:
   - Which PR caused the failure
   - Full test/build error output
   - The revert commit SHA

---

## Final Report

After completing (or partially completing) the plan, produce a summary:

| PR | Action Taken | Result |
|----|-------------|--------|
| #18 | merged / skipped / reverted | tests pass / fail / N/A |
| #19 | merged / skipped / rebased | ... |
| #20 | merged / skipped / reverted | ... |
| #21 | merged / skipped / closed | ... |
| #22 | merged / skipped / closed | ... |
| #23 | merged / skipped / reverted | ... |
| #24 | merged / skipped / reverted | ... |
| #25 | merged / skipped / reverted | ... |

Include any follow-up items (e.g., PRs that need rebase, manual testing needed for DatePicker).

---

## Summary Table

| Order | PR  | Packages | Batch |
|-------|-----|----------|-------|
| 1     | #18 | @testing-library/react patch | 1 |
| 2     | #20 | react-router-dom minor | 1 |
| 3     | #23 | @mui/x-date-pickers minor | 1 |
| 4     | #24 | server group (axios, cors, pg, pg-boss) | 2 |
| 5     | #19 | express-session minor | 2 |
| 6     | #25 | client group (axios, mapbox-gl, recharts) | 3 |
| 7     | #21 | root group (axios, express-session) | 3 |
| 8     | #22 | pg-boss major (root) — conditional | 3 |
