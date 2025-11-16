import React from 'react';
import { Paper, Typography, Box, Link } from '@mui/material';
import { OpenInNew } from '@mui/icons-material';

const ActivityEventTile = ({ event }) => {
  const { activity, staticMapUrl } = event;
  const isMapped = event.type.includes('mapped');

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
            style={{ width: '100%', borderRadius: 8 }}
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
              <OpenInNew fontSize="small" /> View Details
            </Link>
          )}
        </Box>
      )}

      {/* Stats */}
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        {isMapped && activity.distance && (
          <Typography variant="body1">
            {formatDistance(activity.distance)}
          </Typography>
        )}
        {activity.duration && (
          <>
            <Typography variant="body1">•</Typography>
            <Typography variant="body1">
              {formatDuration(activity.duration)}
            </Typography>
          </>
        )}
        {activity.calories && (
          <>
            <Typography variant="body1">•</Typography>
            <Typography variant="body1">
              {activity.calories} cal
            </Typography>
          </>
        )}
      </Box>
    </Paper>
  );
};

export default ActivityEventTile;
