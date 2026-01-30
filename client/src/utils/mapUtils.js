import { CATEGORY_COLORS } from '../theme';

/**
 * Group checkins by venue, combining checkins at the same venue.
 */
export function groupCheckinsByVenue(checkins) {
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
}

/**
 * Convert venue groups to GeoJSON FeatureCollection for map clustering.
 */
export function toGeoJSON(venueGroups) {
  return {
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
  };
}

/**
 * Map a venue category to its marker color.
 */
export function getMarkerColor(category) {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS['Unknown'];
}
