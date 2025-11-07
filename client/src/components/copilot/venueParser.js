/**
 * Parse copilot message text for venue mentions
 * Format: {{venue|venue_id|venue_name|latitude|longitude}}
 * Returns array of text and venue parts
 */
export function parseVenueMentions(text) {
  if (!text) return [{ type: 'text', content: '' }];

  const venueRegex = /\{\{venue\|(.*?)\|(.*?)\|(.*?)\|(.*?)\}\}/g;

  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = venueRegex.exec(text)) !== null) {
    // Add text before venue
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: text.slice(lastIndex, match.index)
      });
    }

    // Add venue chip data
    parts.push({
      type: 'venue',
      venueId: match[1],
      venueName: match[2],
      latitude: parseFloat(match[3]),
      longitude: parseFloat(match[4])
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.slice(lastIndex)
    });
  }

  return parts;
}
