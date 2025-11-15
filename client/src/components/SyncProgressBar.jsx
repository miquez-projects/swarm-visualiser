import React, { useState, useEffect, useCallback, useRef } from 'react';
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

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

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
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          const errorMsg = status.errorMessage || 'Unknown error';
          setError(errorMsg);
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
      return `${displayName} sync complete! (${progress.totalImported} items)`;
    }

    if (progress.status === 'failed') {
      return `${displayName} sync failed`;
    }

    if (hasTotalExpected) {
      return `Syncing ${displayName}... ${progress.totalImported} / ${progress.totalExpected} (${percentage}%)`;
    }

    return `Syncing ${displayName}... ${progress.totalImported} items`;
  };

  // Show error alert if failed
  if (error) {
    return (
      <Box sx={{ width: '100%', mt: 2 }}>
        <Alert severity="error">
          {displayName} sync failed: {error}
        </Alert>
      </Box>
    );
  }

  // Show success alert if completed
  if (progress.status === 'completed') {
    return (
      <Box sx={{ width: '100%', mt: 2 }}>
        <Alert severity="success">
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
        sx={{ height: 8, borderRadius: 4 }}
      />
    </Box>
  );
}

export default SyncProgressBar;
