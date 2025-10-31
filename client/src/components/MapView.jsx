import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Map, Marker, Popup } from 'react-map-gl/mapbox';
import { Box, Typography, Chip, CircularProgress, Modal, IconButton, Link } from '@mui/material';
import { Room, Close, CalendarMonth } from '@mui/icons-material';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;

// Category color mapping
const CATEGORY_COLORS = {
  'Restaurant': '#e74c3c',
  'Bar': '#9b59b6',
  'Café': '#f39c12',
  'Coffee Shop': '#d35400',
  'Museum': '#3498db',
  'Park': '#27ae60',
  'Hotel': '#16a085',
  'Shop': '#e67e22',
  'Unknown': '#95a5a6'
};

function MapView({ checkins, loading }) {
  const mapRef = useRef();
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [showCheckinGrid, setShowCheckinGrid] = useState(false);
  const [viewState, setViewState] = useState({
    longitude: 0,
    latitude: 20,
    zoom: 1.5
  });

  // Group check-ins by venue
  const venueGroups = useMemo(() => {
    if (!checkins) return [];

    const groups = {};
    checkins.forEach(checkin => {
      const key = checkin.venue_id || `${checkin.latitude},${checkin.longitude}`;
      if (!groups[key]) {
        groups[key] = {
          venue_id: checkin.venue_id,
          venue_name: checkin.venue_name,
          venue_category: checkin.venue_category,
          latitude: checkin.latitude,
          longitude: checkin.longitude,
          city: checkin.city,
          country: checkin.country,
          checkins: []
        };
      }
      groups[key].checkins.push(checkin);
    });

    return Object.values(groups);
  }, [checkins]);

  // Fit map to show all checkins when data changes
  useEffect(() => {
    if (!mapRef.current || !checkins || checkins.length === 0) return;

    const validCheckins = checkins.filter(c => c.latitude && c.longitude);
    if (validCheckins.length === 0) return;

    // Calculate bounds
    const lngs = validCheckins.map(c => c.longitude);
    const lats = validCheckins.map(c => c.latitude);

    const bounds = [
      [Math.min(...lngs), Math.min(...lats)], // Southwest
      [Math.max(...lngs), Math.max(...lats)]  // Northeast
    ];

    mapRef.current.fitBounds(bounds, {
      padding: 40,
      maxZoom: 12,
      duration: 1000
    });
  }, [checkins]);

  const getMarkerColor = (category) => {
    return CATEGORY_COLORS[category] || CATEGORY_COLORS['Unknown'];
  };

  if (!MAPBOX_TOKEN) {
    return (
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.default'
        }}
      >
        <Typography color="error">
          Mapbox token not configured. Please set REACT_APP_MAPBOX_TOKEN in .env
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ position: 'relative', height: '100%', width: '100%' }}>
      {loading && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'rgba(0,0,0,0.1)',
            zIndex: 1000
          }}
        >
          <CircularProgress />
        </Box>
      )}

      {!loading && checkins.length === 0 && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            bgcolor: 'background.paper',
            p: 3,
            borderRadius: 2,
            boxShadow: 3,
            zIndex: 1000,
            textAlign: 'center'
          }}
        >
          <Typography variant="h6" gutterBottom>
            No check-ins found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Import your Swarm data to get started:
          </Typography>
          <Typography variant="body2" color="text.secondary" fontFamily="monospace" sx={{ mt: 1 }}>
            npm run import -- /path/to/swarm-export.json
          </Typography>
        </Box>
      )}

      <Map
        ref={mapRef}
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        mapboxAccessToken={MAPBOX_TOKEN}
        style={{ width: '100%', height: '100%' }}
      >
        {venueGroups && venueGroups.map((venue, index) => {
          if (!venue.latitude || !venue.longitude) return null;

          const sortedCheckins = [...venue.checkins].sort((a, b) =>
            new Date(a.checkin_date) - new Date(b.checkin_date)
          );
          const firstVisit = sortedCheckins[0];
          const lastVisit = sortedCheckins[sortedCheckins.length - 1];

          return (
            <Marker
              key={venue.venue_id || index}
              longitude={venue.longitude}
              latitude={venue.latitude}
              onClick={e => {
                e.originalEvent.stopPropagation();
                setSelectedVenue(venue);
              }}
            >
              <Box sx={{ position: 'relative' }}>
                <Room
                  sx={{
                    color: getMarkerColor(venue.venue_category),
                    cursor: 'pointer',
                    fontSize: 32,
                    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
                    '&:hover': {
                      transform: 'scale(1.2)',
                      transition: 'transform 0.2s'
                    }
                  }}
                />
                {venue.checkins.length > 1 && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: -2,
                      right: -2,
                      bgcolor: 'white',
                      borderRadius: '50%',
                      width: 18,
                      height: 18,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      fontWeight: 'bold',
                      border: '1px solid #ccc'
                    }}
                  >
                    {venue.checkins.length}
                  </Box>
                )}
              </Box>
            </Marker>
          );
        })}

        {selectedVenue && (
          <Popup
            longitude={selectedVenue.longitude}
            latitude={selectedVenue.latitude}
            anchor="bottom"
            onClose={() => setSelectedVenue(null)}
            closeOnClick={false}
          >
            <Box sx={{ p: 1, minWidth: 220 }}>
              <Typography variant="subtitle1" fontWeight="bold">
                {selectedVenue.venue_name}
              </Typography>
              <Chip
                label={selectedVenue.venue_category}
                size="small"
                sx={{
                  mt: 1,
                  mb: 1,
                  bgcolor: getMarkerColor(selectedVenue.venue_category),
                  color: 'white'
                }}
              />
              <Typography variant="body2" color="text.secondary">
                {selectedVenue.city}, {selectedVenue.country}
              </Typography>
              <Box sx={{ mt: 1.5, mb: 1 }}>
                <Typography variant="body2" fontWeight="bold">
                  Visited {selectedVenue.checkins.length} {selectedVenue.checkins.length === 1 ? 'time' : 'times'}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  First: {new Date(selectedVenue.checkins.sort((a,b) => new Date(a.checkin_date) - new Date(b.checkin_date))[0].checkin_date).toLocaleDateString()}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  Last: {new Date(selectedVenue.checkins.sort((a,b) => new Date(b.checkin_date) - new Date(a.checkin_date))[0].checkin_date).toLocaleDateString()}
                </Typography>
              </Box>
              <Link
                component="button"
                variant="caption"
                onClick={() => {
                  setShowCheckinGrid(true);
                }}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  cursor: 'pointer',
                  mt: 1
                }}
              >
                <CalendarMonth fontSize="small" />
                View all check-in dates
              </Link>
            </Box>
          </Popup>
        )}
      </Map>

      {/* Legend */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          bgcolor: 'background.paper',
          p: 2,
          borderRadius: 1,
          boxShadow: 2,
          maxHeight: '30vh',
          overflowY: 'auto'
        }}
      >
        <Typography variant="caption" fontWeight="bold" display="block" mb={1}>
          Categories
        </Typography>
        {Object.entries(CATEGORY_COLORS).map(([category, color]) => (
          <Box key={category} sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
            <Room sx={{ color, fontSize: 16, mr: 1 }} />
            <Typography variant="caption">{category}</Typography>
          </Box>
        ))}
      </Box>

      {/* Check-in Grid Modal */}
      <Modal
        open={showCheckinGrid && selectedVenue !== null}
        onClose={() => setShowCheckinGrid(false)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Box
          sx={{
            bgcolor: 'background.paper',
            borderRadius: 2,
            boxShadow: 24,
            p: 4,
            maxWidth: '90vw',
            maxHeight: '90vh',
            overflow: 'auto',
            position: 'relative'
          }}
        >
          <IconButton
            onClick={() => setShowCheckinGrid(false)}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8
            }}
          >
            <Close />
          </IconButton>

          {selectedVenue && (
            <>
              <Typography variant="h5" fontWeight="bold" gutterBottom>
                {selectedVenue.venue_name}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {selectedVenue.checkins.length} check-ins
              </Typography>

              <CheckinContributionGrid checkins={selectedVenue.checkins} />
            </>
          )}
        </Box>
      </Modal>
    </Box>
  );
}

