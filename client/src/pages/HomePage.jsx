import React, { useState, useEffect, useCallback, useRef } from 'react';
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

  // Viewport tracking state
  const [currentBounds, setCurrentBounds] = useState(null);
  const [currentZoom, setCurrentZoom] = useState(1.5);
  const [lastLoadedBounds, setLastLoadedBounds] = useState(null);
  const mapRef = useRef(null);

  // Check if inner bounds fully contained within outer bounds
  const boundsContained = useCallback((inner, outer) => {
    return inner.minLng >= outer.minLng &&
           inner.maxLng <= outer.maxLng &&
           inner.minLat >= outer.minLat &&
           inner.maxLat <= outer.maxLat;
  }, []);

  // Add buffer percentage to bounds
  const addBuffer = useCallback((bounds, percent) => {
    const lngRange = bounds.maxLng - bounds.minLng;
    const latRange = bounds.maxLat - bounds.minLat;

    return {
      minLng: bounds.minLng - (lngRange * percent),
      maxLng: bounds.maxLng + (lngRange * percent),
      minLat: bounds.minLat - (latRange * percent),
      maxLat: bounds.maxLat + (latRange * percent)
    };
  }, []);

  const calculateBounds = useCallback((venues) => {
    if (!venues || venues.length === 0) return null;

    const lngs = venues.map(v => v.longitude).filter(lng => lng != null);
    const lats = venues.map(v => v.latitude).filter(lat => lat != null);

    if (lngs.length === 0 || lats.length === 0) return null;

    return [
      [Math.min(...lngs), Math.min(...lats)], // Southwest
      [Math.max(...lngs), Math.max(...lats)]  // Northeast
    ];
  }, []);

  useEffect(() => {
    // Store token in localStorage if it's in URL
    if (searchParams.get('token')) {
      localStorage.setItem('authToken', searchParams.get('token'));
    }

    loadCheckins();
  }, [token, loadCheckins]);

  const loadCheckins = useCallback(async (filterOverrides = {}) => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        ...filters,
        ...filterOverrides
      };

      // Add token if available
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
  }, [filters, token]);

  const handleFilterChange = useCallback(async (newFilters) => {
    setFilters(newFilters);

    // Load filtered data WITHOUT bounds (use semantic filters only)
    try {
      setLoading(true);
      setError(null);

      const params = {
        ...newFilters
      };

      // Add token if available
      if (token) {
        params.token = token;
      }

      const response = await getCheckins(params);
      setCheckins(response.data);

      // Auto-fit map to filtered results
      if (response.data && response.data.length > 0) {
        const bounds = calculateBounds(response.data);

        if (bounds && mapRef.current) {
          let maxZoom = 12;

          if (response.data.length === 1) {
            maxZoom = 15; // Close zoom for single venue
          } else if (response.data.length <= 10) {
            maxZoom = 12; // Medium zoom
          } else {
            maxZoom = 10; // Wider view
          }

          mapRef.current.fitBounds(bounds, {
            padding: 40,
            maxZoom,
            duration: 1000
          });

          // Clear lastLoadedBounds so viewport loading doesn't skip
          setLastLoadedBounds(null);
        }
      }
    } catch (err) {
      console.error('Error loading check-ins:', err);
      setError(err.message || 'Failed to load check-ins');
    } finally {
      setLoading(false);
    }
  }, [token, calculateBounds]);

  // Handle viewport changes (pan/zoom)
  const handleViewportChange = useCallback((viewState) => {
    setCurrentZoom(viewState.zoom);

    // Calculate bounds from map
    const map = mapRef.current?.getMap();
    if (!map) return;

    const bounds = map.getBounds();
    setCurrentBounds({
      minLng: bounds.getWest(),
      minLat: bounds.getSouth(),
      maxLng: bounds.getEast(),
      maxLat: bounds.getNorth()
    });
  }, []);

  // Viewport-based loading when user pans/zooms
  useEffect(() => {
    // Skip if no movement, at world view, or currently loading
    if (!currentBounds || currentZoom < 3 || loading) return;

    // Skip if new bounds fully contained within last loaded bounds
    if (lastLoadedBounds && boundsContained(currentBounds, lastLoadedBounds)) {
      return;
    }

    // Debounce: Only load after user stops moving for 500ms
    const timer = setTimeout(() => {
      const bufferPercent = currentZoom >= 7 ? 0.2 : 0.5;
      const bufferedBounds = addBuffer(currentBounds, bufferPercent);

      loadCheckins({
        bounds: `${bufferedBounds.minLng},${bufferedBounds.minLat},${bufferedBounds.maxLng},${bufferedBounds.maxLat}`,
        zoom: Math.floor(currentZoom)
      });

      setLastLoadedBounds(bufferedBounds);
    }, 500);

    return () => clearTimeout(timer);
  }, [currentBounds, currentZoom, loading, lastLoadedBounds, boundsContained, addBuffer, loadCheckins]);

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
        token={token}
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
        <MapView
          checkins={checkins}
          loading={loading}
          mapRef={mapRef}
          onViewportChange={handleViewportChange}
        />
      )}
    </Layout>
  );
}

export default HomePage;
