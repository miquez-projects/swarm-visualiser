import React, { useRef, useEffect, useState } from 'react';
import { Map, Marker, Popup } from 'react-map-gl/mapbox';
import { Box, Typography, Chip, CircularProgress } from '@mui/material';
import { Room } from '@mui/icons-material';
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
  const [selectedCheckin, setSelectedCheckin] = useState(null);
  const [viewState, setViewState] = useState({
    longitude: 0,
    latitude: 20,
    zoom: 1.5
  });

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

      <Map
        ref={mapRef}
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        mapboxAccessToken={MAPBOX_TOKEN}
        style={{ width: '100%', height: '100%' }}
      >
        {checkins && checkins.map((checkin) => {
          if (!checkin.latitude || !checkin.longitude) return null;

          return (
            <Marker
              key={checkin.id}
              longitude={checkin.longitude}
              latitude={checkin.latitude}
              onClick={e => {
                e.originalEvent.stopPropagation();
                setSelectedCheckin(checkin);
              }}
            >
              <Room
                sx={{
                  color: getMarkerColor(checkin.venue_category),
                  cursor: 'pointer',
                  fontSize: 32,
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
                  '&:hover': {
                    transform: 'scale(1.2)',
                    transition: 'transform 0.2s'
                  }
                }}
              />
            </Marker>
          );
        })}

        {selectedCheckin && (
          <Popup
            longitude={selectedCheckin.longitude}
            latitude={selectedCheckin.latitude}
            anchor="bottom"
            onClose={() => setSelectedCheckin(null)}
            closeOnClick={false}
          >
            <Box sx={{ p: 1, minWidth: 200 }}>
              <Typography variant="subtitle1" fontWeight="bold">
                {selectedCheckin.venue_name}
              </Typography>
              <Chip
                label={selectedCheckin.venue_category}
                size="small"
                sx={{
                  mt: 1,
                  mb: 1,
                  bgcolor: getMarkerColor(selectedCheckin.venue_category),
                  color: 'white'
                }}
              />
              <Typography variant="body2" color="text.secondary">
                {selectedCheckin.city}, {selectedCheckin.country}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {new Date(selectedCheckin.checkin_date).toLocaleDateString()}
              </Typography>
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
    </Box>
  );
}

export default MapView;
