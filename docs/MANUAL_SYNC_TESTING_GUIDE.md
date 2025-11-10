# Manual Sync Button - Testing Guide

## Overview
This guide provides comprehensive manual testing procedures for the Manual Check-in Sync Button feature. Since this is a UI feature with heavy API integration, all testing must be performed manually in a browser with a running server and valid authentication token.

---

## Pre-Test Requirements

### 1. Environment Setup
- [ ] Server is running (`npm start` in server directory)
- [ ] Client is running (`npm start` in client directory)
- [ ] Valid Swarm OAuth token available
- [ ] Database connection is working
- [ ] Swarm API credentials configured

### 2. Get Valid Token
Navigate to your authentication URL to get a valid magic link token:
```
http://localhost:3000/auth/swarm
```
Or use an existing valid token from your magic link email.

---

## Test Suite

### Test 1: Idle State (Button Visibility & Initial Rendering)

**Setup:**
1. Start the client application
2. Navigate to: `http://localhost:3000?token=<YOUR_VALID_TOKEN>`

**Expected Results:**
- [ ] "Sync Check-ins" button appears in header
- [ ] Button is positioned between navigation buttons and dark mode toggle
- [ ] Button displays sync icon (circular arrows)
- [ ] Button is clickable
- [ ] Button has proper styling and spacing

**Without Token:**
3. Navigate to: `http://localhost:3000` (no token parameter)

**Expected Results:**
- [ ] Sync button does NOT appear
- [ ] Other header elements (dark mode toggle, navigation) still visible
- [ ] No console errors

---

### Test 2: Starting a Sync

**Setup:**
1. Navigate to: `http://localhost:3000?token=<YOUR_VALID_TOKEN>`
2. Ensure no sync is currently running

**Actions:**
1. Click "Sync Check-ins" button

**Expected Results:**
- [ ] Toast notification appears: "Starting check-in sync..."
- [ ] Button changes to "Syncing..." with spinner icon
- [ ] Button remains clickable (for showing progress)
- [ ] Network tab shows POST request to `/api/import/start`
- [ ] Response includes jobId

**Console Checks:**
- [ ] No error messages in browser console
- [ ] API request logged (in development mode)

---

### Test 3: Real-time Progress Updates

**Setup:**
1. Start a sync (see Test 2)
2. Wait and observe for 15-30 seconds

**Expected Results:**
- [ ] Button text updates approximately every 3 seconds
- [ ] Text changes from "Syncing..." to "Syncing X%" (where X increases)
- [ ] Percentage value is accurate based on progress
- [ ] Spinner icon continues to display
- [ ] Network tab shows GET requests to `/api/import/status/:jobId` every 3 seconds

**Progress Display:**
- [ ] 0% shown when totalExpected is 0
- [ ] Percentage calculated correctly: (totalImported / totalExpected) * 100
- [ ] No decimal places in percentage (rounded)

---

### Test 4: Click During Active Sync

**Setup:**
1. Start a sync and wait until progress shows (e.g., "Syncing 25%")

**Actions:**
1. Click the sync button while sync is running

**Expected Results:**
- [ ] Detailed progress toast appears
- [ ] Toast shows format: "Syncing check-ins...\nProgress: X / Y (Z%)"
- [ ] X = current totalImported
- [ ] Y = totalExpected
- [ ] Z = percentage
- [ ] Toast can be dismissed by clicking X
- [ ] No new sync is started (verify in network tab - no new POST to /start)
- [ ] Button remains in syncing state

**Edge Case (Early Sync):**
If clicked before totalExpected is known:
- [ ] Toast shows: "Syncing check-ins...\nProgress: Initializing..."

---

### Test 5: Sync Completion

**Setup:**
1. Start a sync and wait for completion

**Expected Results:**
- [ ] Button changes to "Sync Complete ✓" (with checkmark)
- [ ] No icon shown (spinner removed)
- [ ] Success toast appears: "Sync complete! Imported X check-ins"
- [ ] X = actual number imported
- [ ] Toast is green (success severity)
- [ ] Map view refreshes with new check-ins
- [ ] After 2 seconds, button returns to "Sync Check-ins" idle state
- [ ] jobId is cleared after 2 seconds

