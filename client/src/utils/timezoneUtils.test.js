import {
  formatInLocalTimeZone,
  formatTimeInLocalZone,
  formatDateInLocalZone,
  formatDateTimeInLocalZone
} from './timezoneUtils';

describe('timezoneUtils', () => {
  const testDate = '2024-06-15T12:00:00Z';

  describe('formatInLocalTimeZone', () => {
    it('formats date in specified timezone', () => {
      const result = formatInLocalTimeZone(testDate, 'America/New_York', 'HH:mm');
      expect(typeof result).toBe('string');
      expect(result).toMatch(/\d{2}:\d{2}/);
    });

    it('handles null timezone gracefully', () => {
      const result = formatInLocalTimeZone(testDate, null, 'HH:mm');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('returns empty string for null date', () => {
      expect(formatInLocalTimeZone(null, 'America/New_York')).toBe('');
    });

    it('formats datetime type', () => {
      const result = formatInLocalTimeZone(testDate, 'Asia/Tokyo', 'datetime');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('formats date type', () => {
      const result = formatInLocalTimeZone(testDate, 'Europe/London', 'date');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('wrapper functions', () => {
    it('formatTimeInLocalZone produces a string', () => {
      const result = formatTimeInLocalZone(testDate, 'America/New_York');
      expect(typeof result).toBe('string');
    });

    it('formatDateInLocalZone produces a string', () => {
      const result = formatDateInLocalZone(testDate, 'America/New_York');
      expect(typeof result).toBe('string');
    });

    it('formatDateTimeInLocalZone produces a string', () => {
      const result = formatDateTimeInLocalZone(testDate, 'America/New_York');
      expect(typeof result).toBe('string');
    });
  });
});
