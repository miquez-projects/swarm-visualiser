import { parseVenueMentions } from './venueParser';

describe('parseVenueMentions', () => {
  test('parses text with single venue', () => {
    const text = 'You visited {{venue|abc123|Joe\'s Coffee|52.52|13.40}} yesterday.';
    const result = parseVenueMentions(text);

    expect(result).toEqual([
      { type: 'text', content: 'You visited ' },
      {
        type: 'venue',
        venueId: 'abc123',
        venueName: "Joe's Coffee",
        latitude: 52.52,
        longitude: 13.40
      },
      { type: 'text', content: ' yesterday.' }
    ]);
  });

  test('parses text with multiple venues', () => {
    const text = 'From {{venue|1|Place A|10|20}} to {{venue|2|Place B|30|40}}.';
    const result = parseVenueMentions(text);

    expect(result.length).toBe(5); // text, venue, text, venue, text
    expect(result.filter(p => p.type === 'venue').length).toBe(2);
  });

  test('handles text with no venues', () => {
    const text = 'Just plain text here.';
    const result = parseVenueMentions(text);

    expect(result).toEqual([
      { type: 'text', content: 'Just plain text here.' }
    ]);
  });

  test('handles empty text', () => {
    const result = parseVenueMentions('');
    expect(result).toEqual([{ type: 'text', content: '' }]);
  });

  test('parses negative coordinates', () => {
    const text = 'Venue: {{venue|x|Name|-12.34|-56.78}}';
    const result = parseVenueMentions(text);

    expect(result[1]).toMatchObject({
      type: 'venue',
      latitude: -12.34,
      longitude: -56.78
    });
  });
});
