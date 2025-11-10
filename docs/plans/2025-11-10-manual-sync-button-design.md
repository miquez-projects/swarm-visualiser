# Manual Check-in Sync Button - Design Document

**Date:** November 10, 2025
**Status:** Approved
**Author:** Claude Code (via brainstorming session)

## Problem Statement

The application has a daily check-in sync scheduled, but on Render's free tier the server regularly spins down, preventing the automatic sync from running. Users need a way to manually trigger check-in synchronization on demand.

## Solution Overview

Add a "Sync Check-ins" button to the application header that allows authenticated users to manually trigger and monitor check-in synchronization progress in real-time.

## Requirements

### Functional Requirements
- Button visible in header only when user has valid authentication token
- Trigger sync via existing `/api/import/start` endpoint
- Show real-time progress percentage during sync (e.g., "Syncing 42%")
- Poll sync status every 3 seconds while sync is running
- Display detailed progress information when user clicks during sync
- Handle case where sync is already running (show current progress)
- Refresh map with new check-ins after successful sync completion

### Non-Functional Requirements
- Reuse existing UI patterns (Snackbar + Alert for notifications)
- Integrate seamlessly with existing header layout
- Minimal impact on codebase (simple button + polling approach)
- Resume progress display if user refreshes page during sync

## Architecture

### Approach Selected: Simple Button + Polling

**Rationale:** Simplest approach that meets all requirements without over-engineering. Direct button component with local state and polling logic.

**Trade-offs:**
- ✅ Simple to implement and understand
- ✅ Minimal code changes required
- ✅ No complex state management needed
- ⚠️ State doesn't persist across navigation (acceptable - users typically stay on map during sync)

### Component Structure

**New Component:** `client/src/components/SyncButton.jsx`

**Location:** Header bar, between navigation buttons and dark mode toggle

**Props:**
```javascript
{
  token: string,           // Authentication token
  onSyncComplete: function // Callback to refresh map data
}
```

**Component State:**
```javascript
{
  syncing: boolean,        // Whether sync is currently running
  jobId: string,           // Current job ID for polling
  progress: {
    totalImported: number,
    totalExpected: number,
    status: string
  },
  error: string            // Error message if sync fails
}
```

## API Integration

### New API Service Methods

Add to `client/src/services/api.js`:

```javascript
/**
 * Start a new check-in sync
 * @param {string} token - Auth token
 * @returns {Promise<Object>} Job info { jobId, status, message }
 */
export const startSync = async (token) => {
  const response = await api.post('/api/import/start', {}, {
    params: { token }
  });
  return response.data;
};

/**
 * Get sync job status
 * @param {string} jobId - Import job ID
 * @param {string} token - Auth token
 * @returns {Promise<Object>} Status info
 */
export const getSyncStatus = async (jobId, token) => {
  const response = await api.get(`/api/import/status/${jobId}`, {
    params: { token }
  });
  return response.data;
};

/**
 * Get latest import job for current user
 * @param {string} token - Auth token
 * @returns {Promise<Object>} Latest job or null
 */
export const getLatestImport = async (token) => {
  const response = await api.get('/api/import/latest', {
    params: { token }
  });
  return response.data;
};
```

### Sync Flow

1. **User clicks "Sync" button**
   - Call `startSync(token)`
   - Handle response based on status code

2. **Response: 200 OK**
   - Extract `jobId` from response
   - Set `syncing = true`
   - Start polling

3. **Response: 409 Conflict (sync already running)**
   - Extract `jobId` from error response
   - Set `syncing = true`
   - Start polling
   - Show toast: "Sync in progress: X/Y check-ins imported"

4. **Polling Loop**
   - Call `getSyncStatus(jobId, token)` every 3 seconds
   - Update button text with progress percentage
   - Continue until `status === 'completed'` or `status === 'failed'`

5. **Sync Complete**
   - Stop polling
   - Show success toast with total imported count
   - Call `onSyncComplete()` to refresh map
   - Return button to idle state after 2 seconds

6. **Sync Failed**
   - Stop polling
   - Show error toast with error message
   - Return button to idle state

## UI States & Visual Feedback

### Button States

#### Idle State (no sync running)
- **Text:** "Sync Check-ins"
- **Icon:** `<Sync />` from `@mui/icons-material`
- **Color:** `inherit` (matches header theme)
- **Enabled:** Yes
- **Action:** Start new sync

#### Syncing State (sync in progress)
- **Text:** "Syncing 42%" (dynamic percentage based on progress)
- **Icon:** `<CircularProgress size={20} />` spinner
- **Color:** `inherit`
- **Enabled:** Yes
- **Action:** Show detailed progress toast

#### Completed State (just finished)
- **Text:** "Sync Complete ✓"
- **Icon:** None
- **Duration:** 2 seconds
- **Transition:** Returns to idle state

### Toast Messages

Using existing `Snackbar` + `Alert` pattern from HomePage:

| Scenario | Severity | Message | Duration |
|----------|----------|---------|----------|
| Starting sync | info | "Starting check-in sync..." | 3s |
| Already running (clicked during sync) | info | "Sync in progress: 450/1,200 check-ins imported<br/>Current batch: 5 of 12" | manual dismiss |
| Completed | success | "Sync complete! Imported 1,200 check-ins" | 5s |
| Failed | error | "Sync failed: [error message]" | 10s |
| Network error | error | "Failed to start sync. Check your connection." | 6s |
| Auth error | error | "Authentication failed. Please refresh your link." | 8s |

### Progress Display

**Button text during sync:**
```
Syncing 38%
```

