import React, { useState, useEffect } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { lightTheme, darkTheme } from './theme';
import Layout from './components/Layout';
import MapView from './components/MapView';
import FilterPanel from './components/FilterPanel';
import StatsPanel from './components/StatsPanel';
import ComparisonView from './components/ComparisonView';
import { getCheckins } from './services/api';
import { Box, Typography, Button } from '@mui/material';
import { CompareArrows } from '@mui/icons-material';

function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [viewMode, setViewMode] = useState('map'); // 'map' or 'comparison'
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

  const handleViewModeToggle = () => {
    setViewMode(viewMode === 'map' ? 'comparison' : 'map');
  };

  const headerActions = (
    <Button
      color="inherit"
      startIcon={<CompareArrows />}
      onClick={handleViewModeToggle}
      sx={{ mr: 1 }}
    >
      {viewMode === 'map' ? 'Compare Periods' : 'Back to Map'}
    </Button>
  );

  const sidebar = viewMode === 'map' ? (
    <Box sx={{ height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      <FilterPanel onFilterChange={handleFilterChange} initialFilters={filters} />
      <StatsPanel filters={filters} />
    </Box>
  ) : null;

  return (
    <ThemeProvider theme={darkMode ? darkTheme : lightTheme}>
      <CssBaseline />
      <Layout
        darkMode={darkMode}
        onToggleDarkMode={handleThemeToggle}
        sidebar={sidebar}
        headerActions={headerActions}
      >
        {viewMode === 'comparison' ? (
          <ComparisonView onClose={() => setViewMode('map')} />
        ) : (
          <>
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
            ) : (
              <MapView checkins={checkins} loading={loading} />
            )}
          </>
        )}
      </Layout>
    </ThemeProvider>
  );
}

export default App;
