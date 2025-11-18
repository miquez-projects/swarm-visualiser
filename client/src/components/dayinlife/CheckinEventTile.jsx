import React from 'react';
import { Paper, Typography, Box, Link } from '@mui/material';
import { Map as MapIcon } from '@mui/icons-material';
import { formatTimeInLocalZone } from '../../utils/timezoneUtils';

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
                {formatTimeInLocalZone(checkin.checkin_date, checkin.timezone)}
              </Typography>
              <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: 'primary.main', mx: 'auto', my: 1 }} />
              <Typography variant="caption" display="block" sx={{ mb: 1 }}>
                {checkin.venue_name}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Photo Grid */}
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Photos:
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
            {event.checkins.map((checkin, idx) => (
              <Box key={idx} sx={{ flex: 1, textAlign: 'center' }}>
                {checkin.photos && checkin.photos.length > 0 ? (
                  <Box
                    onClick={() => onPhotoClick(checkin.photos)}
                    sx={{
                      width: '100%',
                      height: 80,
                      borderRadius: 1,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      position: 'relative',
                      border: '1px solid',
                      borderColor: 'divider',
                      '&:hover': {
                        opacity: 0.8
                      }
                    }}
                  >
                    <img
                      src={checkin.photos[0].photo_url_cached || checkin.photos[0].photo_url}
                      alt="Check-in photo"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                    />
                    {checkin.photos.length > 1 && (
                      <Box
                        sx={{
                          position: 'absolute',
                          bottom: 4,
                          right: 4,
                          bgcolor: 'rgba(0, 0, 0, 0.7)',
                          color: 'white',
                          px: 1,
                          py: 0.5,
                          borderRadius: 0.5,
                          fontSize: '0.75rem'
                        }}
                      >
                        +{checkin.photos.length - 1}
                      </Box>
                    )}
                  </Box>
                ) : (
                  <Box
                    sx={{
                      width: '100%',
                      height: 80,
                      borderRadius: 1,
                      border: '1px dashed',
                      borderColor: 'divider',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'text.disabled'
                    }}
                  >
                    <Typography variant="caption">No photos</Typography>
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Paper>
  );
};

export default CheckinEventTile;
