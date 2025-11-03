# AI Check-in Insight Copilot

## Overview

The AI Copilot allows users to ask natural language questions about their Foursquare check-in data. It uses Google Gemini 2.5 Flash with function calling to execute secure SQL queries and respond conversationally.

The copilot acts as a knowledgeable travel companion with perfect recall, providing precise answers with relevant geographical facts and always suggesting follow-up questions.

## Features

- **Natural Language Queries**: Ask questions in plain English
- **Persistent Chat Sessions**: Server-side sessions reduce token usage and maintain context
- **Secure Query Execution**: All queries are user-scoped and validated
- **Chat History**: Conversations persist in browser localStorage (up to 50 messages)
- **Smart Category Matching**: AI looks up actual category names before querying
- **Result Limiting**: Individual check-in lists limited to 15 records to conserve LLM context
- **Flexible Date Ranges**: Support for partial date ranges (before/after specific dates)
- **Expandable Interface**: Toggle between 400px and 800px widths
- **Mobile Responsive**: Full-screen overlay on mobile devices

## Example Questions

- "Where did I last check in in Slovenia?"
- "How many check-ins do I have?"
- "What are my top 5 categories?"
- "How many times did I check in per month in 2024?"
- "Which venues have I visited most?"
- "When was my first check-in?"
- "Show me all check-ins in Sweden before June 2022"
- "How many restaurants have I been to in France?"
- "What ski resorts have I visited?"

## Architecture

### Frontend (`client/src/components/copilot/`)

- **CopilotChat.jsx**: Main container
  - Manages conversation state
  - Handles API communication
  - Persists to localStorage on every message
  - Auto-scrolls to latest message

- **ChatHeader.jsx**: Control bar
  - Expand/collapse toggle (400px ↔ 800px)
  - Minimize button
  - Clear history button
  - Close button

- **ChatMessage.jsx**: Message rendering
  - User vs assistant styling
  - Timestamp display
  - Markdown support for formatting

- **ChatInput.jsx**: Input field
  - Auto-focus management
  - Enter to send, Shift+Enter for newline
  - Loading state during API calls

- **copilotStorage.js**: localStorage utilities
  - Save/load conversation history
  - Clear history
  - Max 50 messages retention

### Backend (`server/`)

#### API Route (`routes/copilot.js`)
- **POST /api/copilot/chat**: Main chat endpoint
  - Requires authentication token
  - Validates message input
  - Manages function calling loop
  - Handles errors gracefully

#### Gemini Integration (`services/geminiService.js`)
- **Model**: Gemini 2.5 Flash
- **Mode**: AUTO function calling
- **Tools**:
  - `get_categories`: Fetch all venue categories for the user
  - `query_checkins`: Execute SQL queries on check-in data
- **System Instruction**: Defines AI personality and workflow
  - Knowledgeable travel companion tone
  - Share relevant geographical facts
  - Always suggest follow-up questions
  - Format dates conversationally

#### Session Management (`services/geminiSessionManager.js`)
- In-memory Map storing sessions by userId
- 30-minute session timeout
- LRU eviction when max sessions (1000) reached
- Periodic cleanup every 10 minutes
- Session includes full conversation history
- Validates and filters malformed history messages

#### Query Builder (`services/queryBuilder.js`)
Builds secure, parameterized SQL queries from AI function calls.

**Key Methods:**
- `executeQuery(params, userId)`: Main entry point
  - Returns `{ data: [...], metadata: {...} }`
  - Limits individual check-ins to 15 records
  - Includes total count for context

- `buildCheckinsQuery(params, userId)`: SELECT queries
  - User-scoped with `user_id = $1`
  - Support for filters: country, city, category, venueName, dateRange
  - Partial date range support (start only, end only, or both)
  - Field selection with whitelist validation
  - ORDER BY with direction
  - LIMIT enforcement (max 15 for lists, max 1000 absolute)

- `buildAggregationQuery(params, userId)`: Aggregations
  - COUNT, SUM, AVG, MIN, MAX functions
  - GROUP BY with date granularity (day/week/month/year)
  - Same filter support as SELECT queries

- `buildCountQuery(params, userId)`: Total count
  - Used to show "15 of 243 results" metadata

- `getCategories(userId)`: List unique categories
  - User-scoped DISTINCT query
  - Alphabetically sorted

- `validateField(field)`: Security
  - Whitelist: id, venue_id, venue_name, venue_category, city, country, checkin_date, latitude, longitude, created_at
  - Throws error if field not allowed

**Date Range Handling:**
```javascript
// Supports three cases:
dateRange: { start: '2020-01-01', end: '2022-12-31' } // BETWEEN
dateRange: { start: '2020-01-01' }                     // >=
dateRange: { end: '2022-12-31' }                       // <=
```

