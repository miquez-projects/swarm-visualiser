# Implementation Plan: Sync Progress UI & Photo Caching

**Date**: 2025-01-14
**Status**: Planning
**Priority**: Medium

## Overview

Two features to improve UX and performance:
1. **Sync Progress UI**: Real-time progress updates during data sync
2. **Photo Caching**: Lazy caching of Foursquare photos accessed by users

---

## Feature 1: Sync Progress UI

### Goal
Show real-time sync progress with batch updates to improve user experience during long-running sync operations.

### Architecture Decision

**Options Considered**:
- **Option A: Polling** - Client polls `/api/import/jobs/:jobId` every 2-3 seconds
- **Option B: WebSocket** - Real-time updates via Socket.io
- **Option C: Server-Sent Events (SSE)** - One-way real-time stream

**Recommended: Option A (Polling)**
- No additional dependencies
- Works with existing REST API
- Sync jobs are relatively slow (minutes), so polling overhead is minimal
- Easier to deploy (no WebSocket infrastructure needed)

### Implementation Steps

#### 1. Backend Changes

**Modify `/api/import/jobs/:jobId` endpoint**:
```javascript
// Return current progress
{
  id: 21,
  status: 'active' | 'completed' | 'failed',
  totalExpected: 26736,
  totalImported: 14200,
  currentBatch: 142,
  startedAt: '2025-01-14T13:05:47Z',
  completedAt: null,
  error: null
}
```

#### 2. Frontend - Progress Bar (Data Sources Page)

**Create `SyncProgressBar.jsx` component**:
```jsx
- Poll job status every 2 seconds while status === 'active'
- Display linear progress bar: (totalImported / totalExpected) * 100
- Show batch info: "Batch 142/268 - 14,200/26,736 check-ins"
- Stop polling when status === 'completed' || status === 'failed'
- Show success/error message on completion
```

**Integration**:
- Add to DataSourcesPage.jsx
- Show when sync job is active
- Hide when no active jobs

#### 3. Frontend - Toast Notification (Other Pages)

**Create global `SyncToast.jsx` component**:
```jsx
- Add to Layout.jsx (global component)
- Show toast when sync starts (from context menu)
- Poll job status every 3 seconds
- Display: "Syncing... 53% (14,200/26,736)"
- Auto-dismiss when complete
- Show success/error message
```

**Integration**:
- Add to Layout component
- Trigger from context menu "Sync all data"
- Persist across page navigation

#### 4. UX Flow

```
User clicks "Sync all data"
  ↓
API returns { jobId: 21, status: 'queued' }
  ↓
If on Data Sources page:
  → Show SyncProgressBar
If on other page:
  → Show SyncToast notification
  ↓
Poll /api/import/jobs/21 every 2-3s
  ↓
Update UI with progress
  ↓
When complete:
  → Refresh data
  → Hide progress UI
  → Show success message
```

### Files to Create/Modify

**Backend**:
- [ ] `/server/routes/import.js` - Add GET /jobs/:jobId endpoint

**Frontend**:
- [ ] `/client/src/components/SyncProgressBar.jsx` - Progress bar component
- [ ] `/client/src/components/SyncToast.jsx` - Toast notification component
- [ ] `/client/src/pages/DataSourcesPage.jsx` - Integrate progress bar
- [ ] `/client/src/components/Layout.jsx` - Integrate toast
- [ ] `/client/src/components/ContextMenu.jsx` - Pass jobId to Layout

### Estimated Effort
~200 lines of code, 3-4 hours development + testing

---

## Feature 2: Lazy Photo Caching Proxy

### Goal
Cache only accessed photos to save bandwidth and improve load times. Photos are fetched from Foursquare CDN on first access and served from local cache on subsequent requests.

### Architecture

```
Client Request
  ↓
GET /api/photos/proxy?url={foursquare_cdn_url}
  ↓
Check local cache (filesystem)
  ↓ (cache miss)
Fetch from Foursquare CDN
  ↓
Save to cache
  ↓
Return to client (with Cache-Control headers)
```

### Design Decisions

#### Storage Location
**Option A: Local filesystem** (`/server/cache/photos/`)
- ✅ Simple to implement
- ✅ No additional cost
- ✅ Fast access
- ❌ Limited by server disk space
- ❌ Lost on server restart (Render ephemeral storage)

