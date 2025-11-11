## 2025-11-11 - Thought Signature Architecture Fix

### Breaking Change

Conversation history format has changed to properly preserve Gemini thought signatures.

**Action Required:** Clear browser localStorage for copilot chat:
1. Open browser DevTools (F12)
2. Go to Application > Local Storage
3. Delete `copilot_chat_history` key
4. Refresh page

### Technical Details

- Now stores complete Gemini response content (with all parts) instead of manually extracting thought signatures
- Follows Google's recommended pattern from function calling documentation
- Thought signatures are preserved automatically within response structure
