# AI Copilot Deployment Guide

## Overview

This guide covers deploying the AI Copilot feature to your existing Render + Vercel setup. The feature requires a Gemini API key and minimal configuration changes.

---

## Prerequisites

- Existing Render backend deployment
- Existing Vercel frontend deployment
- Google Gemini API key (free tier available)

---

## Step 1: Get a Gemini API Key

### 1.1 Visit Google AI Studio
Go to: https://aistudio.google.com/app/apikey

### 1.2 Create API Key
1. Sign in with your Google account
2. Click "Get API key" or "Create API key"
3. Select "Create API key in new project" (or use existing project)
4. Copy the API key (starts with `AIza...`)

### 1.3 Important Notes
- **Free Tier:** 60 requests per minute, plenty for personal use
- **Pricing:** Current pricing at https://ai.google.dev/pricing
- **Security:** Never commit this key to git or share publicly

---

## Step 2: Configure Render (Backend)

### 2.1 Add Environment Variable

1. Go to your Render dashboard
2. Select your backend service (swarm-visualizer or similar)
3. Go to "Environment" tab
4. Click "Add Environment Variable"
5. Add:
   ```
   Key: GEMINI_API_KEY
   Value: [paste your API key here]
   ```
6. Click "Save Changes"

### 2.2 Verify Existing Variables

Ensure these are still set (should already exist):
```bash
DATABASE_URL=postgresql://...
ENCRYPTION_KEY=your_encryption_key
PORT=3001
NODE_ENV=production
```

### 2.3 Deploy Changes

**If deploying from a PR branch:**
1. Render will auto-deploy when you push the PR branch
2. OR manually trigger deploy from Render dashboard

**If deploying from main:**
1. Merge the PR to main
2. Render will auto-deploy

---

## Step 3: Configure Vercel (Frontend)

### 3.1 No Changes Needed!

The frontend uses the existing `REACT_APP_API_URL` environment variable, which should already be set to your Render backend URL.

**Verify in Vercel:**
1. Go to your Vercel project
2. Settings → Environment Variables
3. Confirm `REACT_APP_API_URL` is set to your Render backend URL (e.g., `https://swarm-visualizer.onrender.com`)

### 3.2 Deploy Frontend

**If deploying from a PR branch:**
1. Push the branch to GitHub
2. Vercel will create a preview deployment automatically
3. Test the preview URL before merging

**If deploying from main:**
1. Merge the PR to main
2. Vercel will auto-deploy production

---

## Step 4: Test the Deployment

### 4.1 Backend Health Check

Test the backend is running:
```bash
curl https://your-backend.onrender.com/health
```

Expected response:
```json
{"status":"ok","timestamp":"2025-11-03T..."}
```

### 4.2 Test AI Copilot

1. Visit your deployed frontend URL
2. Login with Foursquare OAuth
3. Look for the chat bubble in bottom-right corner
4. Click the chat bubble to open
5. Type a test question: "How many check-ins do I have?"
6. Verify you get a response

### 4.3 Check Backend Logs

In Render dashboard:
1. Go to your service
2. Click "Logs" tab
3. Look for:
   ```
   Gemini session cleanup interval started
   Server running on port 3001
   ```

### 4.4 Common Test Questions

Try these to verify it works:
- "How many check-ins do I have?"
- "What are my top 3 countries?"
- "Where did I last check in?"
- "How many check-ins per month in 2024?"

---

## Step 5: Rollback Plan (If Something Breaks)

### Option A: Rollback via Render

1. Go to Render dashboard
2. Click your service
3. Go to "Events" tab
4. Find the previous successful deployment
5. Click "Rollback to this version"

### Option B: Rollback via Git

**If you used a PR and merged:**
```bash
# In your main repository (not worktree)
git revert -m 1 <merge-commit-sha>
git push origin main
```

**If you haven't merged yet:**
- Simply close the PR
- Don't merge to main
- Your production stays on the current version

### Option C: Revert on Vercel

1. Go to Vercel dashboard
2. Click your project
3. Go to "Deployments" tab
4. Find the previous working deployment
5. Click "..." → "Promote to Production"

---

## Deployment Strategy Recommendations

### Recommended: Deploy PR Branch First

This is the safest approach:

