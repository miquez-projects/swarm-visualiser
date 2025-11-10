import React, { useState, useEffect, useCallback } from 'react';
import { Button, CircularProgress, Snackbar, Alert } from '@mui/material';
import { Sync } from '@mui/icons-material';
import { startSync, getSyncStatus, getLatestImport } from '../services/api';

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
