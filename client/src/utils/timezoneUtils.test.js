import {
  formatInLocalTimeZone,
  formatTimeInLocalZone,
  formatDateInLocalZone,
  formatDateTimeInLocalZone
} from './timezoneUtils';

describe('timezoneUtils', () => {
  const testDate = '2024-06-15T12:00:00Z';

  describe('formatInLocalTimeZone', () => {
    it('formats time in America/New_York (UTC-4 in June)', () => {
      const result = formatInLocalTimeZone(testDate, 'America/New_York', 'HH:mm');
      expect(result).toBe('08:00');
    });

    it('formats time in Asia/Tokyo (UTC+9)', () => {
      const result = formatInLocalTimeZone(testDate, 'Asia/Tokyo', 'HH:mm');
      expect(result).toBe('21:00');
    });

    it('formats time in Europe/London (UTC+1 in June BST)', () => {
      const result = formatInLocalTimeZone(testDate, 'Europe/London', 'HH:mm');
      expect(result).toBe('13:00');
    });

    it('handles null timezone gracefully', () => {
      const result = formatInLocalTimeZone(testDate, null, 'HH:mm');
      expect(typeof result).toBe('string');
      expect(result).toMatch(/\d{2}:\d{2}/);
    });

    it('returns empty string for null date', () => {
      expect(formatInLocalTimeZone(null, 'America/New_York')).toBe('');
    });

    it('formats datetime type with concrete value', () => {
      const result = formatInLocalTimeZone(testDate, 'Asia/Tokyo', 'datetime');
      expect(result).toContain('Jun');
      expect(result).toContain('2024');
      expect(result).toContain('21:00');
    });

    it('formats date type with concrete value', () => {
      const result = formatInLocalTimeZone(testDate, 'Europe/London', 'date');
      expect(result).toContain('Jun');
      expect(result).toContain('15');
      expect(result).toContain('2024');
    });
  });

  describe('wrapper functions', () => {
    it('formatTimeInLocalZone returns correct time', () => {
      expect(formatTimeInLocalZone(testDate, 'America/New_York')).toBe('08:00');
    });

    it('formatDateInLocalZone returns formatted date', () => {
      const result = formatDateInLocalZone(testDate, 'America/New_York');
      expect(result).toContain('Jun');
      expect(result).toContain('15');
      expect(result).toContain('2024');
    });

    it('formatDateTimeInLocalZone returns formatted datetime', () => {
      const result = formatDateTimeInLocalZone(testDate, 'America/New_York');
      expect(result).toContain('Jun');
      expect(result).toContain('2024');
      expect(result).toContain('08:00');
    });
  });
});
