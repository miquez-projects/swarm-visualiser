import React from 'react';
import { Paper, Typography, Box, Link } from '@mui/material';
import { Map as MapIcon, Photo } from '@mui/icons-material';

const CheckinEventTile = ({ event, onPhotoClick, authToken }) => {
  return (
    <Paper sx={{ p: 3, mb: 2 }}>
      <Typography variant="h6" gutterBottom>
        CHECK-INS
      </Typography>

      {/* Static Map */}
      {event.staticMapUrl && (
        <Box sx={{ position: 'relative', mb: 2 }}>
          <img
            src={event.staticMapUrl}
            alt="Check-in map"
            style={{ width: '100%', borderRadius: 8 }}
          />
          <Link
            href={`/?token=${authToken}`}
            target="_blank"
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              bgcolor: 'background.paper',
              p: 1,
              borderRadius: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 0.5
            }}
          >
            <MapIcon fontSize="small" /> Jump to main map
          </Link>
        </Box>
      )}

      {/* Timeline */}
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Timeline:
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'stretch' }}>
          {event.checkins.map((checkin, idx) => (
            <Box key={idx} sx={{ flex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column' }}>
              <Typography variant="caption" display="block">
                {new Date(checkin.checkin_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Typography>
              <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: 'primary.main', mx: 'auto', my: 1 }} />
              <Typography variant="caption" display="block" sx={{ mb: 0.5 }}>
                {checkin.venue_name}
              </Typography>
              <Box sx={{ minHeight: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {checkin.photos && checkin.photos.length > 0 && (
                  <Box
                    onClick={() => onPhotoClick(checkin.photos)}
                    sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}
                  >
                    <Photo fontSize="small" />
                    <Typography variant="caption">
                      {checkin.photos.length} {checkin.photos.length === 1 ? 'photo' : 'photos'}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    </Paper>
  );
};

export default CheckinEventTile;
