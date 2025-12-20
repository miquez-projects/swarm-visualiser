import React from 'react';
import { Paper, Typography, Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  CloudSun,
  Moon,
  Sneaker,
  MapPin,
  Activity,
  Heart,
  Flame,
  Clock,
} from '@phosphor-icons/react';

// Map of icon types to Phosphor components
const iconMap = {
  weather: CloudSun,
  sleep: Moon,
  steps: Sneaker,
  checkins: MapPin,
  activities: Activity,
  heartRate: Heart,
  calories: Flame,
  clock: Clock,
};

const PropertyTile = ({ icon, iconType, label, value, sublabel }) => {
  const theme = useTheme();
  const IconComponent = iconType ? iconMap[iconType] : null;

  return (
    <Paper sx={{
      p: 2,
      textAlign: 'center',
      minWidth: 140,
      height: 140,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      border: 1,
      borderColor: 'border.default',
    }}>
      {IconComponent ? (
        <Box sx={{ color: 'secondary.main', mb: 1, display: 'flex', justifyContent: 'center' }}>
          <IconComponent size={32} weight="regular" />
        </Box>
      ) : icon ? (
        <Typography variant="h4" sx={{ mb: 1 }}>{icon}</Typography>
      ) : null}
      <Typography
        sx={{
          fontFamily: theme.typography.fontFamilyMono,
          fontSize: '1.5rem',
          fontWeight: 500,
          color: 'text.primary',
          mb: 0.5,
        }}
      >
        {value || 'No data'}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Box sx={{ minHeight: 18 }}>
        {sublabel && (
          <Typography variant="caption" display="block" color="text.secondary">
            {sublabel}
          </Typography>
        )}
      </Box>
    </Paper>
  );
};

export default PropertyTile;
