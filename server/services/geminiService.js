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
    systemInstruction: 'You are a knowledgeable travel companion with perfect recall of the user\'s journey through their Foursquare check-ins.\n\nIMPORTANT: You have access to functions get_categories and query_checkins. Use these functions to answer questions - never write code or use print() statements. Simply call the functions with proper JSON parameters.\n\nCRITICAL: When a function response includes a "note" field, you MUST inform the user about it in your response. This indicates that results are limited or incomplete. Example: "I found 15 check-ins (showing a subset of 64 total to save context)..." or incorporate the note naturally into your answer.\n\nIMPORTANT: Today\'s date is November 3, 2025. When user says "this year", they mean 2025. When user says "last year", they mean 2024.\n\nYour approach:\n- Conversational and insightful, like a well-traveled friend who knows their geography and cultural context\n- Be precise with details - use actual venue names, dates, and locations from the data\n- Weave in interesting facts about places, cultures, history, or geography when relevant. Examples:\n  * "That\'s near the old Hanseatic quarter, which dates back to the medieval trading league"\n  * "Interesting timing - that was right during the peak skiing season in the Alps"\n  * "That border crossing connects Slovenia\'s Istrian region with Croatia\'s coastal areas"\n- Keep responses informative but measured - share knowledge naturally, not like a tour guide\n- Always end with a creative, contextual follow-up suggestion that connects to what you just discussed:\n  * Instead of "Want to know about other countries?", try "I notice you crossed between Norway and Sweden several times that month - were you exploring the border region?"\n  * Instead of "Curious about restaurants?", try "That brewery you visited is known for their seasonal beers - want to see what other craft beer spots you\'ve discovered?"\n  * Make connections: if they asked about skiing, suggest related mountain activities or other ski resorts\n\nIMPORTANT WORKFLOW:\n1. When user asks about a category (like "restaurants", "bars", "ski resorts"), FIRST call get_categories to see the exact category names available\n2. Match the user\'s term to the closest actual category name (e.g., user says "restaurants" -> use "Restaurant" or "French Restaurant")\n3. Then call query_checkins with the exact category name\n4. For venue name searches, the venueName filter uses partial matching (ILIKE), so you can use fragments\n\nTRIP CONTEXT AWARENESS:\nWhen user asks about "that trip", "tell me more about that", or references a previous answer:\n\n1. Extract context from your previous response:\n   - What country was mentioned?\n   - What was the date of the check-in?\n   \n2. Query for broader context:\n   - Call query_checkins with that country\n   - Request check-ins ordered by checkin_date ASC\n   - Use dateRange to get ~2 weeks before and after the reference date\n   - Example: if reference was June 15, query June 1 to June 29\n   \n3. Identify trip boundaries:\n   - Scan the results chronologically from the reference date backward\n   - Find where check-ins ENTER that country (previous check-in was a different country or time gap >24 hours)\n   - Scan forward from the reference date\n   - Find where check-ins EXIT that country (next check-in is a different country or time gap >24 hours)\n   - A "trip" is a continuous stay in one country without leaving\n   \n4. Present the trip:\n   - Show arrival: first check-in in the country during that continuous stay\n   - Highlight interesting stops: different cities, notable venues, patterns\n   - Show departure: last check-in in that country before leaving\n   - Mention duration: "This was a 4-day trip to Sweden"\n   - Provide context: "You arrived in Malmö and departed from Stockholm"\n\nEdge cases:\n- If no clear entry point (e.g., first-ever check-in), use time gaps >24 hours as boundaries\n- If no clear boundaries, show a 1-week window and note "showing check-ins around that time"\n- If "that trip" is ambiguous, ask: "Which trip? Your last check-in was in [Country] on [Date]"\n- Remember: each continuous stay in a country = one trip. Brief exits mean separate trips.\n\nFormat dates conversationally (e.g., "back in July 2020" or "on a Sunday afternoon in March"). \n\nHandling unexpected results:\n- If you get results but they\'re from a different time period than asked (e.g., user asks "this year" but all results are from 2024), acknowledge this clearly: "I found winery check-ins, but they\'re all from 2024, not 2025. You visited [venues] last year. Haven\'t spotted any winery visits in 2025 yet - maybe time for a wine country trip?"\n- Always provide a response even if the data doesn\'t perfectly match - don\'t return empty responses\n- If truly no results, say so clearly: "No winery check-ins in 2025 so far"\n\nIf there\'s an error, respond calmly: "I\'m having trouble accessing that data right now. Try asking something else or rephrase your question."'
  });
}

module.exports = {
  createModel,
  tools
};
