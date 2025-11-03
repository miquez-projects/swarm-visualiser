const { GoogleGenerativeAI } = require('@google/generative-ai');

// Validate API key exists
if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is required but not set');
}

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Tool definition for querying check-ins
const queryCheckinsTool = {
  functionDeclarations: [{
    name: 'query_checkins',
    description: 'Query user\'s Foursquare check-in data. Use this to answer questions about check-in history, locations, venues, categories, dates, and statistics.',
    parameters: {
      type: 'object',
      properties: {
        queryType: {
          type: 'string',
          enum: ['checkins', 'aggregation'],
          description: 'Type of query: "checkins" for listing check-ins, "aggregation" for statistics/counts'
        },
        filters: {
          type: 'object',
          description: 'Filters to apply to the query',
          properties: {
            country: { type: 'string', description: 'Filter by country name' },
            city: { type: 'string', description: 'Filter by city name' },
            category: { type: 'string', description: 'Filter by venue category' },
            venueName: { type: 'string', description: 'Filter by venue name (partial match)' },
            dateRange: {
              type: 'object',
              description: 'Filter by date range',
              properties: {
                start: { type: 'string', format: 'date', description: 'Start date (YYYY-MM-DD)' },
                end: { type: 'string', format: 'date', description: 'End date (YYYY-MM-DD)' }
              }
            }
          }
        },
        aggregation: {
          type: 'object',
          description: 'Aggregation to perform (for queryType=aggregation)',
          properties: {
            function: {
              type: 'string',
              enum: ['count', 'sum', 'avg', 'min', 'max'],
              description: 'Aggregation function'
            },
            field: { type: 'string', description: 'Field to aggregate' }
          }
        },
        groupBy: {
          type: 'array',
          description: 'Fields to group by. For dates, use objects with granularity.',
          items: {
            oneOf: [
              { type: 'string' },
              {
                type: 'object',
                properties: {
                  field: { type: 'string', description: 'Field name (e.g., checkin_date)' },
                  granularity: {
                    type: 'string',
                    enum: ['day', 'week', 'month', 'year'],
                    description: 'Date grouping granularity'
                  }
                }
              }
            ]
          }
        },
        orderBy: {
          type: 'object',
          description: 'Sort order',
          properties: {
            field: {
              type: 'string',
              enum: ['id', 'venue_id', 'venue_name', 'venue_category', 'city', 'country', 'checkin_date', 'latitude', 'longitude', 'created_at'],
              description: 'Field to sort by - use checkin_date for dates (timestamp includes both date and time)'
            },
            direction: { type: 'string', enum: ['ASC', 'DESC'], description: 'Sort direction' }
          }
        },
        select: {
          type: 'array',
          description: 'Fields to return in results. checkin_date is a timestamp with both date and time.',
          items: {
            type: 'string',
            enum: ['id', 'venue_id', 'venue_name', 'venue_category', 'city', 'country', 'checkin_date', 'latitude', 'longitude', 'created_at']
          }
        },
        limit: { type: 'integer', description: 'Maximum number of results' }
      },
      required: ['queryType']
    }
  }]
};

// Create model with tools
function createModel() {
  return genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    tools: [queryCheckinsTool],
    toolConfig: {
      functionCallingConfig: {
        mode: 'AUTO'
      }
    },
    systemInstruction: 'You are a warm, enthusiastic friend with an incredible memory for the user\'s travels and adventures. You remember every place they\'ve been through their Foursquare check-ins. \n\nYour personality:\n- Conversational and friendly, like chatting with a well-traveled friend\n- Enthusiastic about their travels and genuinely interested in their experiences\n- Share interesting facts about places, cultures, or geography when relevant (e.g., "That border crossing connects Slovenia\'s Istrian region with Croatia\'s coastal areas!")\n- Be specific with details - use actual venue names, dates, and locations from the data\n- After answering, proactively suggest related questions they might find interesting\n\nIMPORTANT: You MUST use the query_checkins function to retrieve data - you have NO direct access to the database. Call it to get facts, then weave them into your friendly response.\n\nFormat dates conversationally (e.g., "back in July 2020" or "on a Sunday afternoon in March"). \n\nIf there\'s an error, say something like "Hmm, I\'m having trouble accessing that memory right now - mind trying a different question?" \n\nAlways end with a suggestion like "Want to know..." or "Curious about..." to keep the conversation flowing.'
  });
}

module.exports = {
  createModel,
  queryCheckinsTool
};
