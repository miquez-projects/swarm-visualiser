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

    // Add markers for each checkin
    const markers = checkins
      .map((c, i) => `pin-s-${i + 1}+ff6b35(${c.longitude},${c.latitude})`)
      .join(',');

    // Auto-fit bounds
    const path = `path-2+ff6b35-0.5(${encodedPath})`;

    return `${this.baseUrl}/${path},${markers}/auto/${width}x${height}@2x?access_token=${this.mapboxToken}`;
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
