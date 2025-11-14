import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import MapView from '../components/MapView';
import FilterPanel from '../components/FilterPanel';
import StatsPanel from '../components/StatsPanel';
import { getCheckins, validateToken } from '../services/api';
import { Box, Snackbar, Alert } from '@mui/material';

function HomePage({ darkMode, onToggleDarkMode, mapRef: externalMapRef }) {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || localStorage.getItem('authToken');

  const [checkins, setCheckins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({});
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [error, setError] = useState(null);
  const [statsRefreshTrigger, setStatsRefreshTrigger] = useState(0);
  const [userData, setUserData] = useState(null);

  // Viewport tracking state
  const [currentBounds, setCurrentBounds] = useState(null);
  const [currentZoom, setCurrentZoom] = useState(1.5);
  const [lastLoadedBounds, setLastLoadedBounds] = useState(null);
  const [viewportLoading, setViewportLoading] = useState(false);
  const localMapRef = useRef(null);
  const mapRef = externalMapRef || localMapRef;

  // Check if inner bounds fully contained within outer bounds
  const boundsContained = useCallback((inner, outer) => {
    return inner.minLng >= outer.minLng &&
           inner.maxLng <= outer.maxLng &&
           inner.minLat >= outer.minLat &&
           inner.maxLat <= outer.maxLat;
  }, []);

  // Add buffer percentage to bounds (clamped to valid lat/lng ranges)
  const addBuffer = useCallback((bounds, percent) => {
    const lngRange = bounds.maxLng - bounds.minLng;
    const latRange = bounds.maxLat - bounds.minLat;

    return {
      minLng: Math.max(-180, bounds.minLng - (lngRange * percent)),
      maxLng: Math.min(180, bounds.maxLng + (lngRange * percent)),
      minLat: Math.max(-90, bounds.minLat - (latRange * percent)),
      maxLat: Math.min(90, bounds.maxLat + (latRange * percent))
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

  const loadCheckins = useCallback(async (filterOverrides = {}, retryCount = 0) => {
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
      setError('Failed to load venues. Please try again.');

      // Auto-retry once after 3 seconds
      if (retryCount === 0) {
        setTimeout(() => {
          loadCheckins(filterOverrides, 1);
        }, 3000);
      }
    } finally {
      setLoading(false);
    }
  }, [filters, token]);

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
    // Store token in localStorage if it's in URL
    const urlToken = searchParams.get('token');
    if (urlToken) {
      localStorage.setItem('authToken', urlToken);
    }

    loadCheckins();
    fetchUserData();
  }, [searchParams, loadCheckins, fetchUserData]);

  const handleSyncComplete = () => {
    // Refetch user data to update lastSyncAt
    fetchUserData();
    loadCheckins();
    setStatsRefreshTrigger(prev => prev + 1);
  };

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, calculateBounds]); // mapRef is stable (ref), no need to include

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mapRef is stable (ref), no need to include

  // Viewport-based loading when user pans/zooms
  useEffect(() => {
    // Skip if no movement, at world view, or currently loading
    if (!currentBounds || currentZoom < 3 || loading) return;

    // Skip if new bounds fully contained within last loaded bounds
    if (lastLoadedBounds && boundsContained(currentBounds, lastLoadedBounds)) {
      return;
    }

    // Debounce: Only load after user stops moving for 500ms
    const timer = setTimeout(async () => {
      setViewportLoading(true);

      try {
        const bufferPercent = currentZoom >= 7 ? 0.2 : 0.5;
        const bufferedBounds = addBuffer(currentBounds, bufferPercent);

        await loadCheckins({
          bounds: `${bufferedBounds.minLng},${bufferedBounds.minLat},${bufferedBounds.maxLng},${bufferedBounds.maxLat}`,
          zoom: Math.floor(currentZoom)
        });

        setLastLoadedBounds(bufferedBounds);
      } finally {
        setViewportLoading(false);
      }
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
        refreshTrigger={statsRefreshTrigger}
      />
    </Box>
  );

  return (
    <Layout
      darkMode={darkMode}
      onToggleDarkMode={onToggleDarkMode}
      sidebar={sidebar}
      sidebarExpanded={sidebarExpanded}
      token={token}
      lastSyncAt={userData?.lastSyncAt}
      onSyncComplete={handleSyncComplete}
    >
      <MapView
        checkins={checkins}
        loading={loading}
        viewportLoading={viewportLoading}
        mapRef={mapRef}
        onViewportChange={handleViewportChange}
        token={token}
      />

      {error && (
        <Snackbar
          open={Boolean(error)}
          autoHideDuration={6000}
          onClose={() => setError(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            onClose={() => setError(null)}
            severity="error"
            sx={{ width: '100%' }}
          >
            {error}
          </Alert>
        </Snackbar>
      )}
    </Layout>
  );
}

export default HomePage;
