import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import MapView from '../components/MapView';
import FilterPanel from '../components/FilterPanel';
import StatsPanel from '../components/StatsPanel';
import { getCheckins } from '../services/api';
import { Box, Typography } from '@mui/material';

function HomePage({ darkMode, onToggleDarkMode }) {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || localStorage.getItem('authToken');

  const [checkins, setCheckins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({});
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [comparisonMode, setComparisonMode] = useState(false);

  useEffect(() => {
    // Store token in localStorage if it's in URL
    if (searchParams.get('token')) {
      localStorage.setItem('authToken', searchParams.get('token'));
    }

    loadCheckins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadCheckins = async (appliedFilters = {}) => {
    try {
      setLoading(true);
      setError(null);

      // Add token to filters if available
      const params = { ...appliedFilters };
      if (token) {
        params.token = token;
      }

      const response = await getCheckins(params);
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

  const sidebar = (
    <Box sx={{ height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      <FilterPanel
        onFilterChange={handleFilterChange}
        initialFilters={filters}
        comparisonModeActive={comparisonMode}
        isExpanded={sidebarExpanded}
        onToggleExpand={() => setSidebarExpanded(!sidebarExpanded)}
        token={token}
      />
      <StatsPanel
        filters={filters}
        isExpanded={sidebarExpanded}
        comparisonMode={comparisonMode}
        onComparisonModeChange={setComparisonMode}
      />
    </Box>
  );

  return (
    <Layout
      darkMode={darkMode}
      onToggleDarkMode={onToggleDarkMode}
      sidebar={sidebar}
      sidebarExpanded={sidebarExpanded}
    >
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
    </Layout>
  );
}

export default HomePage;
