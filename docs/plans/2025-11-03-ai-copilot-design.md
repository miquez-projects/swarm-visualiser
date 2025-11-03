# AI Check-in Insight Copilot - Design Document

**Date:** 2025-11-03
**Feature:** AI-powered chat interface for querying Foursquare check-in data
**AI Backend:** Google Gemini with function calling

## Overview

Add an AI copilot that allows users to ask natural language questions about their check-in data. The AI uses function calling to execute secure SQL queries and responds in conversational language. Future iterations will support rendering tables and charts for certain query types.

## Requirements

### Functional Requirements
- Chat interface accessible from any page
- Natural language query processing (e.g., "Where did I last check in in Slovenia?")
- AI uses function calling to query check-ins database
- Responses in natural language
- Chat history persisted in browser
- All queries scoped to authenticated user's data

### Non-Functional Requirements
- Secure SQL execution (no injection, user-scoped queries only)
- Session management to minimize token usage
- Responsive design (desktop and mobile)
- No rate limiting initially (monitor usage)

## Architecture

### High-Level Flow

```
User types question
    ↓
Frontend sends to /api/copilot/chat
    ↓
Backend sends to Gemini API (with chat session)
    ↓
Gemini returns function call OR text response
    ↓
If function call: Execute query builder → SQL → Results → Back to Gemini
    ↓
Gemini formulates natural language response
    ↓
Frontend displays response
    ↓
Save to localStorage
```

### Components

#### Frontend Components

**1. CopilotChat.jsx** - Main container
- Bottom-right floating action button (FAB)
- Three states: collapsed (FAB only), chat mode (400px), expanded mode (800px)
- Manages state: messages, isOpen, isExpanded, isLoading
- Persists to localStorage

**2. ChatMessage.jsx** - Message display
- User messages: right-aligned, colored background
- AI messages: left-aligned, different background
- Timestamp on hover
- Copy button for AI responses

**3. ChatInput.jsx** - Input area
- TextField with Send button
- Enter to send, Shift+Enter for new line
- Disabled while loading

**4. ChatHeader.jsx** - Controls
- Minimize/expand/close buttons
- Title: "Swarm Copilot"

**Component Hierarchy:**
```
App.jsx
└── CopilotChat.jsx
    ├── ChatHeader.jsx
    ├── ChatMessageList.jsx
    │   └── ChatMessage.jsx (multiple)
    └── ChatInput.jsx
```

#### Backend Components

**1. /api/copilot/chat** - Main endpoint
- POST endpoint requiring authentication
- Request: `{ message, conversationHistory }`
- Response: `{ response }`
- Handles tool calling flow

**2. GeminiSessionManager** (server/services/geminiSessionManager.js)
- Maintains in-memory Map of active chat sessions per user
- Sessions expire after 30 minutes of inactivity
- Reuses sessions to avoid resending tool definitions
- Falls back to conversationHistory from localStorage if session expired

**3. QueryBuilder** (server/services/queryBuilder.js)
- Builds secure parameterized SQL queries
- Always injects `user_id = $1` filter
- Whitelists fields, tables, functions
- Supports three query types:
  - **checkins**: Simple SELECT with filters
  - **aggregation**: COUNT, AVG, MIN, MAX, SUM
  - **groupBy**: Group by fields with date granularity

**4. GeminiService** (server/services/geminiService.js)
- Initializes Gemini model with tool definitions
- Defines `query_checkins` function for AI to call
- Handles function call execution and response formatting

## Data Models

### Frontend LocalStorage Schema

```javascript
// copilot_chat_history
[
  {
    "role": "user",
    "content": "Where did I last check in in Slovenia?",
    "timestamp": "2025-11-03T14:30:00.000Z"
  },
  {
    "role": "assistant",
    "content": "You last checked in at Kavarna Union in Ljubljana on Jan 15, 2025 at 2:30 PM.",
    "timestamp": "2025-11-03T14:30:05.000Z"
  }
]

// copilot_state
{
  "isOpen": true,
  "isExpanded": false,
  "width": 400,
  "height": 600
}
```

### Backend Session Storage

```javascript
// In-memory Map
activeSessions = {
  userId: {
    chat: GeminiChatSession,
    lastActivity: timestamp
  }
}
```

### Gemini Tool Definition

