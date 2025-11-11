# Fix Gemini Thought Signatures Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix thought signature architecture to follow Google's recommended pattern of preserving complete response structure instead of manually extracting signatures.

**Architecture:** Currently manually extracting thought signatures as separate fields. Google's docs say "No code changes are required" if you preserve the complete response content. Refactor to store entire `candidates[0].content` from Gemini responses and send complete parts array back in conversation history.

**Tech Stack:** Node.js, Express, @google/generative-ai SDK, React, localStorage

**Reference:** https://ai.google.dev/gemini-api/docs/function-calling (multi-turn with thinking)

---

## Task 1: Refactor Backend to Store Complete Response Content

**Files:**
- Modify: `server/routes/copilot.js:146-180`
- Modify: `server/routes/copilot.js:34`
- Modify: `server/routes/copilot.js:61-66`
- Modify: `server/routes/copilot.js:80-88`
- Modify: `server/routes/copilot.js:112-117`
- Modify: `server/routes/copilot.js:131-139`
- Modify: `server/routes/copilot.js:167-180`

### Step 1: Remove thought signature extraction logic

Remove the manual thought signature extraction code (lines 146-165) and simplify to just extract text for display.

**In `server/routes/copilot.js`**, replace lines 146-180 with:

```javascript
      // Get response text for display
      const responseText = result.response.text();
      console.log('Final AI response:', responseText);

      // Get complete response content (includes thought signatures automatically)
      const completeContent = result.response.candidates[0].content;
      console.log('Complete content parts:', completeContent.parts.length);

      // Return response with complete content for history preservation
      res.json({
        response: responseText,
        content: completeContent
      });
```

**Why:** Google's docs say thought signatures are preserved automatically in the complete content object. We don't need to extract them manually.

### Step 2: Verify the change doesn't break anything

Run: `node server/index.js`

Expected: Server starts without errors

### Step 3: Commit

```bash
git add server/routes/copilot.js
git commit -m "refactor: remove manual thought signature extraction

Store complete response content instead of extracting thought signatures
manually. Follows Google's recommended pattern from function calling docs."
```

---

## Task 2: Update Session Manager to Use Complete Parts

**Files:**
- Modify: `server/services/geminiSessionManager.js:87-141`

### Step 1: Refactor formatHistory to preserve complete parts

The current implementation converts messages to Gemini format. We need to change it to preserve the complete `content` object for assistant messages.

**In `server/services/geminiSessionManager.js`**, replace the `formatHistory` function (lines 87-141) with:

```javascript
  /**
   * Format conversation history for Gemini API
   * Preserves complete content structure including thought signatures
   */
  formatHistory(conversationHistory) {
    if (!conversationHistory || conversationHistory.length === 0) {
      return [];
    }

    // Validate conversation history structure
    if (!Array.isArray(conversationHistory)) {
      throw new Error('conversationHistory must be an array');
    }

    return conversationHistory
      .filter((msg, index) => {
        // Skip invalid messages instead of throwing
        if (!msg || typeof msg !== 'object') {
          console.warn(`Skipping invalid message at index ${index}: not an object`);
          return false;
        }
        if (!msg.role || typeof msg.role !== 'string') {
          console.warn(`Skipping invalid message at index ${index}: invalid role`);
          return false;
        }
        if (!['user', 'assistant', 'model'].includes(msg.role)) {
          console.warn(`Skipping invalid message at index ${index}: invalid role value`);
          return false;
        }
        return true;
      })
      .map((msg) => {
        // For assistant messages with complete content, use it directly
        if ((msg.role === 'assistant' || msg.role === 'model') && msg.content) {
          // msg.content is the complete candidates[0].content from Gemini
          // It already has the correct structure with parts and thought signatures
          return {
            role: 'model',
            parts: msg.content.parts || []
          };
        }

        // For user messages or assistant messages without complete content
        const messageText = typeof msg.content === 'string' ? msg.content :
                           (msg.text || '');

        if (!messageText || messageText.trim().length === 0) {
          console.warn(`Skipping empty message content`);
          return null;
        }

        return {
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: messageText }]
        };
      })
      .filter(msg => msg !== null);
  }
```