**Detailed toast (when clicked during sync):**
```
Syncing check-ins...
Progress: 450 / 1,200 (38%)
Current batch: 5 of 12
```

**Progress calculation:**
```javascript
const percentage = Math.round((totalImported / totalExpected) * 100);
```

**Fallback when totalExpected is not yet available:**
```
Syncing...
```

## Polling Implementation

### Polling Lifecycle

```javascript
useEffect(() => {
  if (!syncing || !jobId) return;

  const pollInterval = setInterval(async () => {
    try {
      const status = await getSyncStatus(jobId, token);

      setProgress({
        totalImported: status.totalImported,
        totalExpected: status.totalExpected,
        status: status.status,
        currentBatch: status.currentBatch
      });

      if (status.status === 'completed') {
        setSyncing(false);
        clearInterval(pollInterval);
        showToast('success', `Sync complete! Imported ${status.totalImported} check-ins`);
        onSyncComplete(); // Refresh map
      } else if (status.status === 'failed') {
        setSyncing(false);
        clearInterval(pollInterval);
        showToast('error', `Sync failed: ${status.errorMessage}`);
      }
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        setSyncing(false);
        clearInterval(pollInterval);
        showToast('error', 'Authentication failed. Please refresh your link.');
      }
    }
  }, 3000);

  return () => clearInterval(pollInterval);
}, [syncing, jobId, token, onSyncComplete]);
```

### Resume on Page Load

Check for existing in-progress sync when component mounts:

```javascript
useEffect(() => {
  async function checkExistingSync() {
    if (!token) return;

    try {
      const { job } = await getLatestImport(token);

      if (job && (job.status === 'running' || job.status === 'pending')) {
        setJobId(job.id);
        setSyncing(true);
        setProgress({
          totalImported: job.totalImported,
          totalExpected: job.totalExpected,
          status: job.status
        });
      }
    } catch (error) {
      console.error('Failed to check existing sync:', error);
    }
  }

  checkExistingSync();
}, [token]);
```

This ensures users see sync progress even if they refresh the page during a sync.

## Edge Cases

### 1. Token Expires During Sync
- **Detection:** API returns 401/403 during polling
- **Behavior:** Stop polling, show "Session expired" toast, return button to idle
- **User action:** User must get new magic link

### 2. Multiple Tabs Open
- **Behavior:** Each tab polls independently
- **Impact:** Lightweight requests, acceptable overhead
- **Note:** All tabs show same progress (querying same jobId)

### 3. Sync Completes While on Different Page
- **Behavior:** No automatic refresh on other pages
- **Note:** If user returns to map, progress will no longer be visible (acceptable)

### 4. Server Returns No totalExpected Yet
- **Behavior:** Show "Syncing..." without percentage
- **Transition:** Once totalExpected available, show percentage

### 5. Very Fast Sync (< 3 seconds)
- **Behavior:** User might not see progress updates
- **Mitigation:** Still show "Sync Complete ✓" toast for visibility

### 6. Network Error During Polling
- **Behavior:** Continue polling (temporary network blip)
- **Note:** Error will be caught and logged, polling continues
- **Future enhancement:** Could add retry logic with exponential backoff

## Integration

### HomePage Modifications

```javascript
// In HomePage.jsx

// Add SyncButton to header actions
const headerActions = token ? (
  <SyncButton
    token={token}
    onSyncComplete={() => loadCheckins()}
  />
) : null;

// Pass to Layout
<Layout
  darkMode={darkMode}
  onToggleDarkMode={onToggleDarkMode}
  sidebar={sidebar}
  sidebarExpanded={sidebarExpanded}
  headerActions={headerActions}
>
  {/* ... */}
</Layout>
```

### Files to Create/Modify

**New Files:**
- `client/src/components/SyncButton.jsx` - Main sync button component

**Modified Files:**
- `client/src/services/api.js` - Add startSync, getSyncStatus, getLatestImport
- `client/src/pages/HomePage.jsx` - Add SyncButton to headerActions

**No Backend Changes Required:**
- All necessary endpoints already exist (`/api/import/start`, `/api/import/status/:jobId`, `/api/import/latest`)

## Testing Considerations

### Manual Testing Scenarios

1. **Happy path:** Click sync, watch progress, see completion
2. **Click during sync:** Verify detailed progress toast appears
3. **Page refresh during sync:** Verify progress resumes
4. **Multiple clicks:** Verify duplicate sync prevention
5. **Network disconnection:** Verify graceful handling
6. **Token expiration:** Verify appropriate error message
7. **No token:** Verify button not visible
8. **Very fast sync:** Verify completion toast shows
9. **Failed sync:** Verify error message displays

### Future Enhancements

- Persist jobId in localStorage to survive full page reloads
- Add "Cancel Sync" functionality
- Show sync history (last sync time, count)
- Desktop notifications when sync completes
- Retry failed syncs automatically
- Sync status indicator in app icon/title

## Success Criteria

- ✅ Users can manually trigger sync with one click
- ✅ Real-time progress visible during sync
- ✅ Works around Render free tier spin-down limitations
- ✅ Minimal code changes (single component + API methods)
- ✅ Reuses existing UI patterns consistently
- ✅ Handles edge cases gracefully
- ✅ Resume progress after page refresh

## Implementation Notes

- Use Material-UI components for consistency
- Follow existing code style in the project
- Keep polling lightweight (3-second interval is reasonable)
- No need for WebSockets/SSE (polling sufficient for this use case)
- Button should feel responsive (immediate feedback on click)
