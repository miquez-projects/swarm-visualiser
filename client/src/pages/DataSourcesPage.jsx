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
  CardContent
} from '@mui/material';
import { ContentCopy, CheckCircle, FitnessCenter } from '@mui/icons-material';
import Layout from '../components/Layout';
import { validateToken } from '../services/api';

const DataSourcesPage = ({ darkMode, onToggleDarkMode }) => {
  const [searchParams] = useSearchParams();
  const [token] = useState(
    searchParams.get('token') || localStorage.getItem('authToken')
  );
  const [copied, setCopied] = useState(false);
  const [userData, setUserData] = useState(null);
  const [garminConnected, setGarminConnected] = useState(false);
  const [garminConnecting, setGarminConnecting] = useState(false);
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

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  // Check for OAuth callback success
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('garmin') === 'connected') {
      setGarminConnected(true);
      setSuccess('Garmin connected successfully!');

      // Clean URL
      window.history.replaceState({}, '', '/data-sources');
    }
  }, []);

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
        setGarminConnected(false);
        setSuccess('Garmin disconnected successfully');
      } else {
        setError('Failed to disconnect Garmin');
      }
    } catch (error) {
      console.error('Garmin disconnect error:', error);
      setError('Failed to disconnect Garmin');
    }
  };

  return (
    <Layout
      darkMode={darkMode}
      onToggleDarkMode={onToggleDarkMode}
      token={token}
      lastSyncAt={userData?.lastSyncAt}
      onSyncComplete={handleSyncComplete}
    >
      <Box sx={{ p: 4, maxWidth: 800, mx: 'auto' }}>
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

            {!garminConnected ? (
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
                <Typography color="success.main" sx={{ mb: 2 }}>
                  ✓ Connected
                </Typography>
                <Button
                  variant="outlined"
                  color="error"
                  onClick={handleGarminDisconnect}
                >
                  Disconnect
                </Button>
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
