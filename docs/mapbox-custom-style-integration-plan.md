# Mapbox Custom Style Integration Plan

Once you've created the custom style in Mapbox Studio (see `mapbox-custom-style-instructions.md`), these code changes are needed to use it.

## Prerequisites

- Custom style created and published in Mapbox Studio
- Style URL copied (format: `mapbox://styles/USERNAME/STYLE_ID`)

## Code Changes Required

### 1. Update Static Map Generator (Server)

**File:** `server/services/staticMapGenerator.js`

**Current code (line 7):**
```javascript
this.baseUrl = 'https://api.mapbox.com/styles/v1/mapbox/dark-v11/static';
```

**Change to:**
```javascript
// Replace USERNAME and STYLE_ID with your actual values
this.baseUrl = 'https://api.mapbox.com/styles/v1/USERNAME/STYLE_ID/static';
```

**Example:**
```javascript
this.baseUrl = 'https://api.mapbox.com/styles/v1/miquez/cm123abc456/static';
```

### 2. (Optional) Update Dynamic Map Fallback

The dynamic map already uses our custom `mapStyle.js`, so no changes needed there. However, if you want the dynamic map to use the Studio style instead (simpler, but less flexible):

**File:** `client/src/components/MapView.jsx`

Find where the map style is set and change to use the Studio style URL.

**Not recommended** - our custom `mapStyle.js` gives us more control and doesn't require network requests for the style definition.

## Testing

After making the changes:

1. **Test Static Maps:**
   - Go to Day in Life page
   - Check that static map images load with the new style
   - Verify the teal-tinted colors appear

2. **Test Dynamic Maps:**
   - Load the main map view
   - Verify colors match the static maps
   - Check at different zoom levels

## Rollback

If issues occur, revert the static map generator to:
```javascript
this.baseUrl = 'https://api.mapbox.com/styles/v1/mapbox/dark-v11/static';
```

## Environment Considerations

The custom style URL works in all environments (development, production) as long as:
- The Mapbox access token has permission to read the style
- The style is published (not just saved as draft)

If using different Mapbox accounts for dev/prod, you may need to:
- Make the style public, OR
- Create the style in both accounts, OR
- Use an environment variable for the style URL

## Summary Checklist

- [ ] Custom style created in Mapbox Studio
- [ ] Style published
- [ ] Style URL copied
- [ ] `staticMapGenerator.js` updated with new URL
- [ ] Static maps tested in Day in Life
- [ ] Dynamic maps verified to match
- [ ] Changes committed and pushed
