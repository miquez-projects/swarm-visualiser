/**
 * Custom Mapbox Style for Life Visualizer
 *
 * Cartographic dark theme with:
 * - Muted land/water colors
 * - Topographic contour lines
 * - Coordinate grid overlay
 * - Monospace label typography
 *
 * This style extends Mapbox Dark v11 and overrides specific layers.
 * Edit colors/opacities here and they'll update in the app.
 */

// Design system colors (keep in sync with theme.js)
const colors = {
  // Base map colors
  land: '#1a1a1a',
  landAlt: '#1f1f1f', // for contrast in some areas
  water: '#0d1117',
  waterway: '#0d1117',
  parks: '#1e2420',
  buildings: '#252525',
  roads: {
    highway: '#2a2a2a',
    major: '#242424',
    minor: '#1e1e1e',
    path: '#1a1a1a',
  },
  boundaries: {
    country: 'rgba(45, 154, 140, 0.3)',
    state: 'rgba(45, 154, 140, 0.15)',
  },

  // Contours
  contour: 'rgba(45, 154, 140, 0.12)',
  contourIndex: 'rgba(45, 154, 140, 0.2)', // every 5th contour

  // Grid overlay
  grid: 'rgba(45, 154, 140, 0.08)',

  // Labels
  labels: {
    country: '#666666',
    state: '#555555',
    city: '#777777',
    town: '#666666',
    village: '#555555',
    street: '#444444',
    poi: '#555555',
  },

  // Label halos (for readability)
  halo: 'rgba(18, 18, 18, 0.8)',
};

// Typography settings
const fonts = {
  // Mapbox has limited font options - these are available by default
  // For true monospace, we'd need to upload custom fonts
  regular: ['DIN Pro Regular', 'Arial Unicode MS Regular'],
  medium: ['DIN Pro Medium', 'Arial Unicode MS Regular'],
  bold: ['DIN Pro Bold', 'Arial Unicode MS Bold'],
  // Condensed gives a more technical/chart feel
  condensed: ['DIN Pro Condensed', 'Arial Unicode MS Regular'],
};

/**
 * The map style specification
 * Based on Mapbox Style Specification v8
 * https://docs.mapbox.com/style-spec/reference/
 */