// GitHub-style contribution grid component
function CheckinContributionGrid({ checkins }) {
  // Group check-ins by date
  const checkinsByDate = useMemo(() => {
    const groups = {};
    checkins.forEach(checkin => {
      const date = new Date(checkin.checkin_date).toISOString().split('T')[0];
      groups[date] = (groups[date] || 0) + 1;
    });
    return groups;
  }, [checkins]);

  // Calculate date range for the grid (last 12 months)
  const today = new Date();
  const oneYearAgo = new Date(today);
  oneYearAgo.setMonth(today.getMonth() - 12);

  // Generate all weeks for the grid
  const weeks = useMemo(() => {
    const result = [];
    const current = new Date(oneYearAgo);

    // Start from Sunday of the week
    current.setDate(current.getDate() - current.getDay());

    while (current <= today) {
      const week = [];
      for (let i = 0; i < 7; i++) {
        const dateStr = current.toISOString().split('T')[0];
        const count = checkinsByDate[dateStr] || 0;
        week.push({
          date: dateStr,
          count: count,
          day: i
        });
        current.setDate(current.getDate() + 1);
      }
      result.push(week);
    }
    return result;
  }, [oneYearAgo, today, checkinsByDate]);

  // Get color intensity based on check-in count
  const getColor = (count) => {
    if (count === 0) return '#ebedf0';
    if (count === 1) return '#9be9a8';
    if (count === 2) return '#40c463';
    if (count <= 4) return '#30a14e';
    return '#216e39';
  };

  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <Box sx={{ mt: 3, overflowX: 'auto' }}>
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        {/* Day labels */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, pt: 2.5 }}>
          {dayLabels.map((day, i) => (
            i % 2 === 1 ? (
              <Typography
                key={day}
                variant="caption"
                sx={{
                  height: 10,
                  fontSize: 9,
                  color: 'text.secondary',
                  lineHeight: '10px'
                }}
              >
                {day}
              </Typography>
            ) : (
              <Box key={day} sx={{ height: 10 }} />
            )
          ))}
        </Box>

        {/* Contribution grid */}
        <Box>
          {/* Month labels */}
          <Box sx={{ display: 'flex', mb: 0.5, pl: 0.5 }}>
            {weeks.map((week, weekIndex) => {
              const firstDay = new Date(week[0].date);
              const showLabel = firstDay.getDate() <= 7 || weekIndex === 0;
              return (
                <Box
                  key={weekIndex}
                  sx={{
                    width: 10,
                    height: 15,
                    mr: 0.5,
                    fontSize: 9
                  }}
                >
                  {showLabel && (
                    <Typography variant="caption" sx={{ fontSize: 9, color: 'text.secondary' }}>
                      {monthLabels[firstDay.getMonth()]}
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Box>

          {/* Grid cells */}
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {weeks.map((week, weekIndex) => (
              <Box key={weekIndex} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {week.map((day) => (
                  <Box
                    key={day.date}
                    title={`${day.date}: ${day.count} check-in${day.count !== 1 ? 's' : ''}`}
                    sx={{
                      width: 10,
                      height: 10,
                      bgcolor: getColor(day.count),
                      borderRadius: 0.5,
                      cursor: day.count > 0 ? 'pointer' : 'default',
                      '&:hover': day.count > 0 ? {
                        outline: '2px solid rgba(0,0,0,0.3)',
                        outlineOffset: 1
                      } : {}
                    }}
                  />
                ))}
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      {/* Legend */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2, fontSize: 11 }}>
        <Typography variant="caption" color="text.secondary">Less</Typography>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {[0, 1, 2, 3, 5].map(count => (
            <Box
              key={count}
              sx={{
                width: 10,
                height: 10,
                bgcolor: getColor(count),
                borderRadius: 0.5
              }}
            />
          ))}
        </Box>
        <Typography variant="caption" color="text.secondary">More</Typography>
      </Box>
    </Box>
  );
}

export default MapView;
