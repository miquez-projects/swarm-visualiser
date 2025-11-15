import React from 'react';
import { Paper, Typography, Box } from '@mui/material';

const PropertyTile = ({ icon, label, value, sublabel }) => {
  return (
    <Paper sx={{
      p: 2,
      textAlign: 'center',
      minWidth: 140,
      height: 140,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center'
    }}>
      <Typography variant="h4">{icon}</Typography>
      <Typography variant="h6" sx={{ mt: 1 }}>
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
