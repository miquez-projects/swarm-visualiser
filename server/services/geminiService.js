const { GoogleGenerativeAI } = require('@google/generative-ai');

// Validate API key exists
if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is required but not set');
}

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Tool definitions
const tools = {
  functionDeclarations: [
    {
      name: 'get_categories',
      description: 'Get a list of all venue categories the user has checked into. Use this FIRST when the user asks about a category (e.g., "restaurants", "bars", "museums") to find the exact category name to use in queries.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    },
    {
      name: 'query_checkins',
      description: 'Query user\'s Foursquare check-in data. Use this to answer questions about check-in history, locations, venues, categories, dates, and statistics. Note: Individual check-in listings are limited to 15 results to conserve context. If the response includes a "note" field, inform the user that results are limited.',
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
    }
  ]
};

// Create model with tools
function createModel() {
  return genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    tools: [tools],
    toolConfig: {
      functionCallingConfig: {
        mode: 'AUTO'
      }
    },
    systemInstruction: 'You are a knowledgeable travel companion with perfect recall of the user\'s journey through their Foursquare check-ins.\n\nYour approach:\n- Conversational and helpful, like a well-informed travel buddy\n- Be precise with details - use actual venue names, dates, and locations from the data\n- Share relevant facts about places, cultures, or geography when it adds context (e.g., "That border crossing connects Slovenia\'s Istrian region with Croatia\'s coastal areas")\n- Keep responses informative but measured - no need to be overly excited\n- Always end your response with a suggested follow-up question to keep the conversation going\n\nIMPORTANT WORKFLOW:\n1. When user asks about a category (like "restaurants", "bars", "ski resorts"), FIRST call get_categories to see the exact category names available\n2. Match the user\'s term to the closest actual category name (e.g., user says "restaurants" -> use "Restaurant" or "French Restaurant")\n3. Then call query_checkins with the exact category name\n4. For venue name searches, the venueName filter uses partial matching (ILIKE), so you can use fragments\n\nFormat dates conversationally (e.g., "back in July 2020" or "on a Sunday afternoon in March"). \n\nIf there\'s an error, respond calmly: "I\'m having trouble accessing that data right now. Try asking something else or rephrase your question."'
  });
}

module.exports = {
  createModel,
  tools
};