```javascript
{
  "name": "query_checkins",
  "description": "Query user's Foursquare check-in data",
  "parameters": {
    "queryType": {
      "type": "string",
      "enum": ["checkins", "aggregation", "groupBy"]
    },
    "filters": {
      "type": "object",
      "properties": {
        "country": { "type": "string" },
        "city": { "type": "string" },
        "category": { "type": "string" },
        "venueName": { "type": "string" },
        "dateRange": {
          "type": "object",
          "properties": {
            "start": { "type": "string", "format": "date" },
            "end": { "type": "string", "format": "date" }
          }
        }
      }
    },
    "aggregation": {
      "type": "object",
      "properties": {
        "function": {
          "type": "string",
          "enum": ["count", "avg", "min", "max", "sum"]
        },
        "field": { "type": "string" }
      }
    },
    "groupBy": {
      "type": "array",
      "items": {
        "oneOf": [
          { "type": "string" },
          {
            "type": "object",
            "properties": {
              "field": { "type": "string" },
              "granularity": {
                "type": "string",
                "enum": ["day", "week", "month", "year"]
              }
            }
          }
        ]
      }
    },
    "orderBy": {
      "type": "object",
      "properties": {
        "field": { "type": "string" },
        "direction": { "type": "string", "enum": ["ASC", "DESC"] }
      }
    },
    "limit": { "type": "integer" }
  }
}
```

## Example Query Flows

### Example 1: Simple Query
**User:** "Where did I last check in in Slovenia?"

**AI Tool Call:**
```json
{
  "queryType": "checkins",
  "filters": { "country": "Slovenia" },
  "orderBy": { "field": "checkin_date", "direction": "DESC" },
  "limit": 1
}
```

**Generated SQL:**
```sql
SELECT venue_name, city, checkin_date, checkin_time
FROM checkins
WHERE user_id = $1 AND country = $2
ORDER BY checkin_date DESC, checkin_time DESC
LIMIT 1
```

**AI Response:** "You last checked in at Kavarna Union in Ljubljana on January 15, 2025 at 2:30 PM."

### Example 2: Aggregation with Date Grouping
**User:** "On average, how many times did I check in per day in 2022?"

**AI Tool Call:**
```json
{
  "queryType": "aggregation",
  "aggregation": { "function": "count", "field": "*" },
  "groupBy": [{ "field": "checkin_date", "granularity": "day" }],
  "filters": {
    "dateRange": { "start": "2022-01-01", "end": "2022-12-31" }
  }
}
```

**Generated SQL:**
```sql
SELECT DATE(checkin_date) as day, COUNT(*) as result
FROM checkins
WHERE user_id = $1 AND checkin_date BETWEEN $2 AND $3
GROUP BY DATE(checkin_date)
```

**Backend calculates average:**
```javascript
const avgPerDay = results.reduce((sum, r) => sum + r.result, 0) / results.length;
```

**AI Response:** "In 2022, you checked in an average of 3.2 times per day."

### Example 3: Top Categories
**User:** "What are my top 5 categories?"

**AI Tool Call:**
```json
{
  "queryType": "groupBy",
  "groupBy": ["venue_category"],
  "aggregation": { "function": "count" },
  "orderBy": { "field": "count", "direction": "DESC" },
  "limit": 5
}
```

**Generated SQL:**
```sql
SELECT venue_category, COUNT(*) as count
FROM checkins
WHERE user_id = $1
GROUP BY venue_category
ORDER BY count DESC
LIMIT 5
```

**AI Response:** "Your top 5 categories are: 1. Coffee Shop (234 check-ins), 2. Restaurant (187 check-ins), 3. Bar (142 check-ins), 4. Park (98 check-ins), 5. Airport (76 check-ins)."

## Security Measures

### Query Builder Security
1. **User Scoping:** Always inject `WHERE user_id = $1` in all queries
2. **Parameterized Queries:** Use `$1`, `$2` placeholders, never string concatenation
3. **Field Whitelisting:** Only allow predefined fields from `ALLOWED_FIELDS`
4. **Function Whitelisting:** Only allow `count`, `avg`, `min`, `max`, `sum`
5. **Query Timeout:** 30 seconds maximum execution time
6. **Result Limit:** Maximum 1000 rows returned
7. **Read-Only Operations:** Only SELECT queries, no INSERT/UPDATE/DELETE

### API Security
1. **Authentication Required:** All `/api/copilot/*` endpoints require valid token
2. **Rate Limiting:** (Future) Per-user limits to prevent abuse
3. **Input Validation:** Validate all query parameters before building SQL
4. **Error Handling:** Don't expose SQL errors to client, log server-side

### Session Security
1. **Server-Side Sessions:** No sensitive data in localStorage
2. **Session Expiration:** 30-minute inactivity timeout
3. **Cleanup:** Periodic cleanup of expired sessions (every 10 minutes)

## UI/UX Design

### Chat Bubble States

