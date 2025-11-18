/**
 * Format a date/time in the timezone where it occurred using native Intl API
 * @param {string|Date} date - ISO date string or Date object
 * @param {string} timezone - IANA timezone (e.g., "America/Guatemala", "Asia/Tokyo")
 * @param {string} format - Format type: 'HH:mm', 'date', or 'datetime'
 * @returns {string} Formatted date/time in local timezone
 */
export function formatInLocalTimeZone(date, timezone, format = 'HH:mm') {
  if (!date) return '';

  const d = new Date(date);

  // If no timezone provided, fall back to browser's timezone
  if (!timezone) {
    console.warn('[TIMEZONE] No timezone provided for date:', date);
    if (format === 'HH:mm') {
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    return d.toLocaleDateString();
  }

  try {
    // Use Intl.DateTimeFormat for reliable timezone conversion
    if (format === 'HH:mm') {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      const result = formatter.format(d);
      console.log('[TIMEZONE] Formatted', date, 'in', timezone, 'as', result);
      return result;
    } else if (format === 'datetime') {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      return formatter.format(d);
    } else {
      // Date only
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      return formatter.format(d);
    }
  } catch (error) {
    console.error('Error formatting date in timezone:', error, 'date:', date, 'timezone:', timezone);
    // Fallback to default formatting
    if (format === 'HH:mm') {
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
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
  return formatInLocalTimeZone(date, timezone, 'date');
}

/**
 * Format full date and time in local timezone
 * @param {string|Date} date
 * @param {string} timezone
 * @returns {string}
 */
export function formatDateTimeInLocalZone(date, timezone) {
  return formatInLocalTimeZone(date, timezone, 'datetime');
}
