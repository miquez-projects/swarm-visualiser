import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  Button,
  LinearProgress,
  Alert,
  Card,
  CardContent
} from '@mui/material';
import { CloudUpload, CheckCircle, Error as ErrorIcon } from '@mui/icons-material';
import { useSearchParams, useNavigate } from 'react-router-dom';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function ImportPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [user, setUser] = useState(null);
  const [importJob, setImportJob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (token) {
      // Store token in localStorage for future requests
      localStorage.setItem('authToken', token);
      fetchUser();
      fetchLatestImportJob();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]); // fetchUser and fetchLatestImportJob are stable functions

  useEffect(() => {
    // Poll for import job status if one is running
    if (importJob && (importJob.status === 'pending' || importJob.status === 'running')) {
      const interval = setInterval(() => {
        fetchImportJobStatus(importJob.id);
      }, 2000); // Poll every 2 seconds

      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importJob]); // fetchImportJobStatus is a stable function

  const fetchUser = async () => {
    try {
      const response = await fetch(`${API_URL}/api/auth/me?token=${token}`);
      if (!response.ok) throw new Error('Failed to fetch user');
      const data = await response.json();
      setUser(data);
    } catch (err) {
      console.error('Error fetching user:', err);
      setError('Failed to authenticate. Please try logging in again.');
    }
  };

  const fetchLatestImportJob = async () => {
    try {
      const response = await fetch(`${API_URL}/api/import/latest?token=${token}`);
      if (!response.ok) throw new Error('Failed to fetch import job');
      const data = await response.json();
      if (data.job) {
        setImportJob(data.job);
      }
    } catch (err) {
      console.error('Error fetching import job:', err);
    }
  };

  const fetchImportJobStatus = async (jobId) => {
    try {
      const response = await fetch(`${API_URL}/api/import/status/${jobId}?token=${token}`);
      if (!response.ok) throw new Error('Failed to fetch import status');
      const data = await response.json();
      setImportJob(data);
    } catch (err) {
      console.error('Error fetching import status:', err);
    }
  };

  const startImport = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_URL}/api/import/start?token=${token}`, {
        method: 'POST'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start import');
      }

      const data = await response.json();
      setImportJob(data);

      // Start polling for updates
      setTimeout(() => fetchImportJobStatus(data.jobId), 1000);
    } catch (err) {
      console.error('Error starting import:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleViewData = () => {
    navigate(`/?token=${token}`);
  };

  const handleOAuthLogin = () => {
    window.location.href = `${API_URL}/api/auth/login`;
  };

  // If no token, show login page
  if (!token) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h4" gutterBottom>
            Swarm Visualizer
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            Connect your Foursquare account to import and visualize your check-in history
          </Typography>
          <Button
            variant="contained"
            size="large"
            startIcon={<CloudUpload />}
            onClick={handleOAuthLogin}
            sx={{ mt: 2 }}
          >
            Connect with Foursquare
          </Button>
        </Paper>
      </Container>
    );
  }

  // Show import interface if token is present
  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom>
          Import Your Check-ins
        </Typography>

        {user && (
          <Typography variant="body1" color="text.secondary" paragraph>
            Welcome, {user.displayName}! {user.lastSyncAt ? 'Your data was last synced on ' + new Date(user.lastSyncAt).toLocaleDateString() : 'Import your check-ins to get started.'}
          </Typography>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {importJob ? (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                {importJob.status === 'completed' && <CheckCircle color="success" sx={{ mr: 1 }} />}
                {importJob.status === 'failed' && <ErrorIcon color="error" sx={{ mr: 1 }} />}
                <Typography variant="h6">
                  Import Status: {importJob.status.charAt(0).toUpperCase() + importJob.status.slice(1)}
                </Typography>
              </Box>

              {importJob.status === 'running' && (
                <>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Importing check-ins... {importJob.totalImported} / {importJob.totalExpected || '?'}
                  </Typography>
                  <LinearProgress
                    variant={importJob.totalExpected ? "determinate" : "indeterminate"}
                    value={importJob.totalExpected ? (importJob.totalImported / importJob.totalExpected) * 100 : 0}
                    sx={{ my: 2 }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    Batch {importJob.currentBatch || 0}
                  </Typography>
                </>
              )}

              {importJob.status === 'pending' && (
                <Typography variant="body2" color="text.secondary">
                  Import queued... waiting to start
                </Typography>
              )}

              {importJob.status === 'completed' && (
                <Alert severity="success" sx={{ mt: 2 }}>
                  Successfully imported {importJob.totalImported} check-ins!
                </Alert>
              )}

              {importJob.status === 'failed' && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  Import failed: {importJob.errorMessage}
                </Alert>
              )}
            </CardContent>
          </Card>
        ) : null}

        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            startIcon={<CloudUpload />}
            onClick={startImport}
            disabled={loading || (importJob && (importJob.status === 'pending' || importJob.status === 'running'))}
          >
            {importJob ? 'Refresh Data' : 'Start Import'}
          </Button>

          {importJob && importJob.status === 'completed' && (
            <Button
              variant="outlined"
              onClick={handleViewData}
            >
              View My Data
            </Button>
          )}
        </Box>

        <Box sx={{ mt: 4, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Your magic link: {window.location.href}
          </Typography>
          <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
            Bookmark this URL to access your data anytime without logging in again.
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
}

export default ImportPage;