**Map Refresh Verification:**
- [ ] Check network tab for GET request to `/api/checkins`
- [ ] Verify new check-ins appear on map (if any were imported)

---

### Test 6: Resume on Page Refresh

**Setup:**
1. Start a sync
2. Wait for progress to show (e.g., "Syncing 30%")
3. Refresh the page (F5 or Cmd+R)

**Expected Results:**
- [ ] Page reloads
- [ ] After mount, sync button automatically shows current progress
- [ ] Button displays "Syncing X%" where X is current progress
- [ ] Network tab shows GET request to `/api/import/latest` on mount
- [ ] Polling continues (requests to `/api/import/status/:jobId` every 3 seconds)
- [ ] Sync completes normally
- [ ] No duplicate syncs started

---

### Test 7: Duplicate Sync Prevention

**Setup:**
1. Start a sync
2. Wait for progress to show

**Actions:**
1. Click the sync button again while first sync is running

**Expected Results:**
- [ ] No new sync starts
- [ ] Toast shows current progress
- [ ] Network tab shows no POST to `/api/import/start`
- [ ] Button continues showing progress of existing sync
- [ ] Existing sync completes normally

**API Level Test:**
Using browser DevTools Console:
```javascript
// While sync is running, try to start another
fetch('/api/import/start?token=<YOUR_TOKEN>', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}).then(r => r.json()).then(console.log)
```

**Expected API Response:**
- [ ] Status: 409 Conflict
- [ ] Response body includes: `{ error: 'Import already in progress', jobId: '...' }`
- [ ] Component handles 409 by resuming existing sync

---

### Test 8: Sync Failure Handling

**Setup:**
This test requires simulating a failure. Options:
- Option A: Stop the server mid-sync
- Option B: Temporarily break database connection
- Option C: Use invalid Swarm credentials

**Actions:**
1. Start a sync
2. Trigger failure condition

**Expected Results:**
- [ ] Button returns to idle state
- [ ] Error toast appears (red, error severity)
- [ ] Toast shows: "Sync failed: [error message]"
- [ ] Toast auto-dismisses after 8 seconds (longer than success)
- [ ] jobId is cleared
- [ ] User can start a new sync after dismissing error

---

### Test 9: Authentication Failure

**Setup:**
1. Start with a valid token
2. Either wait for token to expire OR modify token in URL to be invalid

**Actions:**
1. Try to start a sync with invalid/expired token

**Expected Results:**
- [ ] Error toast appears: "Authentication failed. Please refresh your link."
- [ ] No sync starts
- [ ] Network tab shows 401 or 403 response
- [ ] Button remains in idle state

**During Active Sync:**
1. Start a sync with valid token
2. Modify token in URL to be invalid
3. Wait for next polling request

**Expected Results:**
- [ ] Sync stops when polling receives 401/403
- [ ] Error toast: "Authentication failed. Please refresh your link."
- [ ] Button returns to idle state
- [ ] jobId is cleared

---

### Test 10: Network Error Handling

**Setup:**
1. Start a sync
2. Temporarily disconnect from network (turn off WiFi or use DevTools offline mode)

