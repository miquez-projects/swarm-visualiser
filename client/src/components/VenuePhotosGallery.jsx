import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Typography,
  Grid,
  CircularProgress,
  Card,
  CardMedia
} from '@mui/material';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';
import { getVenuePhotos } from '../services/api';

function VenuePhotosGallery({ venueId, token }) {
  const [photoGroups, setPhotoGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    if (!venueId || !token) {
      setLoading(false);
      return;
    }

    async function fetchPhotos() {
      try {
        setLoading(true);
        setError(null);
        const data = await getVenuePhotos(venueId, token);
        setPhotoGroups(data);
      } catch (err) {
        console.error('Failed to fetch venue photos:', err);
        setError('Failed to load photos');
      } finally {
        setLoading(false);
      }
    }

    fetchPhotos();
  }, [venueId, token]);

  // Flatten all photos for lightbox
  const allPhotos = photoGroups.flatMap(group =>
    group.photos.map(photo => ({
      src: photo.url,
      width: photo.width || 800,
      height: photo.height || 600
    }))
  );

  const handlePhotoClick = (groupIndex, photoIndex) => {
    // Calculate the global index
    let globalIndex = 0;
    for (let i = 0; i < groupIndex; i++) {
      globalIndex += photoGroups[i].photos.length;
    }
    globalIndex += photoIndex;

    setLightboxIndex(globalIndex);
    setLightboxOpen(true);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  if (photoGroups.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">
          No photos available for this venue
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      {photoGroups.map((group, groupIndex) => (
        <Box key={groupIndex} sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            {new Date(group.date).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </Typography>

          <Grid container spacing={2}>
            {group.photos.map((photo, photoIndex) => (
              <Grid item xs={6} sm={4} md={3} key={photo.id}>
                <Card
                  sx={{
                    cursor: 'pointer',
                    transition: 'transform 0.2s',
                    '&:hover': {
                      transform: 'scale(1.05)'
                    }
                  }}
                  onClick={() => handlePhotoClick(groupIndex, photoIndex)}
                >
                  <CardMedia
                    component="img"
                    image={photo.url}
                    alt={`Photo from ${new Date(group.date).toLocaleDateString()}`}
                    sx={{
                      height: 150,
                      objectFit: 'cover'
                    }}
                  />
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      ))}

      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        index={lightboxIndex}
        slides={allPhotos}
      />
    </Box>
  );
}

VenuePhotosGallery.propTypes = {
  venueId: PropTypes.string.isRequired,
  token: PropTypes.string.isRequired
};

export default VenuePhotosGallery;
