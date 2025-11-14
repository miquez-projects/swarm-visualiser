import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import {
  Box,
  Card,
  Typography,
  FormControl,
  Select,
  MenuItem,
  Grid,
  Paper,
  Chip,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  LocationOn,
  Public,
  Business,
  Category,
  Event,
  EmojiEvents
} from '@mui/icons-material';
import { getAvailableYears, getYearInReview, validateToken } from '../services/api';

function YearInReviewPage({ darkMode, onToggleDarkMode }) {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || localStorage.getItem('authToken');

  const [years, setYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userData, setUserData] = useState(null);

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
    if (searchParams.get('token')) {
      localStorage.setItem('authToken', searchParams.get('token'));
    }

    loadYears();
    fetchUserData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleSyncComplete = () => {
    // Refetch user data to update lastSyncAt
    fetchUserData();
    loadYears();
    if (selectedYear) {
      loadYearSummary(selectedYear);
    }
  };

  useEffect(() => {
    if (selectedYear) {
      loadYearSummary(selectedYear);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear]); // loadYearSummary is a stable function

  const loadYears = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (token) {
        params.token = token;
      }
      const availableYears = await getAvailableYears(params);
      setYears(availableYears);
      if (availableYears.length > 0) {
        setSelectedYear(availableYears[0]); // Select most recent year
      }
    } catch (err) {
      console.error('Error loading years:', err);
      setError(err.message || 'Failed to load available years');
    } finally {
      setLoading(false);
    }
  };

  const loadYearSummary = async (year) => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (token) {
        params.token = token;
      }
      const data = await getYearInReview(year, params);
      setSummary(data);
    } catch (err) {
      console.error('Error loading year summary:', err);
      setError(err.message || 'Failed to load year summary');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const StatTile = ({ icon, label, value, color = 'primary' }) => (
    <Paper
      elevation={2}
      sx={{
        p: 3,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 150,
        bgcolor: 'background.paper'
      }}
    >
      <Box sx={{ color: `${color}.main`, mb: 1 }}>
        {icon}
      </Box>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        {label}
      </Typography>
      <Typography variant="h3" component="div" sx={{ fontWeight: 'bold' }}>
        {value?.toLocaleString() || 0}
      </Typography>
    </Paper>
  );

  if (loading && !summary) {
    return (
      <Layout
        darkMode={darkMode}
        onToggleDarkMode={onToggleDarkMode}
        token={token}
        lastSyncAt={userData?.lastSyncAt}
        onSyncComplete={handleSyncComplete}
      >
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout
        darkMode={darkMode}
        onToggleDarkMode={onToggleDarkMode}
        token={token}
        lastSyncAt={userData?.lastSyncAt}
        onSyncComplete={handleSyncComplete}
      >
        <Box sx={{ p: 3 }}>
          <Alert severity="error">{error}</Alert>
        </Box>
      </Layout>
    );
  }

  return (
    <Layout
      darkMode={darkMode}
      onToggleDarkMode={onToggleDarkMode}
      token={token}
      lastSyncAt={userData?.lastSyncAt}
      onSyncComplete={handleSyncComplete}
    >
      <Box
        sx={{
          height: '100%',
          bgcolor: 'background.default',
          p: 3,
          overflowY: 'auto'
        }}
      >
        {/* Year Selector */}
        <Box sx={{ mb: 4 }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <Select
              value={selectedYear || ''}
              onChange={(e) => setSelectedYear(e.target.value)}
              displayEmpty
            >
              {years.map((year) => (
                <MenuItem key={year} value={year}>
                  {year}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Year Display */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography
            variant="h2"
            component="h1"
            sx={{
              fontWeight: 'bold',
              fontSize: { xs: '3rem', md: '4rem' }
            }}
          >
            {selectedYear}
          </Typography>
          <Box
            sx={{
              width: 200,
              height: 4,
              bgcolor: 'primary.main',
              mx: 'auto',
              mt: 2,
              borderRadius: 2
            }}
          />
        </Box>

        {/* Main Card */}
        <Card
          elevation={3}
          sx={{
            maxWidth: 1200,
            mx: 'auto',
            p: { xs: 3, md: 5 },
            bgcolor: 'background.paper'
          }}
        >
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
              <CircularProgress />
            </Box>
          ) : summary ? (
            <>
              {/* Stat Tiles Grid */}
              <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} sm={6} md={4}>
                  <StatTile
                    icon={<LocationOn sx={{ fontSize: 40 }} />}
                    label="TOTAL CHECK-INS"
                    value={summary.total_checkins}
                    color="primary"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <StatTile
                    icon={<Public sx={{ fontSize: 40 }} />}
                    label="COUNTRIES"
                    value={summary.countries_count}
                    color="success"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <StatTile
                    icon={<Business sx={{ fontSize: 40 }} />}
                    label="VENUES"
                    value={summary.venues_count}
                    color="info"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <StatTile
                    icon={<Category sx={{ fontSize: 40 }} />}
                    label="CATEGORIES"
                    value={summary.categories_count}
                    color="warning"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <StatTile
                    icon={<Event sx={{ fontSize: 40 }} />}
                    label="FIRST CHECK-IN"
                    value={formatDate(summary.first_checkin)}
                    color="secondary"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <StatTile
                    icon={<Event sx={{ fontSize: 40 }} />}
                    label="LAST CHECK-IN"
                    value={formatDate(summary.last_checkin)}
                    color="secondary"
                  />
                </Grid>
              </Grid>

              {/* Countries Section */}
              <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
                <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Public color="primary" />
                  COUNTRIES VISITED
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
                  {summary.countries.map((country) => (
                    <Chip
                      key={country.country}
                      label={`${country.country} (${country.count})`}
                      color="primary"
                      variant="outlined"
                    />
                  ))}
                </Box>
              </Paper>

              {/* Top Categories Section */}
              <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
                <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Category color="primary" />
                  TOP CATEGORIES
                </Typography>
                <Box sx={{ mt: 2 }}>
                  {summary.top_categories.map((cat, index) => (
                    <Box
                      key={cat.category}
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        py: 1.5,
                        borderBottom: index < summary.top_categories.length - 1 ? 1 : 0,
                        borderColor: 'divider'
                      }}
                    >
                      <Typography variant="body1">
                        {index + 1}. {cat.category}
                      </Typography>
                      <Typography variant="body1" color="text.secondary">
                        {cat.count} check-ins
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Paper>

              {/* Top Venues Section */}
              <Paper elevation={1} sx={{ p: 3 }}>
                <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <EmojiEvents color="primary" />
                  TOP VENUES
                </Typography>
                <Box sx={{ mt: 2 }}>
                  {summary.top_venues.map((venue, index) => (
                    <Box
                      key={venue.venue_name}
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        py: 1.5,
                        borderBottom: index < summary.top_venues.length - 1 ? 1 : 0,
                        borderColor: 'divider'
                      }}
                    >
                      <Typography variant="body1">
                        {index + 1}. {venue.venue_name}
                      </Typography>
                      <Typography variant="body1" color="text.secondary">
                        {venue.count} visits
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Paper>
            </>
          ) : null}
        </Card>
      </Box>
    </Layout>
  );
}

export default YearInReviewPage;