**Option B: S3/Cloudflare R2**
- ✅ Persistent storage
- ✅ Unlimited capacity
- ✅ CDN integration
- ❌ Additional cost
- ❌ More complex setup

**Recommendation**: Start with **Option A (filesystem)** for simplicity. Migrate to S3 later if needed.

#### Cache Key Generation
Use SHA-256 hash of original URL:
```javascript
const crypto = require('crypto');
const cacheKey = crypto.createHash('sha256')
  .update(url)
  .digest('hex');
// Example: 8f3a2b...c9d1.jpg
```

#### Cache Expiration
**Recommendation**: Cache indefinitely
- Photos don't change once uploaded
- Implement manual cache clear endpoint if needed

### Implementation Steps

#### 1. Backend - Photo Proxy Endpoint

**Create `/server/routes/photoProxy.js`**:

```javascript
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

const CACHE_DIR = path.join(__dirname, '../cache/photos');
const ALLOWED_DOMAINS = ['fastly.4sqi.net', 'foursquare.com'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// GET /api/photos/proxy?url={encoded_url}
router.get('/proxy', async (req, res) => {
  const { url } = req.query;

  // 1. Validate URL
  if (!isValidFoursquareUrl(url)) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  // 2. Generate cache key
  const cacheKey = crypto.createHash('sha256').update(url).digest('hex');
  const ext = path.extname(new URL(url).pathname) || '.jpg';
  const cachePath = path.join(CACHE_DIR, `${cacheKey}${ext}`);

  // 3. Check cache
  try {
    await fs.access(cachePath);
    // Cache hit - serve from cache
    return res.sendFile(cachePath, {
      headers: {
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Cache': 'HIT'
      }
    });
  } catch (err) {
    // Cache miss - fetch from Foursquare
  }

  // 4. Fetch from Foursquare
  try {
    const response = await axios.get(url, {
      responseType: 'stream',
      maxContentLength: MAX_FILE_SIZE
    });

    // 5. Save to cache (create directory if needed)
    await fs.mkdir(CACHE_DIR, { recursive: true });
    const writeStream = fs.createWriteStream(cachePath);

    // 6. Pipe to both cache and response
    response.data.pipe(writeStream);
    response.data.pipe(res);

    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Type', response.headers['content-type']);
    res.setHeader('X-Cache', 'MISS');

  } catch (error) {
    console.error('Photo fetch error:', error.message);
    return res.status(500).json({ error: 'Failed to fetch photo' });
  }
});

function isValidFoursquareUrl(url) {
  try {
    const parsed = new URL(url);
    return ALLOWED_DOMAINS.some(domain => parsed.hostname.includes(domain));
  } catch {
    return false;
  }
}

module.exports = router;
```

#### 2. Cache Management

**Setup**:
- Create `/server/cache/photos/` directory
- Add to `.gitignore`:
  ```
  /server/cache/
  ```

**Cleanup endpoint (optional)**:
```javascript
// DELETE /api/photos/cache (admin only)
router.delete('/cache', requireAdmin, async (req, res) => {
  await fs.rm(CACHE_DIR, { recursive: true, force: true });
  await fs.mkdir(CACHE_DIR, { recursive: true });
  res.json({ message: 'Cache cleared' });
});
```

#### 3. Frontend Changes

**Modify `VenuePhotosGallery.jsx`**:

```jsx
// Transform photo URLs to use proxy
const allPhotos = photoGroups.flatMap(group =>
  group.photos.map(photo => ({
    src: `/api/photos/proxy?url=${encodeURIComponent(photo.url)}`,
    width: photo.width || 800,
    height: photo.height || 600
  }))
);

// Apply to both thumbnail grid AND lightbox slides
<CardMedia
  component="img"
  image={`/api/photos/proxy?url=${encodeURIComponent(photo.url)}`}
  alt={`Photo from ${new Date(group.date).toLocaleDateString()}`}
  sx={{
    height: 150,
    objectFit: 'cover'
  }}
/>
```

#### 4. Database Schema (Optional - for cache metadata)