1. **Push the feature branch** (we'll do this next)
2. **Render creates a preview** (if configured) or deploys to staging
3. **Vercel creates a preview** at a preview URL
4. **Test the preview URLs** thoroughly
5. **If it works:** Merge PR → production deploys automatically
6. **If it breaks:** Close PR, production unchanged

### Steps We'll Take:

```bash
# 1. Push the branch
git push -u origin feature/ai-copilot

# 2. Create PR (we'll do this with gh CLI)
gh pr create --title "Add AI Copilot feature" --body "..."

# 3. Get preview URLs from Render and Vercel
# 4. Test preview
# 5. Merge if successful
```

---

## Environment Variables Summary

### Backend (Render)

| Variable | Value | Required |
|----------|-------|----------|
| `GEMINI_API_KEY` | Your Gemini API key | **NEW - REQUIRED** |
| `DATABASE_URL` | PostgreSQL connection string | Existing |
| `ENCRYPTION_KEY` | 64-char hex string | Existing |
| `PORT` | 3001 | Existing |
| `NODE_ENV` | production | Existing |

### Frontend (Vercel)

| Variable | Value | Required |
|----------|-------|----------|
| `REACT_APP_API_URL` | Your Render backend URL | Existing |

**No new frontend variables needed!**

---

## Architecture Changes Summary

### What Was Added

**Backend:**
- `server/services/geminiService.js` - Gemini AI integration
- `server/services/geminiSessionManager.js` - Session management
- `server/services/queryBuilder.js` - Secure SQL query builder
- `server/routes/copilot.js` - AI chat API endpoint
- Dependency: `@google/generative-ai@^0.24.1`

**Frontend:**
- `client/src/components/copilot/*` - Chat UI components
- `client/src/utils/copilotStorage.js` - localStorage utilities
- Updated `client/src/App.js` - Integrated chat bubble

**Documentation:**
- `docs/AI_COPILOT.md` - Feature documentation
- `docs/AI_COPILOT_DEPLOYMENT.md` - This file

### What Stayed the Same

- Database schema (no migrations needed)
- Authentication system (unchanged)
- Existing API endpoints (unchanged)
- Environment variable structure (one new variable)

---

## Security Considerations

### Gemini API Key Security

✅ **Stored in environment variable** (not in code)
✅ **Never exposed to frontend** (backend only)
✅ **Not committed to git** (in .env, which is gitignored)
✅ **Validated on startup** (app won't start without it)

### User Data Security

✅ **All queries user-scoped** (can't access other users' data)
✅ **SQL injection prevented** (parameterized queries)
✅ **Field whitelisting** (only allowed fields queried)
✅ **Authentication required** (all endpoints protected)

---

## Monitoring

### What to Monitor

1. **Gemini API Usage:**
   - Check your Google AI Studio dashboard
   - Monitor request count vs. free tier limits
   - Set up billing alerts if needed

2. **Backend Logs (Render):**
   - Look for "Gemini session cleanup" messages
   - Watch for query execution errors
   - Monitor session count

3. **Error Rates:**
   - Check Render metrics for 500 errors
   - Monitor frontend console for API errors

### Setting Up Alerts

**Render:**
1. Go to service settings
2. Enable "Email on deploy" notifications
3. Monitor deployment success/failure

**Google AI Studio:**
1. Go to https://aistudio.google.com
2. Check "Activity" for usage metrics
3. Set up quota alerts if available

---

## Troubleshooting

### "Unable to reach AI service"

**Cause:** Gemini API key missing or invalid

**Fix:**
1. Check Render environment variables
2. Verify `GEMINI_API_KEY` is set
3. Verify key is valid (test at https://aistudio.google.com)
4. Redeploy backend

### "Failed to execute query"

**Cause:** Database connection or SQL error

**Fix:**
1. Check Render logs for SQL errors
2. Verify `DATABASE_URL` is correct
3. Check database is accessible from Render

### Chat bubble doesn't appear

**Cause:** Not logged in or frontend build issue

**Fix:**
1. Ensure you're logged in (OAuth)
2. Check browser console for errors
3. Verify frontend deployed successfully
4. Clear browser cache and reload

### Session not persisting

**Cause:** Browser localStorage disabled or backend restart

**Fix:**
1. Check browser allows localStorage
2. Sessions expire after 30 minutes (expected)
3. Restarting backend clears sessions (expected)

---

## Cost Estimates

### Gemini API (Free Tier)

- **Requests:** 60 per minute
- **Monthly:** ~2.5 million requests (way more than needed)
- **Cost:** $0 (free tier)

**Paid Tier (if you exceed):**
- Gemini 1.5 Flash: ~$0.075 per 1M input tokens
- For personal use, free tier is more than enough

### Render (Existing)

No additional cost - uses existing backend deployment

### Vercel (Existing)

No additional cost - uses existing frontend deployment

---

## Next Steps After Deployment

### Optional Enhancements

1. **Rate Limiting:**
   - Add per-user rate limits in `server/routes/copilot.js`
   - Prevent abuse of AI endpoints

2. **Analytics:**
   - Track copilot usage (questions asked, response times)
   - Monitor popular query types

3. **Query Suggestions:**
   - Add suggested questions to chat UI
   - Help users discover capabilities

4. **Voice Input:**
   - Add speech-to-text for mobile users
   - Requires additional API (e.g., Web Speech API)

### Monitoring Best Practices

1. **Weekly:** Check Gemini API usage
2. **Monthly:** Review error logs
3. **After deploys:** Test copilot functionality
4. **User feedback:** Monitor for issues

---

## Support Resources

- **Gemini API Docs:** https://ai.google.dev/docs
- **Render Docs:** https://render.com/docs
- **Vercel Docs:** https://vercel.com/docs
- **Feature Docs:** `docs/AI_COPILOT.md`

---

## Deployment Checklist

Use this checklist when deploying:

### Pre-Deployment
- [ ] Get Gemini API key from https://aistudio.google.com/app/apikey
- [ ] Add `GEMINI_API_KEY` to Render environment variables
- [ ] Verify `REACT_APP_API_URL` in Vercel

### Deployment
- [ ] Push feature branch to GitHub
- [ ] Create Pull Request
- [ ] Get Vercel preview URL
- [ ] Get Render preview URL (if applicable)
- [ ] Test preview deployments

### Testing
- [ ] Backend health check passes
- [ ] Chat bubble appears when logged in
- [ ] Can send messages and receive responses
- [ ] Test 3-5 different question types
- [ ] Check backend logs for errors

### Post-Deployment
- [ ] Merge PR to main (if tests pass)
- [ ] Verify production deployment
- [ ] Test production URLs
- [ ] Monitor logs for 24 hours
- [ ] Set up usage monitoring

### Rollback (if needed)
- [ ] Use Render/Vercel rollback feature
- [ ] Or revert git commit
- [ ] Verify rollback successful
- [ ] Document what went wrong

---

## Ready to Deploy?

Once you've:
1. Obtained your Gemini API key
2. Added it to Render environment variables
3. Reviewed this guide

We can proceed with:
```bash
# Push the branch and create PR
git push -u origin feature/ai-copilot
gh pr create --title "Add AI Copilot feature" --body "..."
```

Then test the preview deployments before merging to production!

