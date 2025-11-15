import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  IconButton,
  Grid,
  CircularProgress,
  TextField
} from '@mui/material';
import { ChevronLeft, ChevronRight, CalendarToday } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import Layout from '../components/Layout';
import PropertyTile from '../components/dayinlife/PropertyTile';
import CheckinEventTile from '../components/dayinlife/CheckinEventTile';
import ActivityEventTile from '../components/dayinlife/ActivityEventTile';
import { getDayInLife } from '../services/api';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';

const DayInLifePage = ({ darkMode, onToggleDarkMode }) => {
  const { date } = useParams();
  const navigate = useNavigate();
  const [token] = useState(localStorage.getItem('authToken'));
  const [dayData, setDayData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxPhotos, setLightboxPhotos] = useState([]);

  const currentDate = date ? new Date(date) : new Date();

  useEffect(() => {
    if (date) {
      loadDayData(date);
    } else {
      // Default to today
      const today = new Date().toISOString().split('T')[0];
      navigate(`/day-in-life/${today}`);
    }
  }, [date, navigate]);

  const loadDayData = async (dateStr) => {
    console.log('[DayInLife] Loading data for:', dateStr, 'Token present:', !!token);
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (token) {
        params.token = token;
      }
      console.log('[DayInLife] Calling API with params:', params);
      const data = await getDayInLife(dateStr, params);
      console.log('[DayInLife] Data received:', data);
      setDayData(data);
    } catch (error) {
      console.error('[DayInLife] Error loading day data:', error);
      console.error('[DayInLife] Error response:', error.response);
      if (error.response?.status === 401) {
        setError('Please log in to view your day in life data.');
      } else if (error.response?.status === 400) {
        setError('Invalid date format.');
      } else {
        setError('Failed to load data. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePrevDay = () => {
    const prev = new Date(currentDate);
    prev.setDate(prev.getDate() - 1);
    navigate(`/day-in-life/${prev.toISOString().split('T')[0]}`);
  };

  const handleNextDay = () => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 1);
    navigate(`/day-in-life/${next.toISOString().split('T')[0]}`);
  };

  const handlePhotoClick = (photos) => {
    setLightboxPhotos(photos.map(p => ({ src: p.photo_url_cached || p.photo_url })));
    setLightboxOpen(true);
  };


  const formatSleepDuration = (seconds) => {
    if (!seconds) return 'No data';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  };

  if (loading) {
    return (
      <Layout darkMode={darkMode} onToggleDarkMode={onToggleDarkMode}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout darkMode={darkMode} onToggleDarkMode={onToggleDarkMode}>
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h5" color="error" gutterBottom>
            {error}
          </Typography>
          {error.includes('log in') && (
            <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
              Please go to the home page and use the magic link to log in.
            </Typography>
          )}
        </Box>
      </Layout>
    );
  }

  if (!dayData) {
    return (
      <Layout darkMode={darkMode} onToggleDarkMode={onToggleDarkMode}>
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h5">No data available for this date</Typography>
        </Box>
      </Layout>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Layout darkMode={darkMode} onToggleDarkMode={onToggleDarkMode} token={token}>
        <Box sx={{ p: 4, maxWidth: 1200, mx: 'auto' }}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
            <Typography variant="h4">
              {currentDate.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconButton onClick={handlePrevDay}>
                <ChevronLeft />
              </IconButton>
              <DatePicker
                value={currentDate}
                onChange={(newDate) => {
                  if (newDate) {
                    const dateStr = newDate.toISOString().split('T')[0];
                    navigate(`/day-in-life/${dateStr}`);
                  }
                }}
                slotProps={{
                  textField: {
                    size: 'small'
                  }
                }}
              />
              <IconButton onClick={handleNextDay}>
                <ChevronRight />
              </IconButton>
            </Box>
          </Box>

        {/* Properties */}
        <Grid container spacing={2} sx={{ mb: 4 }}>
          {/* Weather */}
          {dayData.properties && dayData.properties.weather && (
            <Grid item>
              <PropertyTile
                icon={dayData.properties.weather.icon}
                label="Weather"
                value={`${dayData.properties.weather.temp}°C`}
                sublabel={dayData.properties.weather.country}
              />
            </Grid>
          )}

          {/* Sleep */}
          <Grid item>
            <PropertyTile
              icon="💤"
              label="Sleep"
              value={dayData.properties && dayData.properties.sleep
                ? formatSleepDuration(dayData.properties.sleep.duration)
                : 'No data'}
              sublabel={dayData.properties && dayData.properties.sleep && dayData.properties.sleep.score
                ? `Score: ${dayData.properties.sleep.score}`
                : null}
            />
          </Grid>

          {/* Steps */}
          <Grid item>
            <PropertyTile
              icon="👟"
              label="Steps"
              value={dayData.properties && dayData.properties.steps && dayData.properties.steps.count ? dayData.properties.steps.count.toLocaleString() : 'No data'}
            />
          </Grid>

          {/* Check-ins */}
          <Grid item>
            <PropertyTile
              icon="📍"
              label="Check-ins"
              value={dayData.properties && dayData.properties.checkins ? dayData.properties.checkins.count : 0}
            />
          </Grid>

          {/* Activities */}
          <Grid item>
            <PropertyTile
              icon="🏃"
              label="Activities"
              value={dayData.properties && dayData.properties.activities ? dayData.properties.activities.count : 0}
            />
          </Grid>

          {/* Heart Rate */}
          <Grid item>
            <PropertyTile
              icon="❤️"
              label="Heart Rate"
              value={dayData.properties && dayData.properties.heartRate
                ? `${dayData.properties.heartRate.min}-${dayData.properties.heartRate.max}`
                : 'No data'}
              sublabel="bpm"
            />
          </Grid>

          {/* Calories */}
          <Grid item>
            <PropertyTile
              icon="🔥"
              label="Calories"
              value={dayData.properties && dayData.properties.calories && dayData.properties.calories.total ? dayData.properties.calories.total : 'No data'}
            />
          </Grid>
        </Grid>

        {/* Events */}
        <Typography variant="h5" gutterBottom>
          Timeline
        </Typography>
        {dayData.events && dayData.events.length === 0 ? (
          <Typography color="text.secondary">
            No activities for this day
          </Typography>
        ) : (
          dayData.events && dayData.events.map((event, idx) => (
            <Box key={idx}>
              {event.type === 'checkin_group' && (
                <CheckinEventTile
                  event={event}
                  onPhotoClick={handlePhotoClick}
                  authToken={token}
                />
              )}
              {(event.type.includes('activity')) && (
                <ActivityEventTile event={event} />
              )}
            </Box>
          ))
        )}

        {/* Photo Lightbox */}
        <Lightbox
          open={lightboxOpen}
          close={() => setLightboxOpen(false)}
          slides={lightboxPhotos}
        />
      </Box>
    </Layout>
  </LocalizationProvider>
  );
};

export default DayInLifePage;
