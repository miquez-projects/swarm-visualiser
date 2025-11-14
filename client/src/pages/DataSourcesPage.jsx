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
  Snackbar
} from '@mui/material';
import { ContentCopy, CheckCircle } from '@mui/icons-material';
import Layout from '../components/Layout';
import { validateToken } from '../services/api';

const DataSourcesPage = ({ darkMode, onToggleDarkMode }) => {
  const [searchParams] = useSearchParams();
  const [token] = useState(
    searchParams.get('token') || localStorage.getItem('authToken')
  );
  const [copied, setCopied] = useState(false);
  const [userData, setUserData] = useState(null);

  const tokenUrl = `${window.location.origin}/?token=${token}`;

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
            <ListItem>
              <ListItemText
                primary="Garmin"
                secondary="Not connected"
              />
              <Button variant="outlined" disabled>
                Connect (Coming Soon)
              </Button>
            </ListItem>
          </List>
        </Paper>

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
