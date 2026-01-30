import React, { useState, useEffect, useRef } from 'react';
import { Box, LinearProgress, Typography, Alert } from '@mui/material';
import { getSyncStatus } from '../services/api';

/**
 * Reusable sync progress bar component
 * Polls for sync status and displays real-time progress
 *
 * @param {string} jobId - The import job ID to track
 * @param {string} token - Authentication token
 * @param {string} dataSource - Data source name ('foursquare', 'strava', 'garmin')
 * @param {Function} onComplete - Callback when sync completes successfully
 * @param {Function} onError - Callback when sync fails
 */
function SyncProgressBar({ jobId, token, dataSource = 'data', onComplete, onError }) {
  const [progress, setProgress] = useState({
    totalImported: 0,
    totalExpected: 0,
    status: 'pending'
  });
  const [error, setError] = useState(null);
  const pollIntervalRef = useRef(null);
  const errorAlertRef = useRef(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // Scroll to error alert when error appears
  useEffect(() => {
    if ((error || progress.status === 'failed') && errorAlertRef.current) {
      errorAlertRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [error, progress.status]);

  // Poll for status updates
  useEffect(() => {
    if (!jobId || !token) return;

    const pollStatus = async () => {
      try {
        const status = await getSyncStatus(jobId, token, dataSource);

        setProgress({
          totalImported: status.totalImported || 0,
          totalExpected: status.totalExpected || 0,
          status: status.status
        });

        // Handle completion
        if (status.status === 'completed') {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          if (onComplete) {
            onComplete(status);
          }
        }

        // Handle failure
        if (status.status === 'failed') {
          console.log('[SyncProgressBar] Detected failed status:', status);
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          const errorMsg = status.errorMessage || 'Unknown error';
          console.log('[SyncProgressBar] Setting error:', errorMsg);
          setError(errorMsg);
          console.log('[SyncProgressBar] Calling onError callback');
          if (onError) {
            onError(errorMsg);
          }
        }
      } catch (err) {
        console.error('Failed to poll sync status:', err);
        // Don't stop polling on temporary errors (network issues)
        // Only stop on authentication errors
        if (err.response?.status === 401 || err.response?.status === 403) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          const errorMsg = 'Authentication failed';
          setError(errorMsg);
          if (onError) {
            onError(errorMsg);
          }
        }
      }
    };

    // Initial poll
    pollStatus();

    // Set up polling interval (2 seconds)
    pollIntervalRef.current = setInterval(pollStatus, 2000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [jobId, token, dataSource, onComplete, onError]);

  // Calculate progress percentage
  const percentage = progress.totalExpected > 0
    ? Math.round((progress.totalImported / progress.totalExpected) * 100)
    : 0;

  // Determine if we should show determinate or indeterminate progress
  const hasTotalExpected = progress.totalExpected > 0;

  // Format data source name for display
  const displayName = dataSource.charAt(0).toUpperCase() + dataSource.slice(1);

  // Render progress text
  const getProgressText = () => {
    if (progress.status === 'completed') {
      const count = progress.totalImported || 0;
      if (count === 0) {
        return `${displayName} sync complete - no new activities to import`;
      }
      return `${displayName} sync complete! ${count} ${count === 1 ? 'activity' : 'activities'} imported`;
    }

    if (progress.status === 'failed') {
      return `${displayName} sync failed`;
    }

    if (hasTotalExpected) {
      return `Syncing ${displayName}... ${progress.totalImported} / ${progress.totalExpected} (${percentage}%)`;
    }

    return `Syncing ${displayName}... ${progress.totalImported} items`;
  };

  // Determine alert severity for failed status
  const getFailedSeverity = () => {
    const imported = progress.totalImported || 0;
    // If we imported some activities before failing, show warning instead of error
    return imported > 0 ? 'warning' : 'error';
  };

  // Show error/warning alert if failed
  if (error || progress.status === 'failed') {
    console.log('[SyncProgressBar] Rendering error alert. error:', error, 'progress:', progress);
    const imported = progress.totalImported || 0;
    const severity = getFailedSeverity();

    let message = '';
    if (imported > 0) {
      message = `${displayName} sync incomplete: ${imported} ${imported === 1 ? 'activity' : 'activities'} imported before error`;
      if (error) {
        message += ` - ${error}`;
      }
    } else {
      message = `${displayName} sync failed`;
      if (error) {
        message += `: ${error}`;
      }
    }

    console.log('[SyncProgressBar] Error message:', message, 'severity:', severity);

    return (
      <Box ref={errorAlertRef} sx={{ width: '100%', mt: 2 }}>
        <Alert severity={severity}>
          {message}
          {imported > 0 && (
            <Box sx={{ mt: 1, fontSize: '0.875rem' }}>
              Your imported activities are saved. You can try syncing again later to get the rest.
            </Box>
          )}
        </Alert>
      </Box>
    );
  }

  // Show success alert if completed
  if (progress.status === 'completed') {
    const imported = progress.totalImported || 0;
    const severity = imported === 0 ? 'info' : 'success';

    return (
      <Box sx={{ width: '100%', mt: 2 }}>
        <Alert severity={severity}>
          {getProgressText()}
        </Alert>
      </Box>
    );
  }

  // Show progress bar for pending/running states
  return (
    <Box sx={{ width: '100%', mt: 2 }}>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        {getProgressText()}
      </Typography>
      <LinearProgress
        variant={hasTotalExpected ? 'determinate' : 'indeterminate'}
        value={percentage}
        color="secondary"
        sx={{
          height: 8,
          borderRadius: 4,
          bgcolor: 'background.surface',
          '& .MuiLinearProgress-bar': {
            bgcolor: 'secondary.main', // Teal accent color
          },
        }}
      />
    </Box>
  );
}

export default SyncProgressBar;
