import { formatInTimeZone } from 'date-fns-tz';

/**
 * Format a date/time in the timezone where it occurred
 * @param {string|Date} date - ISO date string or Date object
 * @param {string} timezone - IANA timezone (e.g., "America/Guatemala", "Asia/Tokyo")
 * @param {string} format - date-fns format string
 * @returns {string} Formatted date/time in local timezone
 */
export function formatInLocalTimeZone(date, timezone, format = 'HH:mm') {
  if (!date) return '';

  // If no timezone provided, fall back to browser's timezone
  if (!timezone) {
    const d = new Date(date);
    if (format === 'HH:mm') {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString();
  }

  try {
    return formatInTimeZone(date, timezone, format);
  } catch (error) {
    console.error('Error formatting date in timezone:', error);
    // Fallback to default formatting
    const d = new Date(date);
    if (format === 'HH:mm') {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString();
  }
}

/**
 * Format time only (HH:mm) in local timezone
 * @param {string|Date} date
 * @param {string} timezone
 * @returns {string}
 */
export function formatTimeInLocalZone(date, timezone) {
  return formatInLocalTimeZone(date, timezone, 'HH:mm');
}

/**
 * Format date only (MMM d, yyyy) in local timezone
 * @param {string|Date} date
 * @param {string} timezone
 * @returns {string}
 */
export function formatDateInLocalZone(date, timezone) {
  return formatInLocalTimeZone(date, timezone, 'MMM d, yyyy');
}

/**
 * Format full date and time in local timezone
 * @param {string|Date} date
 * @param {string} timezone
 * @returns {string}
 */
export function formatDateTimeInLocalZone(date, timezone) {
  return formatInLocalTimeZone(date, timezone, 'MMM d, yyyy HH:mm');
}