**Collapsed (Default):**
- Floating action button (FAB) with chat icon
- Bottom-right: 24px from bottom, 24px from right
- Click to expand to chat mode

**Chat Mode:**
- 400px width × 600px height
- Header with "Swarm Copilot" title and controls
- Scrollable message area
- Input field at bottom
- Material-UI Paper with elevation

**Expanded Mode (Future):**
- 800px width for table/chart rendering
- Toggle with expand button in header
- Maintains chat functionality plus visualizations

### Responsive Behavior

**Desktop (>960px):**
- Bottom-right bubble
- 400px/800px width

**Tablet (600px-960px):**
- Bottom-right bubble
- Adapts width (max 90vw)

**Mobile (<600px):**
- Full-screen overlay when opened
- Swipe down to close

### Message Display

**User Messages:**
- Right-aligned
- Primary color background (`primary.main`)
- White text
- Timestamp below (small, gray)

**AI Messages:**
- Left-aligned
- Light gray background (`grey.100`)
- Dark text
- Timestamp below
- Copy button appears on hover

**Loading State:**
- Three animated dots in AI message bubble
- Input disabled

**Error State:**
- Red-outlined message
- "Unable to process query. Please try again."
- Retry button

## Implementation Strategy

### Phase 1: Core Chat Interface
1. Create frontend components (CopilotChat, ChatMessage, ChatInput, ChatHeader)
2. Implement localStorage persistence
3. Basic UI states (collapsed/chat/expanded)
4. Mobile responsive design

### Phase 2: Backend Integration
1. Install `@google/generative-ai` package
2. Create GeminiService with model initialization
3. Create `/api/copilot/chat` endpoint
4. Implement GeminiSessionManager for persistent sessions
5. Connect frontend to backend API

### Phase 3: Query Builder
1. Create QueryBuilder service
2. Implement three query types (checkins, aggregation, groupBy)
3. Add security validations (whitelisting, parameterization)
4. Support date granularity (day, week, month, year)
5. Add query timeout and result limits

### Phase 4: Tool Calling Integration
1. Define `query_checkins` tool for Gemini
2. Implement tool call execution flow
3. Handle multi-turn conversations (tool call → results → final response)
4. Error handling and fallbacks

### Phase 5: Polish & Testing
1. Test various query types
2. Optimize Gemini prompts for better responses
3. Add loading states and error messages
4. Test session persistence across refreshes
5. Performance testing (query execution times)

### Future Enhancements (Post-MVP)
1. **Dynamic Visualizations:** Detect query types and render charts/tables
2. **Rate Limiting:** Per-user daily limits
3. **Query Suggestions:** Pre-populate common questions
4. **Export:** Download chat history or query results
5. **Voice Input:** Speech-to-text for mobile
6. **Multi-language:** Support non-English queries

## Environment Variables

```bash
# .env (backend)
GEMINI_API_KEY=your_gemini_api_key_here
```

## Dependencies

### Frontend (client/package.json)
```json
{
  "dependencies": {
    "@mui/material": "^5.x",
    "@mui/icons-material": "^5.x",
    "axios": "^1.x"
  }
}
```

### Backend (server/package.json)
```json
{
  "dependencies": {
    "@google/generative-ai": "^0.21.0",
    "express": "^4.x",
    "pg": "^8.x"
  }
}
```

## Testing Considerations

### Unit Tests
- QueryBuilder: Test each query type with various parameters
- GeminiSessionManager: Test session creation, reuse, expiration
- Frontend components: Test message rendering, state management

### Integration Tests
- Full flow: User message → API → Gemini → Query → Response
- Session persistence across multiple requests
- Error handling (invalid queries, timeouts, network errors)

### Security Tests
- Verify user_id scoping (users can't access others' data)
- SQL injection attempts (should fail validation)
- Field/function whitelisting enforcement

### User Testing
- Test with real questions users might ask
- Verify AI understands various phrasings
- Check response quality and accuracy

## Open Questions / Future Decisions

1. **Gemini Model Choice:** Start with `gemini-1.5-flash` (fast, cheap) or `gemini-1.5-pro` (better quality)?
2. **Context Window:** How many messages to keep in session before truncating?
3. **Visualization Triggers:** Which query types should auto-render as charts vs text?
4. **Chat Clearing:** Add "Clear history" button or keep indefinitely?
5. **System Prompts:** What personality/tone should the AI have?

## Success Metrics

- User asks a question → Gets accurate response in < 5 seconds
- 90%+ of queries successfully execute without errors
- Zero SQL injection vulnerabilities
- Zero data leakage between users
- Session reuse rate > 70% (indicates token efficiency)