### Data Flow

1. **User asks question** → Frontend
2. **POST /api/copilot/chat** with message + conversationHistory
3. **Session retrieval** → geminiSessionManager.getOrCreateSession()
4. **AI analysis** → Gemini decides to call function(s)
5. **Function call: get_categories** (if category mentioned)
   - Returns list of actual category names
   - AI matches user's term to exact category
6. **Function call: query_checkins**
   - `queryBuilder.executeQuery()` builds SQL
   - Executes against PostgreSQL
   - Returns data + metadata
7. **AI response** → Gemini formulates natural language answer
   - Includes "Showing 15 of X results" if limited
   - Suggests follow-up question
8. **Response returned** → Frontend displays
9. **History saved** → localStorage updated

## Security

### Data Protection
- **User Scoping**: All queries automatically filtered by `user_id` - users can only access their own data
- **Parameterized Queries**: All SQL uses parameterized queries (`$1`, `$2`) to prevent SQL injection
- **Field Whitelisting**: Only 10 allowed fields can be queried (see validateField in queryBuilder.js)
- **Function Whitelisting**: Only 5 approved aggregation functions (count, sum, avg, min, max)
- **Authentication Required**: All endpoints require valid JWT token from Foursquare OAuth

### Resource Limits
- **Query Limits**:
  - Individual check-in queries: Max 15 records returned (with total count in metadata)
  - Aggregation queries: Max 1000 rows
  - Absolute maximum: 1000 rows
- **Session Limits**:
  - Max 1000 concurrent sessions server-wide
  - LRU eviction when limit reached
  - 30-minute timeout per session
- **Message History**: Max 50 messages stored in localStorage

### API Key Protection
- **Server-side only**: Gemini API key never exposed to frontend
- **Environment variable**: Stored in `GEMINI_API_KEY` env var
- **Validated on startup**: Server won't start without valid key

## Configuration

### Environment Variables

Required in `server/.env` (or Render environment):

```bash
# Required - Get from https://aistudio.google.com/app/apikey
GEMINI_API_KEY=AIza...

# Existing variables (already configured)
DATABASE_URL=postgresql://...
ENCRYPTION_KEY=your_64_char_hex_key
PORT=3001
NODE_ENV=production
```

### Customizable Constants

#### Session Settings (`server/services/geminiSessionManager.js`)
```javascript
SESSION_TIMEOUT_MS = 30 * 60 * 1000;  // 30 minutes
MAX_SESSIONS = 1000;                   // Max concurrent sessions
```
Cleanup runs every 10 minutes automatically.

#### Storage Limits (`client/src/utils/copilotStorage.js`)
```javascript
MAX_MESSAGES = 50;  // Max messages in localStorage
```

#### Query Limits (`server/services/queryBuilder.js`)
```javascript
// Individual check-in queries
const limit = 15;  // Max records for lists

// Aggregation queries
const limit = params.limit ? Math.min(parseInt(params.limit, 10), 1000) : 100;
```

#### Model Configuration (`server/services/geminiService.js`)
```javascript
model: 'gemini-2.5-flash',  // Model version
mode: 'AUTO',               // Function calling mode
```

### AI Personality Customization

Edit `systemInstruction` in `server/services/geminiService.js` to change:
- Tone of voice
- Response format
- Fact-sharing behavior
- Follow-up question style

## Implementation Details

### Why Gemini 2.5 Flash?
- **Speed**: Fast response times for good UX
- **Cost**: Free tier supports 60 requests/min (plenty for personal use)
- **Function Calling**: Native support for structured tool use
- **Quality**: Better than Flash Lite (tested and reverted from Lite due to empty responses)

### Why Result Limiting?
- **Token Conservation**: Sending 100+ check-ins would use excessive context
- **Metadata Approach**: AI receives `{ data: [...15 items], metadata: { total: 243, limited: true } }`
- **User Communication**: AI naturally says "Showing 15 of 243 check-ins..."
- **Performance**: Faster queries, less data transfer

### Why Category Lookup Function?
- **Problem**: User says "restaurants", database has "French Restaurant", "Italian Restaurant", etc.
- **Solution**: Two-step process:
  1. AI calls `get_categories()` to see actual category names
  2. AI matches user's colloquial term to exact category
  3. AI calls `query_checkins()` with correct category name
- **Result**: Better matches, fewer zero-result queries

### Why Server-Side Sessions?
- **Token Efficiency**: Don't send full conversation history to Gemini on every request
- **Context Preservation**: Gemini remembers previous questions/answers
- **Timeout**: 30 minutes of inactivity clears session
- **Trade-off**: Sessions lost on server restart (acceptable for this use case)

