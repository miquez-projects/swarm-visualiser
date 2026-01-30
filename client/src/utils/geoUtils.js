/**
 * Check if inner bounds are fully contained within outer bounds.
 */
export function boundsContained(inner, outer) {
  return inner.minLng >= outer.minLng &&
         inner.maxLng <= outer.maxLng &&
         inner.minLat >= outer.minLat &&
         inner.maxLat <= outer.maxLat;
}

/**
 * Add a buffer percentage to bounds, clamped to valid lat/lng ranges.
 */
export function addBuffer(bounds, percent) {
  const lngRange = bounds.maxLng - bounds.minLng;
  const latRange = bounds.maxLat - bounds.minLat;

  return {
    minLng: Math.max(-180, bounds.minLng - (lngRange * percent)),
    maxLng: Math.min(180, bounds.maxLng + (lngRange * percent)),
    minLat: Math.max(-90, bounds.minLat - (latRange * percent)),
    maxLat: Math.min(90, bounds.maxLat + (latRange * percent))
  };
}

/**
 * Calculate map bounds from an array of venues with latitude/longitude.
 */
export function calculateBounds(venues) {
  if (!venues || venues.length === 0) return null;

  const lngs = venues.map(v => v.longitude).filter(lng => lng != null);
  const lats = venues.map(v => v.latitude).filter(lat => lat != null);

  if (lngs.length === 0 || lats.length === 0) return null;

  return [
    [Math.min(...lngs), Math.min(...lats)], // Southwest
    [Math.max(...lngs), Math.max(...lats)]  // Northeast
  ];
}
