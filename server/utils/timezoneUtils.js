const tzlookup = require('@photostructure/tz-lookup');

/**
 * Get IANA timezone identifier from latitude/longitude
 * @param {number} latitude
 * @param {number} longitude
 * @returns {string|null} Timezone identifier (e.g., "America/Guatemala", "Asia/Tokyo") or null if invalid coords
 */
function getTimezoneFromCoordinates(latitude, longitude) {
  if (!latitude || !longitude ||
      latitude < -90 || latitude > 90 ||
      longitude < -180 || longitude > 180) {
    return null;
  }

  try {
    const timezone = tzlookup(latitude, longitude);
    return timezone || null;
  } catch (error) {
    console.error(`[TIMEZONE] Error looking up timezone for ${latitude}, ${longitude}:`, error.message);
    return null;
  }
}

/**
 * Get timezone from PostGIS POINT geometry string
 * @param {string} pointString - "POINT(longitude latitude)"
 * @returns {string|null}
 */
function getTimezoneFromPoint(pointString) {
  if (!pointString) return null;

  try {
    // Extract coordinates from "POINT(lng lat)" format
    const match = pointString.match(/POINT\(([^ ]+) ([^ ]+)\)/);
    if (!match) return null;

    const longitude = parseFloat(match[1]);
    const latitude = parseFloat(match[2]);

    return getTimezoneFromCoordinates(latitude, longitude);
  } catch (error) {
    console.error(`[TIMEZONE] Error parsing point string: ${pointString}`, error.message);
    return null;
  }
}

module.exports = {
  getTimezoneFromCoordinates,
  getTimezoneFromPoint
};
