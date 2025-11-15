import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import {
  Box,
  Card,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  TextField,
  Divider,
  Chip
} from '@mui/material';
import {
  LocationOn,
  DirectionsRun,
  Favorite,
  Hotel,
  Cloud,
  FitnessCenter,
  CalendarToday
} from '@mui/icons-material';
import { getDayInLife, validateToken } from '../services/api';

function DayInLifePage({ darkMode, onToggleDarkMode }) {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || localStorage.getItem('authToken');

  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [dayData, setDayData] = useState(null);
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

    fetchUserData();
  }, [searchParams, fetchUserData]);

  useEffect(() => {
    loadDayData(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const handleSyncComplete = () => {
    // Refetch user data and day data after sync
    fetchUserData();
    if (selectedDate) {
      loadDayData(selectedDate);
    }
  };

  const loadDayData = async (date) => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (token) {
        params.token = token;
      }
      const data = await getDayInLife(date, params);
      setDayData(data);
    } catch (err) {
      console.error('Error loading day data:', err);
      setError(err.message || 'Failed to load day data');
      setDayData(null);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const MetricCard = ({ icon, label, value, unit = '', color = 'primary' }) => (
    <Paper
      elevation={2}
      sx={{
        p: 3,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 120,
        bgcolor: 'background.paper'
      }}
    >
      <Box sx={{ color: `${color}.main`, mb: 1 }}>
        {icon}
      </Box>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        {label}
      </Typography>
      <Typography variant="h4" component="div" sx={{ fontWeight: 'bold' }}>
        {value !== null && value !== undefined ? value.toLocaleString() : 'N/A'}
        {unit && <Typography component="span" variant="h6" color="text.secondary"> {unit}</Typography>}
      </Typography>
    </Paper>
  );

  const hasData = dayData && (
    (dayData.timeline && dayData.timeline.length > 0) ||
    (dayData.dailyMetrics && Object.keys(dayData.dailyMetrics).length > 0) ||
    dayData.weather
  );

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
        {/* Header */}
        <Box sx={{ mb: 4, textAlign: 'center' }}>
          <Typography
            variant="h3"
            component="h1"
            sx={{
              fontWeight: 'bold',
              mb: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1
            }}
          >
            <CalendarToday fontSize="large" />
            Day in the Life
          </Typography>

          {/* Date Picker */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
            <TextField
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              sx={{ width: 250 }}
              InputLabelProps={{
                shrink: true,
              }}
            />
          </Box>
        </Box>

        {/* Loading State */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
            <CircularProgress />
          </Box>
        )}

        {/* Error State */}
        {error && !loading && (
          <Alert severity="error" sx={{ maxWidth: 800, mx: 'auto', mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Empty State */}
        {!loading && !error && !hasData && (
          <Alert severity="info" sx={{ maxWidth: 800, mx: 'auto', mb: 3 }}>
            No data available for {new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </Alert>
        )}

        {/* Content */}
        {!loading && !error && hasData && (
          <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
            {/* Daily Metrics */}
            {dayData.dailyMetrics && Object.keys(dayData.dailyMetrics).length > 0 && (
              <Box sx={{ mb: 4 }}>
                <Typography variant="h5" gutterBottom sx={{ mb: 2 }}>
                  Daily Metrics
                </Typography>
                <Grid container spacing={3}>
                  {dayData.dailyMetrics.steps !== undefined && dayData.dailyMetrics.steps !== null && (
                    <Grid item xs={12} sm={6} md={4}>
                      <MetricCard
                        icon={<DirectionsRun sx={{ fontSize: 40 }} />}
                        label="STEPS"
                        value={dayData.dailyMetrics.steps}
                        color="primary"
                      />
                    </Grid>
                  )}
                  {dayData.dailyMetrics.avgHeartRate !== undefined && dayData.dailyMetrics.avgHeartRate !== null && (
                    <Grid item xs={12} sm={6} md={4}>
                      <MetricCard
                        icon={<Favorite sx={{ fontSize: 40 }} />}
                        label="AVG HEART RATE"
                        value={Math.round(dayData.dailyMetrics.avgHeartRate)}
                        unit="bpm"
                        color="error"
                      />
                    </Grid>
                  )}
                  {dayData.dailyMetrics.sleepHours !== undefined && dayData.dailyMetrics.sleepHours !== null && (
                    <Grid item xs={12} sm={6} md={4}>
                      <MetricCard
                        icon={<Hotel sx={{ fontSize: 40 }} />}
                        label="SLEEP"
                        value={dayData.dailyMetrics.sleepHours.toFixed(1)}
                        unit="hours"
                        color="info"
                      />
                    </Grid>
                  )}
                  {dayData.dailyMetrics.activities !== undefined && dayData.dailyMetrics.activities !== null && (
                    <Grid item xs={12} sm={6} md={4}>
                      <MetricCard
                        icon={<FitnessCenter sx={{ fontSize: 40 }} />}
                        label="ACTIVITIES"
                        value={dayData.dailyMetrics.activities}
                        color="success"
                      />
                    </Grid>
                  )}
                </Grid>
              </Box>
            )}

            {/* Weather */}
            {dayData.weather && (
              <Box sx={{ mb: 4 }}>
                <Typography variant="h5" gutterBottom sx={{ mb: 2 }}>
                  Weather
                </Typography>
                <Paper elevation={2} sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Cloud sx={{ fontSize: 40, color: 'info.main' }} />
                    <Box>
                      <Typography variant="h6">
                        {dayData.weather.condition || 'N/A'}
                      </Typography>
                      {dayData.weather.temperature && (
                        <Typography variant="body2" color="text.secondary">
                          Temperature: {dayData.weather.temperature}
                        </Typography>
                      )}
                      {dayData.weather.location && (
                        <Typography variant="body2" color="text.secondary">
                          Location: {dayData.weather.location}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </Paper>
              </Box>
            )}

            {/* Timeline */}
            {dayData.timeline && dayData.timeline.length > 0 && (
              <Box sx={{ mb: 4 }}>
                <Typography variant="h5" gutterBottom sx={{ mb: 2 }}>
                  Timeline
                </Typography>
                <Card elevation={2}>
                  <List>
                    {dayData.timeline.map((event, index) => (
                      <React.Fragment key={index}>
                        <ListItem>
                          <ListItemIcon>
                            {event.type === 'checkin' ? (
                              <LocationOn color="primary" />
                            ) : event.type === 'activity' ? (
                              <FitnessCenter color="success" />
                            ) : (
                              <CalendarToday color="action" />
                            )}
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                <Typography variant="body1" component="span">
                                  {event.name || 'Unknown Event'}
                                </Typography>
                                {event.type && (
                                  <Chip
                                    label={event.type}
                                    size="small"
                                    color={event.type === 'checkin' ? 'primary' : 'success'}
                                  />
                                )}
                              </Box>
                            }
                            secondary={
                              <Box>
                                <Typography variant="body2" color="text.secondary">
                                  {formatDateTime(event.timestamp)}
                                </Typography>
                                {event.category && (
                                  <Typography variant="caption" color="text.secondary">
                                    {event.category}
                                  </Typography>
                                )}
                                {event.distance && (
                                  <Typography variant="caption" color="text.secondary" display="block">
                                    Distance: {(event.distance / 1000).toFixed(2)} km
                                  </Typography>
                                )}
                                {event.duration && (
                                  <Typography variant="caption" color="text.secondary" display="block">
                                    Duration: {Math.round(event.duration / 60)} min
                                  </Typography>
                                )}
                              </Box>
                            }
                          />
                        </ListItem>
                        {index < dayData.timeline.length - 1 && <Divider />}
                      </React.Fragment>
                    ))}
                  </List>
                </Card>
              </Box>
            )}
          </Box>
        )}
      </Box>
    </Layout>
  );
}

export default DayInLifePage;
