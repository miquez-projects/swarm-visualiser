import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Snackbar,
  Card,
  CardContent,
  FormControlLabel,
  Switch
} from '@mui/material';
import { ContentCopy, CheckCircle, FitnessCenter, DirectionsBike } from '@mui/icons-material';
import Layout from '../components/Layout';
import SyncProgressBar from '../components/SyncProgressBar';
import { validateToken } from '../services/api';

const DataSourcesPage = ({ darkMode, onToggleDarkMode }) => {
  const [searchParams] = useSearchParams();
  const [token] = useState(
    searchParams.get('token') || localStorage.getItem('authToken')
  );
  const [copied, setCopied] = useState(false);
  const [userData, setUserData] = useState(null);
  const [garminStatus, setGarminStatus] = useState({
    connected: false,
    connectedAt: null,
    lastSyncAt: null,
    syncActivities: true
  });
  const [garminConnecting, setGarminConnecting] = useState(false);
  const [syncingGarmin, setSyncingGarmin] = useState(false);
  const [updatingGarmin, setUpdatingGarmin] = useState(false);
  const [stravaStatus, setStravaStatus] = useState({
    connected: false,
    athleteId: null,
    lastSyncAt: null
  });
  const [syncingStrava, setSyncingStrava] = useState(false);
  const [garminJobId, setGarminJobId] = useState(null);
  const [stravaJobId, setStravaJobId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const tokenUrl = `${window.location.origin}/?token=${token}`;
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  // Fetch user data to get lastSyncAt
  const fetchUserData = useCallback(async () => {
    if (token) {
      try {
        const data = await validateToken(token);
        setUserData(data);
      } catch (error) {
        console.error('Failed to fetch user data:', error);
      }
    }
  }, [token]);

  // Fetch Garmin status
  const fetchGarminStatus = useCallback(async () => {
    if (token) {
      try {
        const response = await fetch(`${API_URL}/api/garmin/status`, {
          headers: {
            'x-auth-token': token
          }
        });

        if (response.ok) {
          const data = await response.json();
          setGarminStatus(data);
        }
      } catch (error) {
        console.error('Failed to fetch Garmin status:', error);
      }
    }
  }, [token, API_URL]);

  // Fetch Strava status
  const fetchStravaStatus = useCallback(async () => {
    if (token) {
      try {
        const response = await fetch(`${API_URL}/api/strava/status`, {
          headers: {
            'x-auth-token': token
          }
        });

        if (response.ok) {
          const data = await response.json();
          setStravaStatus(data);
        }
      } catch (error) {
        console.error('Failed to fetch Strava status:', error);
      }
    }
  }, [token, API_URL]);


  useEffect(() => {
    fetchUserData();
    fetchGarminStatus();
    fetchStravaStatus();
  }, [fetchUserData, fetchGarminStatus, fetchStravaStatus]);

  // Check for OAuth callback success
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Handle Garmin callback
    if (params.get('garmin') === 'connected') {
      fetchGarminStatus();
      setSuccess('Garmin connected successfully!');
      window.history.replaceState({}, '', '/data-sources');
    }

    // Handle Strava callback
    if (params.get('strava') === 'connected') {
      fetchStravaStatus();
      setSuccess('Strava connected! Initial sync started.');
      window.history.replaceState({}, '', '/data-sources');
    }

    // Handle errors
    if (params.get('error')) {
      const errorType = params.get('error');
      if (errorType === 'session_expired') {
        setError('Session expired. Please try connecting again.');
      } else if (errorType === 'strava_failed') {
        setError('Failed to connect Strava. Please try again.');
      }
      window.history.replaceState({}, '', '/data-sources');
    }
  }, [fetchGarminStatus, fetchStravaStatus]);

  const handleSyncComplete = () => {
    // Refetch user data to update lastSyncAt
    fetchUserData();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(tokenUrl);
    setCopied(true);
  };

  const handleGarminConnect = async () => {
    setGarminConnecting(true);

    try {
      const response = await fetch(`${API_URL}/api/garmin/connect`, {
        headers: {
          'x-auth-token': token
        }
      });

      const data = await response.json();

      if (data.authUrl) {
        // Redirect to Garmin OAuth
        window.location.href = data.authUrl;
      } else {
        setError('Failed to initiate Garmin connection');
      }
    } catch (err) {
      console.error('Garmin connect error:', err);
      setError('Failed to connect to Garmin');
    } finally {
      setGarminConnecting(false);
    }
  };

  const handleGarminToggleActivities = async (event) => {
    const newValue = event.target.checked;
    setUpdatingGarmin(true);

    try {
      const response = await fetch(`${API_URL}/api/garmin/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        },
        body: JSON.stringify({ syncActivities: newValue })
      });

      if (response.ok) {
        setGarminStatus(prev => ({ ...prev, syncActivities: newValue }));
        setSuccess(
          newValue
            ? 'Garmin activity sync enabled'
            : 'Garmin activity sync disabled (daily metrics only)'
        );
      } else {
        setError('Failed to update Garmin settings');
      }
    } catch (error) {
      console.error('Garmin settings error:', error);
      setError('Failed to update Garmin settings');
    } finally {
      setUpdatingGarmin(false);
    }
  };

  const handleGarminSync = async () => {
    setSyncingGarmin(true);

    try {
      const response = await fetch(`${API_URL}/api/garmin/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        },
        body: JSON.stringify({ syncType: 'incremental' })
      });

      if (response.ok) {
        const data = await response.json();
        setGarminJobId(data.jobId);
        setSuccess('Garmin sync started');
      } else {
        setError('Failed to start Garmin sync');
      }
    } catch (error) {
      console.error('Garmin sync error:', error);
      setError('Failed to start Garmin sync');
    } finally {
      setSyncingGarmin(false);
    }
  };

  const handleGarminDisconnect = async () => {
    if (!window.confirm('Disconnect Garmin?')) return;

    try {
      const response = await fetch(`${API_URL}/api/garmin/disconnect`, {
        method: 'DELETE',
        headers: {
          'x-auth-token': token
        }
      });

      if (response.ok) {
        setGarminStatus({
          connected: false,
          connectedAt: null,
          lastSyncAt: null,
          syncActivities: true
        });
        setSuccess('Garmin disconnected successfully');
      } else {
        setError('Failed to disconnect Garmin');
      }
    } catch (error) {
      console.error('Garmin disconnect error:', error);
      setError('Failed to disconnect Garmin');
    }
  };

  // Strava handlers
  const handleStravaConnect = async () => {
    try {
      // Call /api/strava/auth/start to get authorization URL
      const response = await fetch(`${API_URL}/api/strava/auth/start`, {
        headers: { 'x-auth-token': token }
      });
      const { authorizationUrl } = await response.json();

      // Redirect to Strava OAuth page
      window.location.href = authorizationUrl;
    } catch (error) {
      console.error('Strava connect error:', error);
      setError('Failed to initiate Strava connection');
    }
  };

  const handleStravaSync = async () => {
    setSyncingStrava(true);

    try {
      const response = await fetch(`${API_URL}/api/strava/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStravaJobId(data.jobId);
        setSuccess('Strava sync started');
      } else {
        setError('Failed to start Strava sync');
      }
    } catch (error) {
      console.error('Strava sync error:', error);
      setError('Failed to start Strava sync');
    } finally {
      setSyncingStrava(false);
    }
  };

  const handleStravaDisconnect = async () => {
    if (!window.confirm('Disconnect Strava?')) return;

    try {
      const response = await fetch(`${API_URL}/api/strava/disconnect`, {
        method: 'DELETE',
        headers: {
          'x-auth-token': token
        }
      });

      if (response.ok) {
        setStravaStatus({
          connected: false,
          athleteId: null,
          lastSyncAt: null
        });
        setSuccess('Strava disconnected successfully');
      } else {
        setError('Failed to disconnect Strava');
      }
    } catch (error) {
      console.error('Strava disconnect error:', error);
      setError('Failed to disconnect Strava');
    }
  };

  // Helper function to format dates
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const formatLastSync = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  return (
    <Layout
      darkMode={darkMode}
      onToggleDarkMode={onToggleDarkMode}
      token={token}
      lastSyncAt={userData?.lastSyncAt}
      onSyncComplete={handleSyncComplete}
    >
      <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, maxWidth: 800, mx: 'auto', minHeight: '100%' }}>
        <Typography variant="h4" gutterBottom>
          Data Sources
        </Typography>

        {/* Token Display */}
        <Paper sx={{ p: 3, mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Your Access Token
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Save this URL to access your data:
          </Typography>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              bgcolor: (theme) => theme.palette.mode === 'dark' ? 'grey.800' : 'grey.100',
              p: 2,
              borderRadius: 1,
              mt: 2
            }}
          >
            <Typography
              variant="body2"
              sx={{
                fontFamily: 'monospace',
                flex: 1,
                wordBreak: 'break-all'
              }}
            >
              {tokenUrl}
            </Typography>
            <IconButton onClick={handleCopy} size="small">
              <ContentCopy />
            </IconButton>
          </Box>
        </Paper>

        {/* Data Sources */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Connected Data Sources
          </Typography>
          <List>
            <ListItem>
              <ListItemText
                primary="Foursquare / Swarm"
                secondary="Connected - Sync check-ins and photos"
              />
              <CheckCircle color="success" />
            </ListItem>
          </List>
        </Paper>

        {/* Garmin Integration */}
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <FitnessCenter sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="h6">Garmin</Typography>
            </Box>

            {!garminStatus.connected ? (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Connect your Garmin account to sync activities, steps, heart rate, and sleep data.
                </Typography>
                <Button
                  variant="contained"
                  onClick={handleGarminConnect}
                  disabled={garminConnecting}
                >
                  {garminConnecting ? 'Connecting...' : 'Connect Garmin'}
                </Button>
              </>
            ) : (
              <>
                <Typography variant="body2" mb={1}>
                  Connected at: {formatDate(garminStatus.connectedAt)}
                </Typography>
                <Typography variant="body2" mb={2}>
                  Last synced: {formatLastSync(garminStatus.lastSyncAt)}
                </Typography>

                {/* Activity sync toggle */}
                <FormControlLabel
                  control={
                    <Switch
                      checked={garminStatus.syncActivities}
                      onChange={handleGarminToggleActivities}
                      disabled={updatingGarmin}
                    />
                  }
                  label="Sync activities (disable if using Strava)"
                  sx={{ mb: 2 }}
                />

                <Box display="flex" gap={1}>
                  <Button
                    variant="outlined"
                    onClick={handleGarminSync}
                    disabled={syncingGarmin || !!garminJobId}
                  >
                    {syncingGarmin ? 'Syncing...' : 'Sync Now'}
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={handleGarminDisconnect}
                  >
                    Disconnect
                  </Button>
                </Box>

                {garminJobId && (
                  <Box sx={{ mt: 2 }}>
                    <SyncProgressBar
                      jobId={garminJobId}
                      token={token}
                      dataSource="garmin"
                      onComplete={() => {
                        setGarminJobId(null);
                        fetchGarminStatus();
                      }}
                      onError={() => setGarminJobId(null)}
                    />
                  </Box>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Strava Integration */}
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <DirectionsBike sx={{ mr: 1, color: '#FC4C02' }} />
              <Typography variant="h6">Strava</Typography>
            </Box>

            {!stravaStatus.connected ? (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Import your runs, rides, and other activities with GPS tracklogs
                </Typography>
                <Button
                  variant="contained"
                  onClick={handleStravaConnect}
                  sx={{ bgcolor: '#FC4C02', '&:hover': { bgcolor: '#E34402' } }}
                >
                  Connect Strava
                </Button>
              </>
            ) : (
              <>
                <Typography variant="body2" mb={1}>
                  Athlete ID: {stravaStatus.athleteId}
                </Typography>
                <Typography variant="body2" mb={2}>
                  Last synced: {formatLastSync(stravaStatus.lastSyncAt)}
                </Typography>
                <Box display="flex" gap={1}>
                  <Button
                    variant="outlined"
                    onClick={handleStravaSync}
                    disabled={syncingStrava || !!stravaJobId}
                  >
                    {syncingStrava ? 'Syncing...' : 'Sync Now'}
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={handleStravaDisconnect}
                  >
                    Disconnect
                  </Button>
                </Box>

                {stravaJobId && (
                  <Box sx={{ mt: 2 }}>
                    <SyncProgressBar
                      jobId={stravaJobId}
                      token={token}
                      dataSource="strava"
                      onComplete={() => {
                        setStravaJobId(null);
                        fetchStravaStatus();
                      }}
                      onError={(errorMsg) => {
                        // Keep stravaJobId so error message stays visible
                        // User can start a new sync or refresh to clear
                        console.log('Strava sync error:', errorMsg);
                      }}
                    />
                  </Box>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Snackbar
          open={copied}
          autoHideDuration={2000}
          onClose={() => setCopied(false)}
          message="URL copied to clipboard!"
        />
        <Snackbar
          open={!!error}
          autoHideDuration={4000}
          onClose={() => setError('')}
          message={error}
        />
        <Snackbar
          open={!!success}
          autoHideDuration={4000}
          onClose={() => setSuccess('')}
          message={success}
        />
      </Box>
    </Layout>
  );
};

export default DataSourcesPage;
