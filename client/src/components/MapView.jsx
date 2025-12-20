import React, { useEffect, useState, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Map, Source, Layer, Popup } from 'react-map-gl/mapbox';
import { Box, Typography, Chip, CircularProgress, Modal, IconButton, Link, Tabs, Tab, useTheme } from '@mui/material';
import { MapPin, X, CalendarBlank } from '@phosphor-icons/react';
import 'mapbox-gl/dist/mapbox-gl.css';
import VenuePhotosGallery from './VenuePhotosGallery';
import { formatDateInLocalZone } from '../utils/timezoneUtils';
import { CATEGORY_COLORS, getContributionColor, mapColors, overlayColors } from '../theme';

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;

function MapView({ checkins, loading, viewportLoading, mapRef, onViewportChange, token }) {
  const theme = useTheme();
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [showCheckinGrid, setShowCheckinGrid] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [viewState, setViewState] = useState({
    longitude: 0,
    latitude: 20,
    zoom: 1.5
  });
  const [isInitialLoad, setIsInitialLoad] = useState(true);

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

  // Convert venue groups to GeoJSON for clustering
  const checkinsGeoJSON = useMemo(() => ({
    type: "FeatureCollection",
    features: venueGroups.map(venue => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [venue.longitude, venue.latitude]
      },
      properties: {
        venueId: venue.venue_id,
        venueName: venue.venue_name,
        checkinCount: venue.checkins.length,
        category: venue.venue_category,
        city: venue.city,
        country: venue.country
      }
    }))
  }), [venueGroups]);

  // Fit map to show all checkins on initial load only
  useEffect(() => {
    if (!mapRef.current || !checkins || checkins.length === 0) return;
    if (!isInitialLoad) return; // Only auto-fit on initial load

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

    // Mark initial load as complete
    setIsInitialLoad(false);
  }, [checkins, isInitialLoad, mapRef]);

  const getMarkerColor = (category) => {
    return CATEGORY_COLORS[category] || CATEGORY_COLORS['Unknown'];
  };

  // Handle clicks on unclustered points (individual venues)
  const handlePointClick = useCallback((event) => {
    const feature = event.features?.[0];
    if (!feature) return;

    const { venueId } = feature.properties;
    const [longitude, latitude] = feature.geometry.coordinates;

    // Find full venue data
    const venue = venueGroups.find(v => v.venue_id === venueId);
    if (venue) {
      setSelectedVenue({
        ...venue,
        latitude,
        longitude
      });
    }
  }, [venueGroups]);

  // Handle clicks on clusters (zoom in)
  const handleClusterClick = useCallback((event) => {
    const feature = event.features?.[0];
    if (!feature) return;

    const clusterId = feature.properties.cluster_id;
    const mapboxSource = mapRef.current?.getSource('checkins');

    mapboxSource?.getClusterExpansionZoom(clusterId, (err, zoom) => {
      if (err) return;

      mapRef.current?.easeTo({
        center: feature.geometry.coordinates,
        zoom,
        duration: 500
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mapRef is stable (ref), no need to include

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
            bgcolor: overlayColors.dim,
            zIndex: 1000
          }}
        >
          <CircularProgress />
        </Box>
      )}

      {viewportLoading && (
        <Box
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            bgcolor: 'background.paper',
            px: 2,
            py: 1,
            borderRadius: 1,
            boxShadow: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            zIndex: 1000
          }}
        >
          <CircularProgress size={16} />
          <Typography variant="body2">Loading venues...</Typography>
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
          <Typography variant="body2" color="text.secondary" sx={{ fontFamily: theme.typography.fontFamilyMono, mt: 1 }}>
            npm run import -- /path/to/swarm-export.json
          </Typography>
        </Box>
      )}

      <Map
        ref={mapRef}
        {...viewState}
        onMove={(evt) => {
          setViewState(evt.viewState);
          onViewportChange?.(evt.viewState);
        }}
        onClick={(e) => {
          const features = e.features;
          if (!features || features.length === 0) return;

          const feature = features[0];
          if (feature.layer.id === 'clusters') {
            handleClusterClick(e);
          } else if (feature.layer.id === 'unclustered-point') {
            handlePointClick(e);
          }
        }}
        interactiveLayerIds={['clusters', 'unclustered-point']}
        cursor="pointer"
        mapStyle="mapbox://styles/mapbox/dark-v11"
        mapboxAccessToken={MAPBOX_TOKEN}
        style={{ width: '100%', height: '100%' }}
      >
        {/* Clustering source */}
        <Source
          id="checkins"
          type="geojson"
          data={checkinsGeoJSON}
          cluster={true}
          clusterMaxZoom={6}
          clusterRadius={50}
        >
          {/* Cluster circles */}
          <Layer
            id="clusters"
            type="circle"
            filter={['has', 'point_count']}
            paint={{
              'circle-color': [
                'step',
                ['get', 'point_count'],
                mapColors.clusterLow,
                100,
                mapColors.clusterMedium,
                750,
                mapColors.clusterHigh
              ],
              'circle-radius': [
                'step',
                ['get', 'point_count'],
                20,
                100,
                30,
                750,
                40
              ]
            }}
          />

          {/* Cluster count labels */}
          <Layer
            id="cluster-count"
            type="symbol"
            filter={['has', 'point_count']}
            layout={{
              'text-field': '{point_count_abbreviated}',
              'text-size': 12,
              'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold']
            }}
            paint={{
              'text-color': mapColors.text
            }}
          />

          {/* Individual unclustered points */}
          <Layer
            id="unclustered-point"
            type="circle"
            filter={['!', ['has', 'point_count']]}
            paint={{
              'circle-color': [
                'match',
                ['get', 'category'],
                'Restaurant', CATEGORY_COLORS['Restaurant'],
                'Bar', CATEGORY_COLORS['Bar'],
                'Café', CATEGORY_COLORS['Café'],
                'Coffee Shop', CATEGORY_COLORS['Coffee Shop'],
                'Museum', CATEGORY_COLORS['Museum'],
                'Park', CATEGORY_COLORS['Park'],
                'Hotel', CATEGORY_COLORS['Hotel'],
                'Shop', CATEGORY_COLORS['Shop'],
                CATEGORY_COLORS['Unknown'] // default
              ],
              'circle-radius': 8,
              'circle-stroke-width': 2,
              'circle-stroke-color': mapColors.stroke
            }}
          />
        </Source>

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
                  First: {(() => {
                    const firstCheckin = selectedVenue.checkins.sort((a,b) => new Date(a.checkin_date) - new Date(b.checkin_date))[0];
                    return formatDateInLocalZone(firstCheckin.checkin_date, firstCheckin.timezone);
                  })()}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  Last: {(() => {
                    const lastCheckin = selectedVenue.checkins.sort((a,b) => new Date(b.checkin_date) - new Date(a.checkin_date))[0];
                    return formatDateInLocalZone(lastCheckin.checkin_date, lastCheckin.timezone);
                  })()}
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
                <CalendarBlank size={16} style={{ marginRight: 4 }} />
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
            <MapPin size={16} color={color} style={{ marginRight: 8 }} />
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
            width: '95vw',
            maxWidth: 1400,
            height: '90vh',
            overflow: 'hidden',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Sticky header with close button */}
          <Box
            sx={{
              position: 'sticky',
              top: 0,
              zIndex: 10,
              bgcolor: 'background.paper',
              borderBottom: 1,
              borderColor: 'divider',
              p: 2,
              display: 'flex',
              justifyContent: 'flex-end'
            }}
          >
            <IconButton
              onClick={() => setShowCheckinGrid(false)}
              sx={{
                bgcolor: 'background.paper',
                boxShadow: 2,
                '&:hover': {
                  bgcolor: 'action.hover'
                }
              }}
            >
              <X size={24} />
            </IconButton>
          </Box>

          {/* Fixed content - venue name and tabs (doesn't scroll) */}
          {selectedVenue && (
            <Box sx={{ p: 4, pb: 0 }}>
              <Typography variant="h5" fontWeight="bold" gutterBottom>
                {selectedVenue.venue_name}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {selectedVenue.checkins.length} check-ins
              </Typography>

              <Tabs
                value={activeTab}
                onChange={(e, newValue) => setActiveTab(newValue)}
                sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
              >
                <Tab label="Check-ins" />
                <Tab label="Photos" />
              </Tabs>
            </Box>
          )}

          {/* Scrollable content - ONLY tab contents scroll */}
          <Box sx={{ flex: 1, overflow: 'auto', px: 4, pb: 4 }}>
            {selectedVenue && (
              <>
                {activeTab === 0 && (
                  <CheckinContributionGrid checkins={selectedVenue.checkins} />
                )}

                {activeTab === 1 && token && selectedVenue.venue_id && (
                  <VenuePhotosGallery
                    venueId={selectedVenue.venue_id}
                    token={token}
                  />
                )}

                {activeTab === 1 && !token && (
                  <Box sx={{ p: 3, textAlign: 'center' }}>
                    <Typography color="text.secondary">
                      Authentication required to view photos
                    </Typography>
                  </Box>
                )}
              </>
            )}
          </Box>
        </Box>
      </Modal>
    </Box>
  );
}

