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
            field: { type: 'string', description: 'Field to sort by' },
            direction: { type: 'string', enum: ['ASC', 'DESC'], description: 'Sort direction' }
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
    systemInstruction: 'You are a helpful assistant that answers questions about the user\'s Foursquare check-in history. Use the query_checkins function to retrieve data from their check-ins database. Always be specific with dates and locations. When showing counts or statistics, format numbers clearly. Be conversational and friendly.'
  });
}

module.exports = {
  createModel,
  queryCheckinsTool
};
