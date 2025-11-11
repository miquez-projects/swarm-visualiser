# Architecture Documentation

## Copilot Chat - Thought Signature Handling

### Design Decision

We preserve complete Gemini response content (candidates[0].content) instead of manually extracting thought signatures.

### Rationale

Google's documentation states: "Always send the thought_signature back to the model inside its original Part" and recommends appending "the model's complete previous response to the conversation history."

By storing the complete content object, thought signatures are preserved automatically within their original Parts. This follows the standard pattern and requires no special handling.

### Implementation

**Backend (server/routes/copilot.js):**
- Returns complete `content` object from `result.response.candidates[0].content`
- No manual signature extraction

**Session Manager (server/services/geminiSessionManager.js):**
- Preserves complete `content.parts` array for assistant messages
- Sends back exact structure Gemini provided

**Frontend (client/src/components/copilot/CopilotChat.jsx):**
- Stores complete `content` object in message history
- Separate `text` field for UI display
- Complete content sent back to API for context preservation

### Reference
https://ai.google.dev/gemini-api/docs/function-calling
