import React, { useState, useEffect } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { lightTheme, darkTheme } from './theme';
import Layout from './components/Layout';
import MapView from './components/MapView';
import FilterPanel from './components/FilterPanel';
import StatsPanel from './components/StatsPanel';
import { getCheckins } from './services/api';
import { Box, Typography } from '@mui/material';

function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [checkins, setCheckins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({});

  useEffect(() => {
    loadCheckins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCheckins = async (appliedFilters = {}) => {
    try {
      setLoading(true);
      setError(null);
      const response = await getCheckins(appliedFilters);
      setCheckins(response.data);
    } catch (err) {
      console.error('Error loading check-ins:', err);
      setError(err.message || 'Failed to load check-ins');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    loadCheckins(newFilters);
  };

  const handleThemeToggle = () => {
    setDarkMode(!darkMode);
  };

  const sidebar = (
    <Box>
      <FilterPanel onFilterChange={handleFilterChange} initialFilters={filters} />
      <StatsPanel filters={filters} />
    </Box>
  );

  return (
    <ThemeProvider theme={darkMode ? darkTheme : lightTheme}>
      <CssBaseline />
      <Layout darkMode={darkMode} onToggleDarkMode={handleThemeToggle} sidebar={sidebar}>
        {error ? (
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 2
            }}
          >
            <Typography variant="h6" color="error">
              Error: {error}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Make sure the server is running on http://localhost:3001
            </Typography>
          </Box>
        ) : checkins.length === 0 && !loading ? (
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 2
            }}
          >
            <Typography variant="h6">
              No check-ins found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Import your Swarm data to get started:
            </Typography>
            <Typography variant="body2" color="text.secondary" fontFamily="monospace">
              npm run import -- /path/to/swarm-export.json
            </Typography>
          </Box>
        ) : (
          <MapView checkins={checkins} loading={loading} />
        )}
      </Layout>
    </ThemeProvider>
  );
}

export default App;
