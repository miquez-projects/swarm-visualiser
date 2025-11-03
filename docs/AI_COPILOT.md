# AI Check-in Insight Copilot

## Overview

The AI Copilot allows users to ask natural language questions about their Foursquare check-in data. It uses Google Gemini with function calling to execute secure SQL queries and respond conversationally.

## Features

- **Natural Language Queries**: Ask questions in plain English
- **Persistent Chat Sessions**: Server-side sessions reduce token usage
- **Secure Query Execution**: All queries are user-scoped and validated
- **Chat History**: Conversations persist in browser localStorage
- **Expandable Interface**: Toggle between 400px and 800px widths
- **Mobile Responsive**: Full-screen overlay on mobile devices

## Example Questions

- "Where did I last check in in Slovenia?"
- "How many check-ins do I have?"
- "What are my top 5 categories?"
- "How many times did I check in per month in 2024?"
- "Which venues have I visited most?"
- "When was my first check-in?"

## Architecture

### Frontend
- **CopilotChat.jsx**: Main container with state management
- **ChatHeader.jsx**: Controls (expand, minimize, clear, close)
- **ChatMessage.jsx**: Individual message display
- **ChatInput.jsx**: Message input field
- **copilotStorage.js**: localStorage utilities

### Backend
- **routes/copilot.js**: API endpoint for chat
- **services/geminiService.js**: Gemini API integration
- **services/geminiSessionManager.js**: Session persistence
- **services/queryBuilder.js**: Secure SQL query generation

### Flow

1. User types question
2. Frontend sends to `/api/copilot/chat`
3. Backend retrieves or creates Gemini session
4. Gemini analyzes question and calls `query_checkins` function
5. QueryBuilder builds secure SQL query
6. Results returned to Gemini
7. Gemini formulates natural language response
8. Frontend displays response

## Security

- **User Scoping**: All queries filtered by `user_id`
- **Parameterized Queries**: Prevents SQL injection
- **Field Whitelisting**: Only allowed fields can be queried
- **Function Whitelisting**: Only approved aggregations
- **Query Limits**: Max 1000 rows, 30 second timeout
- **Authentication Required**: All endpoints require valid token

## Configuration

### Environment Variables

Add to `server/.env`:

```bash
GEMINI_API_KEY=your_gemini_api_key
```

Get an API key from: https://aistudio.google.com/app/apikey

### Session Settings

Configure in `server/services/geminiSessionManager.js`:

- `SESSION_TIMEOUT_MS`: Session expiration (default: 30 minutes)
- Cleanup interval: 10 minutes

### Storage Limits

Configure in `client/src/utils/copilotStorage.js`:

- `MAX_MESSAGES`: Maximum messages in localStorage (default: 50)

## Development

### Start Dev Servers

```bash
npm run dev
```

### Test Queries

1. Login to the app
2. Click chat bubble in bottom-right
3. Type questions and verify responses

### Add New Query Capabilities

1. Update tool definition in `server/services/geminiService.js`
2. Add validation in `server/services/queryBuilder.js`
3. Update whitelists as needed

## Troubleshooting

### "Unable to reach AI service"

- Check Gemini API key is set in `.env`
- Verify backend server is running
- Check browser console for network errors

### "Failed to execute query"

- Check PostgreSQL connection
- Verify user has check-ins data
- Review server logs for SQL errors

### Session not persisting

- Check localStorage is enabled in browser
- Verify conversation history is being saved
- Sessions expire after 30 minutes of inactivity

### Queries returning no results

- Verify filters match actual data (case-sensitive)
- Check date formats (YYYY-MM-DD)
- Try broader queries first

## Future Enhancements

- **Dynamic Visualizations**: Render charts/tables for certain queries
- **Rate Limiting**: Per-user daily limits
- **Query Suggestions**: Pre-populate common questions
- **Export**: Download query results
- **Voice Input**: Speech-to-text for mobile
- **Multi-language**: Support non-English queries
