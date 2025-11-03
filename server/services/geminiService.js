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
    model: 'gemini-2.5-flash',
    tools: [queryCheckinsTool],
    toolConfig: {
      functionCallingConfig: {
        mode: 'ANY',
        allowedFunctionNames: ['query_checkins']
      }
    },
    systemInstruction: 'You are a helpful assistant that answers questions about the user\'s Foursquare check-in history. IMPORTANT: You MUST use the query_checkins function to retrieve data - you have NO direct access to the database. For every question about check-ins, call query_checkins first, then format the results into a complete answer including venue names, locations (city, country), and full dates/times. Never make up data or give partial information. Format dates clearly (e.g., "January 15, 2024 at 2:30 PM"). If the query returns an error, apologize and explain that you couldn\'t access the data, then suggest the user try rephrasing their question.'
  });
}

module.exports = {
  createModel,
  queryCheckinsTool
};