export const mapStyle = {
  version: 8,
  name: 'Life Visualizer Cartographic',

  // Use Mapbox sources
  sources: {
    // Standard Mapbox vector tiles
    'mapbox-streets': {
      type: 'vector',
      url: 'mapbox://mapbox.mapbox-streets-v8',
    },
    // Terrain data for contour lines
    'mapbox-terrain': {
      type: 'vector',
      url: 'mapbox://mapbox.mapbox-terrain-v2',
    },
  },

  // Sprite and glyphs from Mapbox
  sprite: 'mapbox://sprites/mapbox/dark-v11',
  glyphs: 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf',

  // Layer definitions (order matters - bottom to top)
  layers: [
    // ============================================
    // BACKGROUND & LAND
    // ============================================
    {
      id: 'background',
      type: 'background',
      paint: {
        'background-color': colors.land,
      },
    },

    // ============================================
    // WATER
    // ============================================
    {
      id: 'water',
      type: 'fill',
      source: 'mapbox-streets',
      'source-layer': 'water',
      paint: {
        'fill-color': colors.water,
      },
    },
    {
      id: 'waterway',
      type: 'line',
      source: 'mapbox-streets',
      'source-layer': 'waterway',
      paint: {
        'line-color': colors.waterway,
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          6, 0.5,
          12, 2,
        ],
      },
    },

    // ============================================
    // LAND USE (Parks, etc)
    // ============================================
    {
      id: 'landuse-park',
      type: 'fill',
      source: 'mapbox-streets',
      'source-layer': 'landuse',
      filter: ['==', ['get', 'class'], 'park'],
      paint: {
        'fill-color': colors.parks,
        'fill-opacity': 0.8,
      },
    },
    {
      id: 'landuse-pitch',
      type: 'fill',
      source: 'mapbox-streets',
      'source-layer': 'landuse',
      filter: ['==', ['get', 'class'], 'pitch'],
      paint: {
        'fill-color': colors.parks,
        'fill-opacity': 0.5,
      },
    },

    // ============================================
    // TOPOGRAPHIC CONTOURS
    // ============================================
    {
      id: 'contour-line',
      type: 'line',
      source: 'mapbox-terrain',
      'source-layer': 'contour',
      minzoom: 9,
      filter: ['!=', ['get', 'index'], 5], // Regular contours (not index)
      paint: {
        'line-color': colors.contour,
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          9, 0.3,
          14, 0.5,
        ],
      },
    },
    {
      id: 'contour-line-index',
      type: 'line',
      source: 'mapbox-terrain',
      'source-layer': 'contour',
      minzoom: 9,
      filter: ['==', ['get', 'index'], 5], // Index contours (every 5th)
      paint: {
        'line-color': colors.contourIndex,
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          9, 0.5,
          14, 0.8,
        ],
      },
    },

    // ============================================
    // COORDINATE GRID OVERLAY
    // ============================================
    // Note: True graticule requires a custom source or runtime generation
    // This approximates it with a pattern effect via boundaries

    // ============================================
    // BUILDINGS
    // ============================================
    {
      id: 'building',
      type: 'fill',
      source: 'mapbox-streets',
      'source-layer': 'building',
      minzoom: 13,
      paint: {
        'fill-color': colors.buildings,
        'fill-opacity': [
          'interpolate', ['linear'], ['zoom'],
          13, 0,
          15, 0.8,
        ],
      },
    },

    // ============================================
    // BOUNDARIES
    // ============================================
    {
      id: 'admin-country',
      type: 'line',
      source: 'mapbox-streets',
      'source-layer': 'admin',
      filter: [
        'all',
        ['==', ['get', 'admin_level'], 0],
        ['==', ['get', 'maritime'], false],
      ],
      paint: {
        'line-color': colors.boundaries.country,
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          2, 0.5,
          8, 1.5,
        ],
        'line-dasharray': [2, 1],
      },
    },
    {
      id: 'admin-state',
      type: 'line',
      source: 'mapbox-streets',
      'source-layer': 'admin',
      filter: [
        'all',
        ['==', ['get', 'admin_level'], 1],
        ['==', ['get', 'maritime'], false],
      ],
      minzoom: 4,
      paint: {
        'line-color': colors.boundaries.state,
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          4, 0.3,
          8, 1,
        ],
        'line-dasharray': [3, 2],
      },
    },

    // ============================================
    // ROADS
    // ============================================
    {
      id: 'road-path',
      type: 'line',
      source: 'mapbox-streets',
      'source-layer': 'road',
      filter: ['==', ['get', 'class'], 'path'],
      minzoom: 14,
      paint: {
        'line-color': colors.roads.path,
        'line-width': 1,
        'line-dasharray': [2, 1],
      },
    },
    {
      id: 'road-minor',
      type: 'line',
      source: 'mapbox-streets',
      'source-layer': 'road',
      filter: [
        'all',
        ['match', ['get', 'class'], ['street', 'street_limited'], true, false],
      ],
      minzoom: 12,
      paint: {
        'line-color': colors.roads.minor,
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          12, 0.5,
          16, 4,
        ],
      },
    },
    {
      id: 'road-secondary',
      type: 'line',
      source: 'mapbox-streets',
      'source-layer': 'road',
      filter: [
        'match', ['get', 'class'],
        ['secondary', 'tertiary'],
        true, false
      ],
      paint: {
        'line-color': colors.roads.major,
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          8, 0.5,
          16, 6,
        ],
      },
    },
    {
      id: 'road-primary',
      type: 'line',
      source: 'mapbox-streets',
      'source-layer': 'road',
      filter: ['==', ['get', 'class'], 'primary'],
      paint: {
        'line-color': colors.roads.major,
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          6, 0.5,
          16, 8,
        ],
      },
    },
    {
      id: 'road-motorway',
      type: 'line',
      source: 'mapbox-streets',
      'source-layer': 'road',
      filter: [
        'match', ['get', 'class'],
        ['motorway', 'trunk'],
        true, false
      ],
      paint: {
        'line-color': colors.roads.highway,
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          5, 0.5,
          16, 10,
        ],
      },
    },

    // ============================================
    // LABELS - Countries
    // ============================================
    {
      id: 'label-country',
      type: 'symbol',
      source: 'mapbox-streets',
      'source-layer': 'place_label',
      filter: ['==', ['get', 'class'], 'country'],
      layout: {
        'text-field': ['get', 'name_en'],
        'text-font': fonts.bold,
        'text-size': [
          'interpolate', ['linear'], ['zoom'],
          2, 10,
          6, 14,
        ],
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.15,
        'text-max-width': 8,
      },
      paint: {
        'text-color': colors.labels.country,
        'text-halo-color': colors.halo,
        'text-halo-width': 1.5,
      },
    },

    // ============================================
    // LABELS - States/Regions
    // ============================================
    {
      id: 'label-state',
      type: 'symbol',
      source: 'mapbox-streets',
      'source-layer': 'place_label',
      filter: ['==', ['get', 'class'], 'state'],
      minzoom: 4,
      layout: {
        'text-field': ['get', 'name_en'],
        'text-font': fonts.medium,
        'text-size': [
          'interpolate', ['linear'], ['zoom'],
          4, 9,
          8, 12,
        ],
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.1,
      },
      paint: {
        'text-color': colors.labels.state,
        'text-halo-color': colors.halo,
        'text-halo-width': 1,
      },
    },

    // ============================================
    // LABELS - Cities
    // ============================================
    {
      id: 'label-city',
      type: 'symbol',
      source: 'mapbox-streets',
      'source-layer': 'place_label',
      filter: [
        'match', ['get', 'class'],
        ['city', 'settlement'],
        true, false
      ],
      layout: {
        'text-field': ['get', 'name_en'],
        'text-font': fonts.medium,
        'text-size': [
          'interpolate', ['linear'], ['zoom'],
          4, 10,
          12, 16,
        ],
      },
      paint: {
        'text-color': colors.labels.city,
        'text-halo-color': colors.halo,
        'text-halo-width': 1.5,
      },
    },

    // ============================================
    // LABELS - Towns
    // ============================================
    {
      id: 'label-town',
      type: 'symbol',
      source: 'mapbox-streets',
      'source-layer': 'place_label',
      filter: ['==', ['get', 'class'], 'town'],
      minzoom: 6,
      layout: {
        'text-field': ['get', 'name_en'],
        'text-font': fonts.regular,
        'text-size': [
          'interpolate', ['linear'], ['zoom'],
          6, 9,
          12, 13,
        ],
      },
      paint: {
        'text-color': colors.labels.town,
        'text-halo-color': colors.halo,
        'text-halo-width': 1,
      },
    },

    // ============================================
    // LABELS - Villages
    // ============================================
    {
      id: 'label-village',
      type: 'symbol',
      source: 'mapbox-streets',
      'source-layer': 'place_label',
      filter: ['==', ['get', 'class'], 'village'],
      minzoom: 10,
      layout: {
        'text-field': ['get', 'name_en'],
        'text-font': fonts.regular,
        'text-size': 11,
      },
      paint: {
        'text-color': colors.labels.village,
        'text-halo-color': colors.halo,
        'text-halo-width': 1,
      },
    },

    // ============================================
    // LABELS - Streets
    // ============================================
    {
      id: 'label-road',
      type: 'symbol',
      source: 'mapbox-streets',
      'source-layer': 'road',
      filter: [
        'match', ['get', 'class'],
        ['motorway', 'trunk', 'primary', 'secondary', 'tertiary'],
        true, false
      ],
      minzoom: 12,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': fonts.regular,
        'text-size': [
          'interpolate', ['linear'], ['zoom'],
          12, 9,
          16, 12,
        ],
        'symbol-placement': 'line',
        'text-rotation-alignment': 'map',
        'text-pitch-alignment': 'viewport',
      },
      paint: {
        'text-color': colors.labels.street,
        'text-halo-color': colors.halo,
        'text-halo-width': 1,
      },
    },
  ],
};

export default mapStyle;