```sql
CREATE TABLE IF NOT EXISTS photo_cache (
  id SERIAL PRIMARY KEY,
  original_url TEXT UNIQUE NOT NULL,
  cache_key VARCHAR(64) NOT NULL,
  file_size BIGINT,
  cached_at TIMESTAMP DEFAULT NOW(),
  last_accessed_at TIMESTAMP DEFAULT NOW(),
  access_count INTEGER DEFAULT 1
);

-- Index for lookups
CREATE INDEX idx_photo_cache_url ON photo_cache(original_url);
CREATE INDEX idx_photo_cache_key ON photo_cache(cache_key);
```

**Benefits of DB tracking**:
- Monitor cache size
- Track access patterns
- Implement LRU eviction
- Generate analytics

### Security Considerations

1. **SSRF Prevention**:
   - Validate URL is from Foursquare domains only
   - Reject localhost, private IPs, etc.

2. **Rate Limiting**:
   - Limit requests per IP (e.g., 100/minute)
   - Prevent abuse/crawling

3. **File Size Limits**:
   - Max 10MB per photo
   - Prevent disk exhaustion

4. **Input Validation**:
   - Validate URL format
   - Sanitize filenames
   - Prevent path traversal

### Performance Optimizations

1. **Streaming**: Don't load entire file into memory
2. **Cache Headers**: Set `max-age=31536000, immutable`
3. **ETag Support**: Add for better caching
4. **Compression**: Enable gzip/brotli for responses
5. **CDN**: Consider Cloudflare in front of Render

### Files to Create/Modify

**Backend**:
- [ ] `/server/routes/photoProxy.js` - New proxy endpoint
- [ ] `/server/server.js` - Register photo proxy route
- [ ] `/server/cache/photos/` - Cache directory (add to .gitignore)

**Frontend**:
- [ ] `/client/src/components/VenuePhotosGallery.jsx` - Use proxy URLs

**Config**:
- [ ] `.gitignore` - Add `/server/cache/`
- [ ] `render.yaml` or Render dashboard - Ensure disk space available

### Estimated Effort
~150-200 lines of code, 3-4 hours development + testing

---

## Testing Plan

### Sync Progress UI
- [ ] Start sync from Data Sources page → progress bar appears
- [ ] Start sync from context menu → toast appears
- [ ] Navigate between pages → toast persists
- [ ] Wait for completion → success message shown
- [ ] Trigger failed sync → error message shown
- [ ] Multiple concurrent syncs → handle gracefully

### Photo Caching
- [ ] First photo load → cache MISS, saved to disk
- [ ] Second photo load → cache HIT, served from disk
- [ ] Invalid URL → 400 error
- [ ] Non-Foursquare URL → 400 error
- [ ] Large file (>10MB) → 500 error or truncated
- [ ] Cache directory doesn't exist → created automatically
- [ ] Check X-Cache header → HIT/MISS correctly set

---

## Deployment Notes

### Render Considerations

**Ephemeral Storage**:
- Render's free tier has ephemeral disk storage
- Cache will be lost on server restart
- Consider upgrading to persistent disk or migrate to S3 for production

**Disk Space**:
- Monitor cache directory size
- Implement automatic cleanup if needed
- Default Render disk limit: ~512MB-1GB

### Environment Variables

None required for initial implementation.

---

## Future Enhancements

1. **Sync Progress**:
   - Add progress graph/chart
   - Show estimated time remaining
   - Historical sync performance metrics

2. **Photo Caching**:
   - Migrate to S3/R2 for persistence
   - Implement LRU cache eviction
   - Add image optimization (WebP conversion, resizing)
   - Pre-cache popular photos
   - Analytics dashboard for cache performance

---

## Questions/Decisions Needed

- [ ] Sync Progress: Confirm polling approach is acceptable
- [ ] Photo Caching: Filesystem vs S3 for initial implementation
- [ ] Photo Caching: Implement DB tracking table?
- [ ] Photo Caching: Cache size limits/eviction strategy?

---

## References

- Import job tracking: `/server/models/importJob.js`
- Photo fetching: `/server/services/api.js` → `getVenuePhotos()`
- Current implementation: `/client/src/components/VenuePhotosGallery.jsx`
