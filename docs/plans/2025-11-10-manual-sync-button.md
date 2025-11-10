# Manual Check-in Sync Button Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a manual "Sync Check-ins" button to the header that allows authenticated users to trigger and monitor check-in synchronization with real-time progress updates.

**Architecture:** Simple button component with local state and polling. Uses existing `/api/import/*` endpoints. Button shows in header next to dark mode toggle, only visible with valid token. Polls every 3 seconds during sync to show live progress.

**Tech Stack:** React, Material-UI, axios, existing import API endpoints

---

## Task 1: Add API Service Methods

**Files:**
- Modify: `client/src/services/api.js` (after line 138)

**Step 1: Add startSync method**

Add this method after the `sendCopilotMessage` function:

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
```

**Step 2: Add getSyncStatus method**

Add immediately after startSync:

```javascript
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
```

**Step 3: Add getLatestImport method**

Add immediately after getSyncStatus:

```javascript
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

**Step 4: Verify methods are exported**

Check that the file still ends with:

```javascript
export default api;
```

No other exports needed since we're using named exports.

**Step 5: Commit API methods**

```bash
git add client/src/services/api.js
git commit -m "feat(api): Add sync API methods for manual check-in sync

Add three new API methods:
- startSync: Trigger new import job
- getSyncStatus: Poll job progress
- getLatestImport: Resume in-progress sync on page load

Part of manual sync button feature to work around Render spin-down.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Create SyncButton Component

**Files:**
- Create: `client/src/components/SyncButton.jsx`

**Step 1: Create component file with imports**

Create `client/src/components/SyncButton.jsx`:

```javascript
import React, { useState, useEffect, useCallback } from 'react';
import { Button, CircularProgress, Snackbar, Alert } from '@mui/material';
import { Sync } from '@mui/icons-material';
import { startSync, getSyncStatus, getLatestImport } from '../services/api';
```

**Step 2: Add component structure and state**

Add after imports:

```javascript
function SyncButton({ token, onSyncComplete }) {
  const [syncing, setSyncing] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [progress, setProgress] = useState({
    totalImported: 0,
    totalExpected: 0,
    status: null
  });
  const [toast, setToast] = useState({ open: false, message: '', severity: 'info' });
  const [completionShown, setCompletionShown] = useState(false);

  const showToast = useCallback((severity, message) => {
    setToast({ open: true, message, severity });
  }, []);

  const closeToast = useCallback(() => {
    setToast(prev => ({ ...prev, open: false }));
  }, []);
```

**Step 3: Add sync button click handler**

Add after state declarations:

```javascript
  const handleSyncClick = useCallback(async () => {
    // If syncing, show detailed progress
    if (syncing) {
      const percentage = progress.totalExpected > 0
        ? Math.round((progress.totalImported / progress.totalExpected) * 100)
        : 0;

      const message = progress.totalExpected > 0
        ? `Syncing check-ins...\nProgress: ${progress.totalImported} / ${progress.totalExpected} (${percentage}%)`
        : 'Syncing check-ins...\nProgress: Initializing...';

      showToast('info', message);
      return;
    }

    // Start new sync
    try {
      showToast('info', 'Starting check-in sync...');
      const result = await startSync(token);
      setJobId(result.jobId);
      setSyncing(true);
    } catch (error) {
      if (error.response?.status === 409) {
        // Sync already running - extract jobId and resume
        const runningJobId = error.response?.data?.jobId;
        if (runningJobId) {
          setJobId(runningJobId);
          setSyncing(true);
          showToast('info', 'Sync already in progress...');
        }
      } else if (error.response?.status === 401 || error.response?.status === 403) {
        showToast('error', 'Authentication failed. Please refresh your link.');
      } else {
        showToast('error', 'Failed to start sync. Check your connection.');
      }
    }
  }, [syncing, progress, token, showToast]);
```

**Step 4: Add polling effect**

Add after handleSyncClick:

```javascript
  // Polling effect
  useEffect(() => {
    if (!syncing || !jobId) return;

    const pollInterval = setInterval(async () => {
      try {
        const status = await getSyncStatus(jobId, token);

        setProgress({
          totalImported: status.totalImported || 0,
          totalExpected: status.totalExpected || 0,
          status: status.status
        });

        if (status.status === 'completed') {
          setSyncing(false);
          setCompletionShown(true);
          clearInterval(pollInterval);
          showToast('success', `Sync complete! Imported ${status.totalImported} check-ins`);

          // Call onSyncComplete to refresh map
          if (onSyncComplete) {
            onSyncComplete();
          }

          // Reset to idle after 2 seconds
          setTimeout(() => {
            setCompletionShown(false);
            setJobId(null);
          }, 2000);
        } else if (status.status === 'failed') {
          setSyncing(false);
          clearInterval(pollInterval);
          showToast('error', `Sync failed: ${status.errorMessage || 'Unknown error'}`);
          setJobId(null);
        }
      } catch (error) {
        if (error.response?.status === 401 || error.response?.status === 403) {
          setSyncing(false);
          clearInterval(pollInterval);
          showToast('error', 'Authentication failed. Please refresh your link.');
          setJobId(null);
        }
        // Other errors: continue polling (temporary network issue)
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [syncing, jobId, token, onSyncComplete, showToast]);
```

**Step 5: Add resume on mount effect**

Add after polling effect:

```javascript
  // Check for existing sync on mount
  useEffect(() => {
    async function checkExistingSync() {
      if (!token) return;

      try {
        const { job } = await getLatestImport(token);

        if (job && (job.status === 'running' || job.status === 'pending')) {
          setJobId(job.id);
          setSyncing(true);
          setProgress({
            totalImported: job.totalImported || 0,
            totalExpected: job.totalExpected || 0,
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

**Step 6: Add render method**

Add after effects:

```javascript
  // Calculate button text
  let buttonText = 'Sync Check-ins';
  let buttonIcon = <Sync />;

  if (completionShown) {
    buttonText = 'Sync Complete ✓';
    buttonIcon = null;
  } else if (syncing) {
    if (progress.totalExpected > 0) {
      const percentage = Math.round((progress.totalImported / progress.totalExpected) * 100);
      buttonText = `Syncing ${percentage}%`;
    } else {
      buttonText = 'Syncing...';
    }
    buttonIcon = <CircularProgress size={20} color="inherit" />;
  }

  return (
    <>
      <Button
        color="inherit"
        startIcon={buttonIcon}
        onClick={handleSyncClick}
        sx={{ mr: 1 }}
      >
        {buttonText}
      </Button>

      <Snackbar
        open={toast.open}
        autoHideDuration={toast.severity === 'error' ? 8000 : 5000}
        onClose={closeToast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={closeToast}
          severity={toast.severity}
          sx={{ width: '100%', whiteSpace: 'pre-line' }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </>
  );
}

export default SyncButton;
```

**Step 7: Verify component is complete**

Check the file contains:
- All imports
- Component with all state
- handleSyncClick handler
- Polling effect
- Resume on mount effect
- Render method with button and toast
- export default

**Step 8: Commit SyncButton component**

```bash
git add client/src/components/SyncButton.jsx
git commit -m "feat(ui): Add SyncButton component for manual check-in sync

New SyncButton component features:
- Shows 'Sync Check-ins' in idle state
- Displays real-time progress (e.g., 'Syncing 42%') during sync
- Polls every 3 seconds for status updates
- Handles duplicate sync attempts (shows current progress)
- Resumes in-progress sync on page load
- Shows toast notifications for all states
- Refreshes map data on completion

Integrates with existing /api/import/* endpoints.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Integrate SyncButton into HomePage

**Files:**
- Modify: `client/src/pages/HomePage.jsx`

**Step 1: Add SyncButton import**

At the top of HomePage.jsx, add to the imports (after line 6):

```javascript
import SyncButton from '../components/SyncButton';
```

**Step 2: Create headerActions with SyncButton**

After the `sidebar` constant declaration (around line 228), add:

```javascript
  const headerActions = token ? (
    <SyncButton
      token={token}
      onSyncComplete={() => loadCheckins()}
    />
  ) : null;
```

**Step 3: Pass headerActions to Layout**

Find the `<Layout>` component (around line 231) and add the `headerActions` prop:

```javascript
    <Layout
      darkMode={darkMode}
      onToggleDarkMode={onToggleDarkMode}
      sidebar={sidebar}
      sidebarExpanded={sidebarExpanded}
      headerActions={headerActions}
    >
```

**Step 4: Verify integration**

Check that:
- SyncButton is imported
- headerActions is created with conditional rendering (only if token exists)
- headerActions is passed to Layout
- onSyncComplete calls loadCheckins() to refresh map

**Step 5: Test in browser (manual verification)**

Start the development server:
```bash
npm start
```

In browser:
1. Navigate to app with `?token=<valid-token>` in URL
2. Verify "Sync Check-ins" button appears in header
3. Click button and verify sync starts
4. Verify progress updates every 3 seconds
5. Verify completion toast shows
6. Verify map refreshes with new data

Expected behavior:
- Button only visible with token
- Shows progress percentage during sync
- Updates automatically
- Shows toasts for all states
- Refreshes map on completion

**Step 6: Commit integration**

```bash
git add client/src/pages/HomePage.jsx
git commit -m "feat(ui): Integrate SyncButton into HomePage header

Add SyncButton to HomePage header with token-based visibility:
- Button only shows when user has valid token
- Positioned between navigation and dark mode toggle
- Calls loadCheckins() on sync completion to refresh map

Completes manual sync button feature.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Final Testing and Verification

**Step 1: Test idle state**

Start app with valid token:
```bash
npm start
# Navigate to http://localhost:3000?token=<valid-token>
```

Verify:
- Button shows "Sync Check-ins" with sync icon
- Button is clickable

**Step 2: Test sync start**

Click "Sync Check-ins" button

Verify:
- Toast shows "Starting check-in sync..."
- Button changes to "Syncing..." or "Syncing X%"
- Spinner icon appears

**Step 3: Test progress updates**

Wait during sync (observe for 10-15 seconds)

Verify:
- Button text updates with percentage (e.g., "Syncing 42%")
- Percentage increases over time
- Updates happen approximately every 3 seconds

**Step 4: Test click during sync**

Click button while sync is running

Verify:
- Detailed progress toast appears
- Shows "Progress: X / Y (Z%)" format
- Toast can be dismissed

**Step 5: Test completion**

Wait for sync to complete

Verify:
- Button shows "Sync Complete ✓" for 2 seconds
- Success toast shows "Sync complete! Imported X check-ins"
- Map refreshes with new check-ins
- Button returns to idle state after 2 seconds

**Step 6: Test page refresh during sync**

1. Start a sync
2. Refresh the page (F5 or Cmd+R)

Verify:
- Sync progress resumes automatically
- Button shows current progress percentage
- Polling continues

**Step 7: Test duplicate sync prevention**

1. Start a sync
2. Click button again while first sync is running

Verify:
- No second sync starts
- Toast shows current progress
- API returns 409 (check network tab)

**Step 8: Test without token**

Navigate to app without token:
```
http://localhost:3000
```

Verify:
- Sync button does NOT appear in header
- Other header elements still visible

**Step 9: Document any issues**

If any issues found, create a checklist:
```markdown
## Issues Found
- [ ] Issue 1: Description
- [ ] Issue 2: Description
```

Fix each issue and commit separately with descriptive messages.

**Step 10: Final commit (if needed)**

If you made any fixes during testing:

```bash
git add .
git commit -m "fix(sync): Address issues found during testing

- Fixed: [describe fix 1]
- Fixed: [describe fix 2]

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Completion Checklist

- [ ] API methods added to api.js
- [ ] SyncButton component created with all features
- [ ] SyncButton integrated into HomePage
- [ ] Button only visible with valid token
- [ ] Real-time progress updates working
- [ ] Polling starts/stops correctly
- [ ] Resume on page refresh working
- [ ] Duplicate sync prevention working
- [ ] Toast notifications for all states
- [ ] Map refreshes on completion
- [ ] All commits made with descriptive messages

---

## Notes

**No Backend Changes:** All necessary API endpoints already exist (`/api/import/start`, `/api/import/status/:jobId`, `/api/import/latest`)

**Testing Strategy:** Manual browser testing only (no unit tests required for this feature due to heavy integration with API and browser lifecycle)

**Future Enhancements:**
- Persist jobId in localStorage (currently only in React state)
- Add "Cancel Sync" functionality
- Show sync history/last sync time
- Desktop notifications on completion

