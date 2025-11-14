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
  TextField
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
  const [garminUsername, setGarminUsername] = useState('');
  const [garminPassword, setGarminPassword] = useState('');
  const [garminConnecting, setGarminConnecting] = useState(false);

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

  const handleSyncComplete = () => {
    // Refetch user data to update lastSyncAt
    fetchUserData();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(tokenUrl);
    setCopied(true);
  };

  const handleGarminConnect = async () => {
    if (!garminUsername || !garminPassword) {
      alert('Please enter Garmin username and password');
      return;
    }

    setGarminConnecting(true);

    try {
      const response = await fetch(`${API_URL}/api/garmin/connect?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: garminUsername,
          password: garminPassword
        })
      });

      const data = await response.json();

      if (response.ok) {
        setGarminConnected(true);
        setGarminPassword(''); // Clear password
        alert('Garmin connected successfully!');
      } else {
        alert(`Failed to connect: ${data.message || data.error}`);
      }
    } catch (error) {
      console.error('Garmin connect error:', error);
      alert('Failed to connect to Garmin');
    } finally {
      setGarminConnecting(false);
    }
  };

  const handleGarminDisconnect = async () => {
    if (!window.confirm('Disconnect Garmin?')) return;

    try {
      const response = await fetch(`${API_URL}/api/garmin/disconnect?token=${token}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setGarminConnected(false);
        setGarminUsername('');
        alert('Garmin disconnected');
      }
    } catch (error) {
      console.error('Garmin disconnect error:', error);
      alert('Failed to disconnect Garmin');
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
                  Sync activities, steps, heart rate, and sleep data from Garmin Connect
                </Typography>

                <TextField
                  fullWidth
                  label="Garmin Username"
                  value={garminUsername}
                  onChange={(e) => setGarminUsername(e.target.value)}
                  sx={{ mb: 2 }}
                  size="small"
                />

                <TextField
                  fullWidth
                  type="password"
                  label="Garmin Password"
                  value={garminPassword}
                  onChange={(e) => setGarminPassword(e.target.value)}
                  sx={{ mb: 2 }}
                  size="small"
                />

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
                <Typography variant="body2" color="success.main" sx={{ mb: 2 }}>
                  ✓ Connected
                </Typography>

                <Button
                  variant="outlined"
                  color="error"
                  onClick={handleGarminDisconnect}
                  size="small"
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
      </Box>
    </Layout>
  );
};

export default DataSourcesPage;