**Expected Results:**
- [ ] Polling continues trying (doesn't stop on temporary network errors)
- [ ] When network restored, polling resumes successfully
- [ ] Sync completes normally
- [ ] No duplicate syncs created

---

### Test 11: Mobile Responsive Testing

**Setup:**
1. Open DevTools
2. Enable device toolbar (Cmd+Shift+M or Ctrl+Shift+M)
3. Test various device sizes

**Expected Results:**
**Mobile (< 768px):**
- [ ] Sync button visible in collapsed app bar
- [ ] Button text may truncate on very small screens but remains readable
- [ ] Toast notifications appear at bottom center
- [ ] Toasts are mobile-friendly (not too wide)

**Tablet (768px - 1024px):**
- [ ] Button fully visible with icon and text
- [ ] Proper spacing maintained

**Desktop (> 1024px):**
- [ ] Full button with icon and text
- [ ] Optimal spacing

---

### Test 12: Multi-line Toast Formatting

**Setup:**
1. Start a sync
2. Click button during sync to show progress toast

**Expected Results:**
- [ ] Toast displays on multiple lines (due to \n in message)
- [ ] Format is clean and readable:
  ```
  Syncing check-ins...
  Progress: 50 / 200 (25%)
  ```
- [ ] No raw \n characters visible
- [ ] Proper line spacing

---

### Test 13: Accessibility Testing

**Setup:**
Use keyboard and screen reader

**Keyboard Navigation:**
- [ ] Tab key reaches sync button
- [ ] Button has visible focus indicator
- [ ] Enter/Space triggers sync
- [ ] Can tab to toast close button
- [ ] Escape key dismisses toast

**Screen Reader:**
- [ ] Button text is announced correctly
- [ ] State changes announced ("Syncing 25%")
- [ ] Toast messages announced
- [ ] Icon has proper aria-label or is marked decorative

---

### Test 14: Performance Testing

**Setup:**
Monitor performance during sync

**Metrics to Check:**
- [ ] No memory leaks (check DevTools Memory tab)
- [ ] Polling interval accurate (3000ms ± 100ms)
- [ ] No excessive re-renders (use React DevTools Profiler)
- [ ] CPU usage remains low during polling
- [ ] Network requests efficient (no duplicate calls)

**Memory Leak Check:**
1. Start a sync
2. Take memory snapshot
3. Let sync complete
4. Wait 5 seconds
5. Take another memory snapshot
6. Compare - memory should return to baseline

---

### Test 15: Long-running Sync

**Setup:**
Test with large dataset (if available)

**Expected Results:**
- [ ] Polling continues for duration of sync (no timeout)
- [ ] Progress updates remain accurate
- [ ] No performance degradation over time
- [ ] Completion handling works correctly even after long duration
- [ ] No polling continues after completion

---

## Completion Checklist Verification

Based on plan lines 565-578, verify each item:

- [x] API methods added to api.js
  - Confirmed: startSync, getSyncStatus, getLatestImport (lines 139-173 in api.js)

- [x] SyncButton component created with all features
  - Confirmed: /client/src/components/SyncButton.jsx exists with 190 lines

- [x] SyncButton integrated into HomePage
  - Confirmed: Import on line 7, headerActions on lines 231-236, passed to Layout on line 244

- [x] Button only visible with valid token
  - Confirmed: Conditional rendering `token ? <SyncButton> : null` (lines 231-236)

- [x] Real-time progress updates working
  - Confirmed: Polling effect on lines 65-117, updates every 3000ms

- [x] Polling starts/stops correctly
  - Confirmed: Interval cleared on completion/failure (lines 81, 96, 103)

- [x] Resume on page refresh working
  - Confirmed: checkExistingSync effect on lines 120-142

- [x] Duplicate sync prevention working
  - Confirmed: Server returns 409 (import.js:20-24), client handles 409 (SyncButton.jsx:48-55)

- [x] Toast notifications for all states
  - Confirmed: Toast state and showToast calls throughout component

- [x] Map refreshes on completion
  - Confirmed: onSyncComplete callback (line 85-87), calls loadCheckins (line 234)

- [x] All commits made with descriptive messages
  - Confirmed: Git log shows proper commit messages with Claude Code footer

---

## Known Limitations (As Per Plan)

These are intentional design decisions, not bugs:

1. **No localStorage persistence**: jobId only stored in React state
   - Refreshing during sync works via API call to `/api/import/latest`
   - This is acceptable since API is source of truth

2. **No cancel functionality**: Once started, sync must complete
   - Future enhancement (noted in plan)

3. **No sync history UI**: Only current/latest sync shown
   - Future enhancement (noted in plan)

4. **No desktop notifications**: Only in-app toasts
   - Future enhancement (noted in plan)

---

## Troubleshooting Guide

### Issue: Button doesn't appear
- Check if token is in URL or localStorage
- Verify token is valid (test with API call)
- Check console for React errors

### Issue: Sync doesn't start
- Check network tab for API errors
- Verify server is running
- Check Swarm API credentials
- Look for 401/403 auth errors

### Issue: Progress not updating
- Verify polling interval in network tab
- Check if jobId exists in state
- Look for API errors in console

### Issue: Map doesn't refresh after sync
- Verify onSyncComplete callback is called
- Check network tab for /api/checkins request
- Ensure loadCheckins() is being called

### Issue: Button stuck in syncing state
- Check if API is returning completion status
- Verify polling cleanup on unmount
- Force refresh page to reset state

---

## Sign-off

### Code Verification: PASSED
- [x] Build compiles successfully
- [x] No ESLint errors
- [x] No TypeScript errors (N/A - JavaScript project)
- [x] All dependencies installed
- [x] All imports resolve correctly

### Integration Verification: PASSED
- [x] API endpoints exist (server/routes/import.js)
- [x] Component properly integrated into HomePage
- [x] Layout component accepts headerActions prop
- [x] Token-based visibility logic correct

### Git Verification: PASSED
- [x] All required commits made:
  - 73eb22d: feat(api): Add sync API methods
  - b0e0397: feat(ui): Add SyncButton component
  - c966ecf: fix(ui): Prevent memory leak in SyncButton
  - cf329d0: feat(ui): Integrate SyncButton into HomePage

### Manual Testing Required
Due to the nature of this feature (UI with live API integration), the following tests MUST be performed manually by a human tester:

**Critical Tests (Must Pass):**
- [ ] Test 1: Idle State
- [ ] Test 2: Starting a Sync
- [ ] Test 3: Real-time Progress Updates
- [ ] Test 5: Sync Completion
- [ ] Test 6: Resume on Page Refresh
- [ ] Test 7: Duplicate Sync Prevention

**Important Tests (Should Pass):**
- [ ] Test 4: Click During Active Sync
- [ ] Test 8: Sync Failure Handling
- [ ] Test 9: Authentication Failure
- [ ] Test 11: Mobile Responsive Testing

**Optional Tests (Nice to Have):**
- [ ] Test 10: Network Error Handling
- [ ] Test 12: Multi-line Toast Formatting
- [ ] Test 13: Accessibility Testing
- [ ] Test 14: Performance Testing
- [ ] Test 15: Long-running Sync

---

## Test Execution Log

### Tester Information
- **Tester Name:** _________________
- **Test Date:** _________________
- **Environment:** _________________
- **Token Used:** _________________ (last 4 chars only)

### Test Results

| Test # | Test Name | Status | Notes |
|--------|-----------|--------|-------|
| 1 | Idle State | ⬜ Pass ⬜ Fail | |
| 2 | Starting Sync | ⬜ Pass ⬜ Fail | |
| 3 | Progress Updates | ⬜ Pass ⬜ Fail | |
| 4 | Click During Sync | ⬜ Pass ⬜ Fail | |
| 5 | Completion | ⬜ Pass ⬜ Fail | |
| 6 | Resume on Refresh | ⬜ Pass ⬜ Fail | |
| 7 | Duplicate Prevention | ⬜ Pass ⬜ Fail | |
| 8 | Failure Handling | ⬜ Pass ⬜ Fail | |
| 9 | Auth Failure | ⬜ Pass ⬜ Fail | |
| 10 | Network Error | ⬜ Pass ⬜ Fail | |
| 11 | Mobile Responsive | ⬜ Pass ⬜ Fail | |
| 12 | Toast Formatting | ⬜ Pass ⬜ Fail | |
| 13 | Accessibility | ⬜ Pass ⬜ Fail | |
| 14 | Performance | ⬜ Pass ⬜ Fail | |
| 15 | Long-running Sync | ⬜ Pass ⬜ Fail | |

### Issues Found
1. _________________
2. _________________
3. _________________

### Overall Assessment
⬜ Ready for Production
⬜ Needs Minor Fixes
⬜ Needs Major Fixes

### Tester Signature
_________________

---

## Next Steps

After successful manual testing:

1. **If all tests pass:**
   - Mark feature as complete
   - Close related issues/tickets
   - Update release notes
   - Deploy to production

2. **If issues found:**
   - Document each issue in detail
   - Prioritize fixes (critical/major/minor)
   - Create fix commits following same commit message format
   - Re-test after fixes

3. **Future enhancements** (from plan):
   - Persist jobId in localStorage
   - Add "Cancel Sync" functionality
   - Show sync history/last sync time
   - Desktop notifications on completion
