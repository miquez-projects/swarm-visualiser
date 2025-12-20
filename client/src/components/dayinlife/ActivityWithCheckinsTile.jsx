import React from 'react';
import { Paper, Typography, Box, Link } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { ArrowSquareOut } from '@phosphor-icons/react';
import { formatTimeInLocalZone } from '../../utils/timezoneUtils';
import { overlayColors } from '../../theme';

const ActivityWithCheckinsTile = ({ event, onPhotoClick }) => {
  const theme = useTheme();
  const { activity, checkins, staticMapUrl } = event;

  const formatDuration = (seconds) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDistance = (meters) => {
    if (!meters) return 'N/A';
    return (meters / 1000).toFixed(1) + ' km';
  };

  return (
    <Paper sx={{ p: 3, mb: 2 }}>
      <Typography variant="h6" gutterBottom>
        {activity.type?.toUpperCase() || 'ACTIVITY'}
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" gutterBottom>
        {activity.name}
      </Typography>

      {/* Static Map with Activity Tracklog + Check-in Markers */}
      {staticMapUrl && (
        <Box sx={{ position: 'relative', mb: 2 }}>
          <img
            src={staticMapUrl}
            alt="Activity map with check-ins"
            style={{ width: '100%', borderRadius: theme.shape.borderRadius }}
          />
          {activity.url && (
            <Link
              href={activity.url}
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
              <ArrowSquareOut size={16} /> View Details
            </Link>
          )}
        </Box>
      )}

      {/* Activity Stats */}
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 3 }}>
        {activity.distance && (
          <Typography
            variant="body1"
            sx={{ fontFamily: theme.typography.fontFamilyMono }}
          >
            {formatDistance(activity.distance)}
          </Typography>
        )}
        {activity.duration && (
          <>
            <Typography variant="body1">•</Typography>
            <Typography
              variant="body1"
              sx={{ fontFamily: theme.typography.fontFamilyMono }}
            >
              {formatDuration(activity.duration)}
            </Typography>
          </>
        )}
        {activity.calories && (
          <>
            <Typography variant="body1">•</Typography>
            <Typography
              variant="body1"
              sx={{ fontFamily: theme.typography.fontFamilyMono }}
            >
              {activity.calories} cal
            </Typography>
          </>
        )}
      </Box>

      {/* Check-in Timeline */}
      <Box sx={{ mt: 3, pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
        <Typography variant="subtitle2" gutterBottom>
          Check-ins during activity:
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'stretch' }}>
          {checkins.map((checkin, idx) => (
            <Box key={idx} sx={{ flex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column' }}>
              <Typography
                variant="caption"
                display="block"
                sx={{ fontFamily: theme.typography.fontFamilyMono }}
              >
                {formatTimeInLocalZone(checkin.checkin_date, checkin.timezone)}
              </Typography>
              <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: 'secondary.main', mx: 'auto', my: 1 }} />
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
            {checkins.map((checkin, idx) => (
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
                          bgcolor: overlayColors.strong,
                          color: 'text.primary',
                          px: 1,
                          py: 0.5,
                          borderRadius: 0.5,
                          fontSize: '0.75rem',
                          fontFamily: theme.typography.fontFamilyMono
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

export default ActivityWithCheckinsTile;