**Why:** This preserves the complete `content` object (with all parts including thought signatures) for assistant messages, while still supporting simple text messages for backwards compatibility.

### Step 2: Verify no syntax errors

Run: `node --check server/services/geminiSessionManager.js`

Expected: No output (file is valid)

### Step 3: Commit

```bash
git add server/services/geminiSessionManager.js
git commit -m "refactor: preserve complete content structure in history

Format history to use complete Gemini content object for assistant
messages, preserving all parts including thought signatures automatically."
```

---

## Task 3: Update Frontend to Store Complete Content

**Files:**
- Modify: `client/src/components/copilot/CopilotChat.jsx:78-90`

### Step 1: Update message storage to include complete content

**In `client/src/components/copilot/CopilotChat.jsx`**, replace lines 78-90 with:

```javascript
    try {
      // Send to API
      const response = await sendCopilotMessage(message, messages, token);

      // Add AI response with complete content for history preservation
      const aiMessage = {
        role: 'assistant',
        content: response.content, // Complete Gemini content object with all parts
        text: response.response,    // Text for display
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (err) {
```

**Why:** Store the complete `content` object (which includes thought signatures automatically) alongside the display text. The content object will be sent back in conversation history.

### Step 2: Update message display to use text field

**In `client/src/components/copilot/CopilotChat.jsx`**, find the message mapping (around line 189-197) and update to use the text field for display:

```javascript
            {messages.map((msg, index) => (
              <ChatMessage
                key={index}
                role={msg.role}
                content={msg.text || msg.content} // Use text for display, fallback to content
                timestamp={msg.timestamp}
                onVenueClick={handleVenueClick}
              />
            ))}
```

**Why:** Display uses the text string, but complete content is preserved in message history for API calls.

### Step 3: Verify no syntax errors

Run: `npx eslint client/src/components/copilot/CopilotChat.jsx`

Expected: No errors (warnings are okay)

### Step 4: Commit

```bash
git add client/src/components/copilot/CopilotChat.jsx
git commit -m "refactor: store complete content alongside display text

Store complete Gemini content object (with thought signatures) for history,
while keeping text field for UI display."
```

---

## Task 4: Clear Existing localStorage and Test

**Files:**
- Test: Manual browser testing

### Step 1: Document localStorage migration

Create a note for users about clearing old data.

**Create `docs/CHANGELOG.md`** (or append if exists):

```markdown
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
```

### Step 2: Test the complete flow

**Start the server:**
```bash
npm start
```

**Expected:** Server starts on port 3000

