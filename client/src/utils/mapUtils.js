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

/**
 * Group checkins by week (ISO week, starting Monday).
 * Returns an object mapping week-start date strings to checkin counts.
 */
export function groupCheckinsByWeek(checkins) {
  const groups = {};
  checkins.forEach(checkin => {
    const date = new Date(checkin.checkin_date);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date);
    monday.setDate(diff);
    const weekKey = monday.toISOString().split('T')[0];
    groups[weekKey] = (groups[weekKey] || 0) + 1;
  });
  return groups;
}

/**
 * Generate a weeks grid organized by year and month for a contribution-style display.
 * @param {Object} checkinsByWeek - Map of week-start date strings to counts
 * @param {Date} earliestDate - Start date (should be a Monday)
 * @param {Date} latestDate - End date
 * @returns {Array} Array of year objects containing months with week data
 */
export function generateWeeksGrid(checkinsByWeek, earliestDate, latestDate) {
  const result = [];
  const current = new Date(earliestDate);

  while (current <= latestDate) {
    const year = current.getFullYear();
    const month = current.getMonth();
    const weekKey = current.toISOString().split('T')[0];
    const count = checkinsByWeek[weekKey] || 0;

    let yearObj = result.find(y => y.year === year);
    if (!yearObj) {
      yearObj = { year, months: [] };
      result.push(yearObj);
    }

    let monthObj = yearObj.months.find(m => m.month === month);
    if (!monthObj) {
      monthObj = { month, weeks: [] };
      yearObj.months.push(monthObj);
    }

    monthObj.weeks.push({
      weekStart: weekKey,
      count: count
    });

    current.setDate(current.getDate() + 7);
  }

  return result;
}