### Why LRU Eviction?
- **Memory Protection**: Prevents unbounded memory growth
- **Fair Resource Use**: Least recently used sessions evicted first
- **Max Sessions**: 1000 concurrent (way more than needed for personal use)

## Development

### Start Dev Servers

```bash
npm run dev
```

This starts both:
- Backend on http://localhost:3001
- Frontend on http://localhost:3000

### Test Queries

1. Login to the app (Foursquare OAuth)
2. Click chat bubble in bottom-right corner
3. Type questions and verify responses
4. Check backend logs for SQL queries and function calls

### Monitor Backend Logs

```bash
# See function calls and SQL queries
tail -f server/logs/app.log

# Or check console output during npm run dev
```

### Add New Query Capabilities

1. **Add new tool** in `server/services/geminiService.js`:
   ```javascript
   {
     name: 'new_function',
     description: 'What this function does',
     parameters: { /* schema */ }
   }
   ```

2. **Handle function call** in `server/routes/copilot.js`:
   ```javascript
   if (functionCall.name === 'new_function') {
     // Execute logic
     // Send result back to AI
   }
   ```

3. **Update whitelists** if adding new fields:
   - Add to `ALLOWED_FIELDS` in `server/services/queryBuilder.js`
   - Add to enum in tool definition

### Debugging Tips

**Enable verbose logging:**
```javascript
// In server/routes/copilot.js
console.log('AI response candidates:', JSON.stringify(result.response.candidates, null, 2));
console.log('Function calls:', JSON.stringify(functionCalls, null, 2));
console.log('Query results:', JSON.stringify(queryResults, null, 2));
```

**Test SQL queries directly:**
```sql
-- In psql or database client
SELECT * FROM checkins WHERE user_id = 1 AND country = 'Sweden' LIMIT 15;
```

**Check Gemini API usage:**
- Visit https://aistudio.google.com/app/apikey
- Monitor request count vs free tier limit (60/min)

## Troubleshooting

### "Unable to reach AI service"

**Causes:**
- Missing or invalid Gemini API key
- Backend server not running
- Network connectivity issues

**Solutions:**
1. Check `GEMINI_API_KEY` is set in environment variables
2. Verify key is valid at https://aistudio.google.com/app/apikey
3. Check backend console for startup errors
4. Verify server is running on expected port
5. Check browser console for network errors

### "Failed to execute query"

**Causes:**
- Database connection issues
- Invalid field names
- SQL syntax errors
- Partial date ranges not handled (fixed in latest version)

**Solutions:**
1. Check PostgreSQL is running and accessible
2. Verify `DATABASE_URL` is correct
3. Review server logs for detailed SQL error
4. Check user has check-in data: `SELECT COUNT(*) FROM checkins WHERE user_id = X`
5. Verify field names match whitelist in queryBuilder.js

### AI returns empty responses

**Causes:**
- Using Gemini Flash Lite (quality issue)
- Function calling loop breaking
- Invalid function response format

**Solutions:**
1. Verify using `gemini-2.5-flash` (not Lite) in geminiService.js
2. Check logs for "Final AI response:" to see if text is empty
3. Verify function response includes proper structure
4. Check `mode: 'AUTO'` not `'ANY'` (prevents infinite loops)

### Queries returning no results when they should

**Causes:**
- Case-sensitive filtering (country/city names)
- Category name mismatch (user says "restaurants", DB has "French Restaurant")
- Partial date ranges not working (fixed in latest version)
- Date format issues

**Solutions:**
1. Verify filters match actual data exactly (check case)
2. Use category lookup: AI should call `get_categories` first
3. Check date format is YYYY-MM-DD
4. Try broader queries first to verify data exists
5. Test SQL query directly in database to isolate issue

### Session not persisting

**Expected behavior:**
- Sessions timeout after 30 minutes of inactivity
- Sessions lost on server restart
- localStorage clears on browser cache clear

**Solutions:**
1. Check localStorage is enabled in browser settings
2. Verify conversation history shows in DevTools → Application → Local Storage
3. If chat history shows but session lost, server may have restarted
4. Clear localStorage and start fresh conversation

### "Showing X of Y results" metadata not appearing

**Expected:** Individual check-in queries should show metadata when >15 results

**Solutions:**
1. Verify using latest queryBuilder.js with result limiting
2. Check query type is 'checkins' not 'aggregation'
3. Review logs for metadata in query results
4. Aggregations don't show this (expected - they return summaries)

## Future Enhancements

- **Dynamic Visualizations**: Render charts/tables for certain queries
- **Rate Limiting**: Per-user daily limits
- **Query Suggestions**: Pre-populate common questions
- **Export**: Download query results
- **Voice Input**: Speech-to-text for mobile
- **Multi-language**: Support non-English queries