**In browser (http://localhost:3000):**
1. Open DevTools > Application > Local Storage
2. Delete `copilot_chat_history` if it exists
3. Open copilot chat
4. Send a query that triggers function calling: "Where did I last check in in Slovenia?"
5. Check browser console for "Complete content parts:" log
6. Send follow-up question: "What about before that?"
7. Verify conversation context is maintained

**Expected:**
- First query returns results
- Follow-up question understands context
- No errors in console
- Backend logs show complete content parts being sent

### Step 3: Verify thought signatures are working

Check server logs for evidence that Gemini is receiving complete content:

```bash
# Look for the complete content logs
tail -50 server-logs.txt | grep "Complete content"
```

**Expected:** See logs showing parts arrays with multiple elements when function calling occurs

### Step 4: Final commit

```bash
git add docs/CHANGELOG.md
git commit -m "docs: add migration note for thought signature changes

Document breaking change in conversation history format and provide
instructions for clearing old localStorage data."
```

---

## Task 5: Verify Against Google's Documentation

**Files:**
- Reference: Google's function calling docs

### Step 1: Review implementation against docs

Read: https://ai.google.dev/gemini-api/docs/function-calling

**Key verification points:**
- ✅ "Always send the thought_signature back to the model inside its original Part" - YES, we preserve complete parts
- ✅ "Append the model's complete previous response to the conversation history" - YES, we store complete content object
- ✅ "No code changes are required" when following standard pattern - YES, we let SDK handle it automatically
- ✅ Don't merge Parts with/without signatures - YES, we preserve exact structure

### Step 2: Document architecture decision

**Create `docs/ARCHITECTURE.md`** section (or append if exists):

```markdown
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
```

### Step 3: Commit

```bash
git add docs/ARCHITECTURE.md
git commit -m "docs: document thought signature architecture decision

Explain why we preserve complete content instead of manual extraction,
with references to Google's official documentation."
```

---

## Task 6: Test Multi-Turn Conversation with Function Calling

**Files:**
- Test: End-to-end testing

### Step 1: Test complex multi-turn scenario

**Test case 1: Multiple function calls in one turn**

Query: "Where have I checked in the most? And what categories are those places?"

Expected:
- Gemini calls query_checkins function
- Then calls get_categories function
- Thought signatures preserved between calls
- Final response answers both questions

**Test case 2: Follow-up context retention**

Query 1: "Show me my check-ins in Paris"
Query 2: "What about the one closest to the Eiffel Tower?"

Expected:
- Query 2 understands "the one" refers to Paris check-ins
- Context maintained across turns
- No "I don't have that context" errors

### Step 2: Monitor for 503 errors

Run multiple queries in succession and check error rate.

**Expected:**
- 503 errors are transient Google capacity issues (not our bug)
- If they occur, they should be infrequent
- No correlation with conversation history size

### Step 3: Verify localStorage size is reasonable

Check browser DevTools > Application > Local Storage > copilot_chat_history

**Expected:**
- Size is larger than before (storing complete content)
- But still reasonable (< 1MB for 50 messages)
- MAX_MESSAGES limit (50) prevents unbounded growth

### Step 4: Document test results

```bash
# Add test results to a test log
echo "## Multi-Turn Function Calling Test Results

Date: $(date)

Test Case 1: Multiple function calls
- Status: [PASS/FAIL]
- Notes: [observations]

Test Case 2: Context retention
- Status: [PASS/FAIL]
- Notes: [observations]

503 Error Rate: [X/Y requests]
LocalStorage Size: [size in KB]

" > docs/test-results-thought-signatures.md

git add docs/test-results-thought-signatures.md
git commit -m "test: document thought signature implementation results"
```

---

## Verification Checklist

Before considering this plan complete, verify:

- [ ] Server starts without errors
- [ ] Frontend builds without errors
- [ ] Simple chat queries work (no function calling)
- [ ] Function calling queries work
- [ ] Multi-turn conversations maintain context
- [ ] Thought signatures appear in backend logs
- [ ] No manual signature extraction code remains
- [ ] localStorage contains complete content objects
- [ ] Documentation updated
- [ ] All changes committed with descriptive messages

---

## Rollback Plan

If this refactoring causes issues:

```bash
# Revert all commits from this refactoring
git log --oneline -6  # Find the commit before refactoring started
git revert --no-commit HEAD~5..HEAD  # Revert last 5 commits
git commit -m "revert: rollback thought signature refactoring"
```

The old implementation (with manual signature extraction) will continue working, though it doesn't follow Google's recommended pattern.

---

## Additional Notes

**Why the old implementation seemed to work:**
- It was extracting function call parts (which happen to have thoughtSignature properties)
- These were being sent back, so some context was preserved
- But we were potentially duplicating function calls in history

**Why the new implementation is better:**
- Follows Google's official recommendations exactly
- Simpler code (let SDK handle it automatically)
- More maintainable (less custom logic)
- Preserves exact structure Gemini expects
- No risk of accidentally breaking signature relationships