MapView.propTypes = {
  checkins: PropTypes.arrayOf(PropTypes.shape({
    venue_id: PropTypes.string,
    venue_name: PropTypes.string,
    venue_category: PropTypes.string,
    latitude: PropTypes.number,
    longitude: PropTypes.number,
    city: PropTypes.string,
    country: PropTypes.string,
    checkin_date: PropTypes.string
  })).isRequired,
  loading: PropTypes.bool.isRequired,
  viewportLoading: PropTypes.bool,
  mapRef: PropTypes.shape({
    current: PropTypes.any
  }).isRequired,
  onViewportChange: PropTypes.func,
  token: PropTypes.string
};

// GitHub-style contribution grid component - showing weeks instead of days
function CheckinContributionGrid({ checkins }) {
  // Group check-ins by week (using ISO week date format)
  const checkinsByWeek = useMemo(() => {
    const groups = {};
    checkins.forEach(checkin => {
      const date = new Date(checkin.checkin_date);
      // Get the Monday of the week this check-in belongs to
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
      const monday = new Date(date);
      monday.setDate(diff);
      const weekKey = monday.toISOString().split('T')[0];

      groups[weekKey] = (groups[weekKey] || 0) + 1;
    });
    return groups;
  }, [checkins]);

  // Calculate date range for the grid (entire history)
  const { startDate, endDate } = useMemo(() => {
    if (checkins.length === 0) {
      return { startDate: new Date(), endDate: new Date() };
    }

    const dates = checkins.map(c => new Date(c.checkin_date));
    const earliest = new Date(Math.min(...dates));
    const latest = new Date(Math.max(...dates));

    // Round to Monday of the week
    const startDay = earliest.getDay();
    const startDiff = earliest.getDate() - startDay + (startDay === 0 ? -6 : 1);
    earliest.setDate(startDiff);

    return { startDate: earliest, endDate: latest };
  }, [checkins]);

  // Generate all weeks for the grid, organized by year and month
  const yearsData = useMemo(() => {
    const result = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const year = current.getFullYear();
      const month = current.getMonth();
      const weekKey = current.toISOString().split('T')[0];
      const count = checkinsByWeek[weekKey] || 0;

      // Find or create year object
      let yearObj = result.find(y => y.year === year);
      if (!yearObj) {
        yearObj = { year, months: [] };
        result.push(yearObj);
      }

      // Find or create month object
      let monthObj = yearObj.months.find(m => m.month === month);
      if (!monthObj) {
        monthObj = { month, weeks: [] };
        yearObj.months.push(monthObj);
      }

      // Add week
      monthObj.weeks.push({
        weekStart: weekKey,
        count: count
      });

      // Move to next week
      current.setDate(current.getDate() + 7);
    }

    return result;
  }, [startDate, endDate, checkinsByWeek]);

  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <Box sx={{ mt: 3, overflowY: 'auto', maxHeight: 'calc(90vh - 200px)' }}>
      {yearsData.map((yearData) => (
        <Box key={yearData.year} sx={{ mb: 4 }}>
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
            {yearData.year}
          </Typography>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {yearData.months.map((monthData) => (
              <Box key={monthData.month} sx={{ minWidth: 120 }}>
                <Typography variant="caption" fontWeight="bold" display="block" sx={{ mb: 1, color: 'text.secondary' }}>
                  {monthLabels[monthData.month]}
                </Typography>

                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxWidth: 200 }}>
                  {monthData.weeks.map((week) => {
                    const weekDate = new Date(week.weekStart);
                    const weekEndDate = new Date(weekDate);
                    weekEndDate.setDate(weekDate.getDate() + 6);

                    return (
                      <Box
                        key={week.weekStart}
                        title={`Week of ${weekDate.toLocaleDateString()}: ${week.count} check-in${week.count !== 1 ? 's' : ''}`}
                        sx={{
                          width: 14,
                          height: 14,
                          bgcolor: getContributionColor(week.count),
                          borderRadius: 0.5,
                          cursor: week.count > 0 ? 'pointer' : 'default',
                          '&:hover': week.count > 0 ? {
                            outline: `2px solid ${overlayColors.borderStrong}`,
                            outlineOffset: 1,
                            transform: 'scale(1.1)'
                          } : {}
                        }}
                      />
                    );
                  })}
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      ))}

      {/* Legend */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <Typography variant="caption" color="text.secondary">Less</Typography>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {[0, 1, 3, 7, 12].map(count => (
            <Box
              key={count}
              title={`${count} check-ins`}
              sx={{
                width: 14,
                height: 14,
                bgcolor: getContributionColor(count),
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
