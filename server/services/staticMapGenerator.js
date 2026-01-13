const polyline = require('@mapbox/polyline');

class StaticMapGenerator {
  constructor() {
    this.mapboxToken = process.env.MAPBOX_TOKEN;
    // Use dark style to match the app's cartographic theme
    this.baseUrl = 'https://api.mapbox.com/styles/v1/mapbox/dark-v11/static';
    // Design system colors
    this.colors = {
      interactive: 'ff6b35', // Orange for markers and check-in paths
      data: '2d9a8c',        // Teal for activity tracklogs
    };
  }

  generateCheckinMapUrl(checkins, width = 600, height = 400) {
    if (checkins.length === 0) return null;

    // Create curved path through checkins
    const coords = checkins.map(c => [c.longitude, c.latitude]);
    const encodedPath = this.createCurvedPath(coords);

    // Calculate dynamic threshold based on map bounds
    const threshold = this.calculateDynamicThreshold(checkins);

    // Group overlapping markers
    const markerGroups = this.groupNearbyCheckins(checkins, threshold);

    // Add markers - use larger pins for grouped checkins
    const markers = markerGroups
      .map(group => {
        const firstNum = group.indices[0] + 1;
        const lastNum = group.indices[group.indices.length - 1] + 1;

        if (group.indices.length === 1) {
          // Single checkin - small pin
          return `pin-s-${firstNum}+${this.colors.interactive}(${group.longitude},${group.latitude})`;
        } else if (group.indices.length === 2) {
          // Two checkins - medium pin with first number
          return `pin-m-${firstNum}+${this.colors.interactive}(${group.longitude},${group.latitude})`;
        } else {
          // Three or more checkins - large pin with first number
          return `pin-l-${firstNum}+${this.colors.interactive}(${group.longitude},${group.latitude})`;
        }
      })
      .join(',');

    // Auto-fit bounds
    // URL-encode the polyline to handle special characters
    const urlEncodedPath = encodeURIComponent(encodedPath);
    const path = `path-2+${this.colors.interactive}-0.5(${urlEncodedPath})`;

    return `${this.baseUrl}/${path},${markers}/auto/${width}x${height}@2x?access_token=${this.mapboxToken}`;
  }

  calculateDynamicThreshold(checkins) {
    if (checkins.length === 0) return 50; // Default fallback

    // Calculate the bounding box
    const lats = checkins.map(c => c.latitude);
    const lons = checkins.map(c => c.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);

    // Calculate the diagonal distance of the bounding box
    const diagonalDistance = this.calculateDistance(minLat, minLon, maxLat, maxLon);

    // Use 2.5% of the diagonal as the grouping threshold
    // This means pins need to be at least 2.5% of the map width apart to not group
    // At typical Mapbox static map sizes, this prevents visual overlap
    const threshold = Math.max(10, diagonalDistance * 0.025);

    return threshold;
  }

  groupNearbyCheckins(checkins, thresholdMeters = 50) {
    const groups = [];
    const used = new Set();

    for (let i = 0; i < checkins.length; i++) {
      if (used.has(i)) continue;

      const group = {
        longitude: checkins[i].longitude,
        latitude: checkins[i].latitude,
        indices: [i]
      };

      // Find all nearby checkins
      for (let j = i + 1; j < checkins.length; j++) {
        if (used.has(j)) continue;

        const distance = this.calculateDistance(
          checkins[i].latitude, checkins[i].longitude,
          checkins[j].latitude, checkins[j].longitude
        );

        if (distance <= thresholdMeters) {
          group.indices.push(j);
          used.add(j);
        }
      }

      groups.push(group);
      used.add(i);
    }

    return groups;
  }

  calculateDistance(lat1, lon1, lat2, lon2) {
    // Haversine formula to calculate distance in meters
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  generateActivityMapUrl(tracklogOrPolyline, width = 600, height = 400) {
    if (!tracklogOrPolyline) return null;

    let encodedPath;

    // Check if it's WKB hex format (starts with 01020000)
    if (tracklogOrPolyline.startsWith('01020000')) {
      console.warn('[StaticMap] WKB hex format detected, cannot parse directly');
      // WKB hex format - we need to convert via PostGIS ST_AsText
      // For now, return null as we can't parse this format client-side
      return null;
    }

    // Check if it's WKT format (Garmin) or polyline format (Strava)
    if (tracklogOrPolyline.startsWith('LINESTRING')) {
      // Garmin/Strava format: WKT "LINESTRING(lon lat, lon lat, ...)"
      const coords = this.parseLineString(tracklogOrPolyline);
      if (coords.length === 0) {
        console.error('[StaticMap] Failed to parse WKT tracklog');
        return null;
      }
      encodedPath = polyline.encode(coords.map(c => [c[1], c[0]])); // lat,lon for polyline
    } else {
      // Already encoded polyline
      encodedPath = tracklogOrPolyline;
    }

    // URL-encode the polyline to handle special characters
    const urlEncodedPath = encodeURIComponent(encodedPath);
    const path = `path-3+${this.colors.data}-0.8(${urlEncodedPath})`;

    return `${this.baseUrl}/${path}/auto/${width}x${height}@2x?access_token=${this.mapboxToken}`;
  }

  createCurvedPath(coords) {
    // Simple curve: encode coordinates with polyline
    // For production: implement bezier curves or use actual routing

    // Deduplicate consecutive identical coordinates to avoid ?? in polyline
    const uniqueCoords = coords.filter((coord, index) => {
      if (index === 0) return true;
      const prev = coords[index - 1];
      return coord[0] !== prev[0] || coord[1] !== prev[1];
    });

    const latLngs = uniqueCoords.map(c => [c[1], c[0]]); // Convert to lat,lng
    return polyline.encode(latLngs);
  }

  parseLineString(wkt) {
    // Parse "LINESTRING(lon lat, lon lat)" to [[lon, lat], ...]
    const match = wkt.match(/LINESTRING\((.*)\)/);
    if (!match) return [];

    return match[1].split(',').map(pair => {
      const [lon, lat] = pair.trim().split(' ').map(Number);
      return [lon, lat];
    });
  }

  generateActivityWithCheckinsMapUrl(tracklog, checkins, width = 600, height = 400) {
    if (!tracklog) return null;

    let encodedPath;

    // Check if it's WKB hex format (starts with 01020000)
    if (tracklog.startsWith('01020000')) {
      console.warn('[StaticMap] WKB hex format detected, cannot parse directly');
      return null;
    }

    // Parse WKT LINESTRING
    if (tracklog.startsWith('LINESTRING')) {
      const coords = this.parseLineString(tracklog);
      if (coords.length === 0) {
        console.error('[StaticMap] Failed to parse WKT tracklog');
        return null;
      }
      encodedPath = polyline.encode(coords.map(c => [c[1], c[0]])); // lat,lon for polyline
    } else {
      // Already encoded polyline
      encodedPath = tracklog;
    }

    // URL-encode the polyline
    const urlEncodedPath = encodeURIComponent(encodedPath);
    const path = `path-3+${this.colors.data}-0.8(${urlEncodedPath})`;

    // Add check-in markers (if any) - no connecting lines, just markers
    let markers = '';
    if (checkins && checkins.length > 0) {
      markers = ',' + checkins
        .map((c, idx) => `pin-s-${idx + 1}+${this.colors.interactive}(${c.longitude},${c.latitude})`)
        .join(',');
    }

    return `${this.baseUrl}/${path}${markers}/auto/${width}x${height}@2x?access_token=${this.mapboxToken}`;
  }
}

module.exports = new StaticMapGenerator();
