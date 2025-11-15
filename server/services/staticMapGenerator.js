const polyline = require('@mapbox/polyline');

class StaticMapGenerator {
  constructor() {
    this.mapboxToken = process.env.MAPBOX_TOKEN;
    this.baseUrl = 'https://api.mapbox.com/styles/v1/mapbox/streets-v12/static';
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
          return `pin-s-${firstNum}+ff6b35(${group.longitude},${group.latitude})`;
        } else if (group.indices.length === 2) {
          // Two checkins - medium pin with first number
          return `pin-m-${firstNum}+ff6b35(${group.longitude},${group.latitude})`;
        } else {
          // Three or more checkins - large pin with first number
          return `pin-l-${firstNum}+ff6b35(${group.longitude},${group.latitude})`;
        }
      })
      .join(',');

    // Auto-fit bounds
    const path = `path-2+ff6b35-0.5(${encodedPath})`;

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

    // Check if it's WKT format (Garmin) or polyline format (Strava)
    if (tracklogOrPolyline.startsWith('LINESTRING')) {
      // Garmin format: WKT "LINESTRING(lon lat, lon lat, ...)"
      const coords = this.parseLineString(tracklogOrPolyline);
      if (coords.length === 0) return null;
      encodedPath = polyline.encode(coords.map(c => [c[1], c[0]])); // lat,lon for polyline
    } else {
      // Strava format: already encoded polyline
      encodedPath = tracklogOrPolyline;
    }

    const path = `path-3+3498db-0.8(${encodedPath})`;

    return `${this.baseUrl}/${path}/auto/${width}x${height}@2x?access_token=${this.mapboxToken}`;
  }

  createCurvedPath(coords) {
    // Simple curve: encode coordinates with polyline
    // For production: implement bezier curves or use actual routing
    const latLngs = coords.map(c => [c[1], c[0]]); // Convert to lat,lng
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
}

module.exports = new StaticMapGenerator();
