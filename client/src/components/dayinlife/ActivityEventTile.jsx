import React from 'react';
import { Paper, Typography, Box, Link } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { ArrowSquareOut } from '@phosphor-icons/react';
import { overlayColors } from '../../theme';

const ActivityEventTile = ({ event, onPhotoClick }) => {
  const theme = useTheme();
  const { activity, staticMapUrl } = event;
  const isMapped = event.type.includes('_mapped') && !event.type.includes('unmapped');

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

      {/* Static Map (if mapped activity) */}
      {isMapped && staticMapUrl && (
        <Box sx={{ position: 'relative', mb: 2 }}>
          <img
            src={staticMapUrl}
            alt="Activity map"
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

      {/* Stats */}
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        {isMapped && activity.distance && (
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

      {/* Activity Photos */}
      {activity.photos && activity.photos.length > 0 && (
        <Box sx={{ mt: 3, pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Box sx={{ flex: 1, maxWidth: 200, textAlign: 'center' }}>
              <Box
                onClick={() => onPhotoClick && onPhotoClick(activity.photos)}
                sx={{
                  width: '100%',
                  height: 100,
                  borderRadius: 1,
                  overflow: 'hidden',
                  cursor: onPhotoClick ? 'pointer' : 'default',
                  position: 'relative',
                  border: '2px solid',
                  borderColor: 'primary.main',
                  '&:hover': onPhotoClick ? {
                    opacity: 0.8
                  } : {}
                }}
              >
                <img
                  src={activity.photos[0].photo_url}
                  alt="Activity snapshot"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                />
                {activity.photos.length > 1 && (
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
                    +{activity.photos.length - 1}
                  </Box>
                )}
              </Box>
              <Typography variant="caption" display="block" sx={{ mt: 0.5, fontWeight: 500 }}>
                Activity
              </Typography>
            </Box>
          </Box>
        </Box>
      )}
    </Paper>
  );
};

export default ActivityEventTile;
