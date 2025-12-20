# Life Visualizer Design System

**Date:** 2025-12-20
**Status:** Validated
**Brief:** Dark-dominant, modern cartography aesthetic with Victorian captain's log precision. Serious, non-kitsch, clean.

---

## Design Principles

1. **Precision over decoration** - Every element serves a purpose
2. **Data as hero** - Numbers and maps take center stage
3. **Cartographic language** - Grids, coordinates, ruled lines
4. **Restrained personality** - Subtle teal tints, not loud theming
5. **Modern foundation** - Clean sans-serif, not period typography

---

## Color System

### Background Colors
| Token | Value | Use |
|-------|-------|-----|
| `background-primary` | #121212 | Main app background |
| `background-elevated` | #1e1e1e | Cards, panels, modals |
| `background-surface` | #252525 | Hover states, inputs |

### Accent Colors
| Token | Value | Use |
|-------|-------|-----|
| `accent-interactive` | #ff6b35 | Buttons, links, active states |
| `accent-data` | #2d9a8c | Charts, map elements, data viz |
| `accent-interactive-muted` | #cc5629 | Hover/pressed interactive |
| `accent-data-muted` | #246b60 | Secondary data elements |

### Text Colors
| Token | Value | Use |
|-------|-------|-----|
| `text-primary` | #f5f5f5 | Main content, headings |
| `text-secondary` | #a0a0a0 | Labels, captions |
| `text-muted` | #666666 | Disabled, placeholder |

### Structural Colors
| Token | Value | Use |
|-------|-------|-----|
| `border-default` | rgba(45, 154, 140, 0.2) | Teal-tinted ruling lines |
| `border-strong` | rgba(45, 154, 140, 0.4) | Section dividers |

---

## Typography

### Font Families
- **Display/Body:** DM Sans (Google Fonts)
- **Data/Monospace:** JetBrains Mono (Google Fonts)

### Type Scale
| Token | Size | Weight | Font | Use |
|-------|------|--------|------|-----|
| `display-lg` | 48px | 700 | DM Sans | Year headers, hero numbers |
| `display-md` | 32px | 700 | DM Sans | Page titles |
| `heading-lg` | 24px | 600 | DM Sans | Section headers |
| `heading-md` | 18px | 600 | DM Sans | Card titles |
| `body` | 16px | 400 | DM Sans | Main content |
| `body-sm` | 14px | 400 | DM Sans | Secondary content |
| `caption` | 12px | 400 | DM Sans | Labels, timestamps |
| `data-lg` | 32px | 500 | JetBrains Mono | Primary stats |
| `data-md` | 18px | 400 | JetBrains Mono | Secondary stats |
| `data-sm` | 12px | 400 | JetBrains Mono | Coordinates, small values |

### Usage Rules
- All numerical data uses monospace (`font-data`)
- Timestamps formatted: `2024-03-15 · 14:32`
- Labels in `text-secondary`, values in `text-primary`

---

## UI Components

### Cards & Panels
- Background: `background-elevated`
- Border: 1px `border-default` (teal-tinted)
- Border-radius: 4px
- Padding: 16px (compact), 24px (spacious)
- No shadows - structure from borders only

### Buttons
| Variant | Background | Border | Text |
|---------|------------|--------|------|
| Primary | `accent-interactive` | none | #121212 |
| Secondary | transparent | 1px `accent-interactive` | `accent-interactive` |
| Ghost | transparent | none | `text-secondary` |

- All buttons: 4px radius, 12px/16px padding, 500 weight

### Form Inputs
- Background: `background-surface`
- Border: 1px `border-default`, 1px `accent-interactive` on focus
- Text: `text-primary`, placeholder in `text-muted`
- Monospace for coordinate/numeric inputs

### Dividers
- Horizontal rules: 1px `border-default`
- Section separators: 1px `border-strong`
- Spacing: 16px above and below

### Icons
- Library: Phosphor Icons (regular weight)
- Size: 20px (inline), 24px (standalone)
- Color: `text-secondary` default, `accent-data` for emphasis

---

## Map Styling

### Mapbox Custom Style

#### Base Layers
| Layer | Color |
|-------|-------|
| Land | #1a1a1a |
| Water | #0d1117 |
| Parks/green | #1e2420 |
| Buildings | #252525 |

#### Topographic Contours
- Color: rgba(45, 154, 140, 0.15)
- Line width: 0.5px
- Visible at zoom 10+

#### Grid Overlay (Graticule)
- Color: rgba(255, 255, 255, 0.05)
- Appears at zoom 4+, fades at zoom 14+
- 10° intervals (low zoom) → 1° intervals (high zoom)

#### Labels
- Font: JetBrains Mono / DIN Mono fallback
- Country labels: #666666, uppercase, 10px
- City labels: #888888, 11px
- Street labels: #555555, 9px

#### Venue Markers
- Unclustered: 10px circle, muted category color, 2px #1e1e1e stroke
- Clusters: `accent-data` teal, sized by count
- Cluster labels: white, monospace

---

## Category Colors (Muted)

| Category | Original | Muted |
|----------|----------|-------|
| Restaurant | #e74c3c | #a63d30 |
| Bar | #9b59b6 | #6d4080 |
| Café | #f39c12 | #b87a0f |
| Coffee Shop | #d35400 | #8f3d00 |
| Museum | #3498db | #2a6a94 |
| Park | #27ae60 | #1e7544 |
| Hotel | #16a085 | #127560 |
| Shop | #e67e22 | #a35a18 |
| Unknown | #95a5a6 | #5a6566 |

---

## Splash Screen

### Cartographic Reveal Animation

**Sequence (2.5s total)**
1. `0-0.5s`: Black screen (#0a0a0a), grid fades in to 10% opacity
2. `0.5-1.5s`: Coordinate grid draws outward from center
3. `1.2-2s`: "Life Visualizer" fades in as map label
4. `2-2.5s`: Crossfade to app (if authenticated)

**Visual Treatment**
- Background: #0a0a0a
- Grid lines: `accent-data` at 15% opacity
- Title: DM Sans 32px, 600 weight, `text-primary`
- Coordinates subtitle: JetBrains Mono 12px, `text-secondary`

---

## Screen Applications

### App Bar / Navigation
- Background: `background-elevated`
- Bottom border: 1px `border-default`
- Logo: DM Sans 18px, `text-primary`
- Nav buttons: ghost, Phosphor icons

### Property Tiles (Day in Life)
- Ruled border, 4px radius
- Phosphor icon (24px, `accent-data`)
- Value: `data-lg` monospace
- Label: `caption`, `text-secondary`

### Stats Cards (Year in Review)
- Ruled border treatment
- Stat number: `display-lg` monospace, centered
- Label: `caption` uppercase, 0.1em letter-spacing

### Copilot Chat
- Panel: `background-elevated`, ruled border
- User messages: `background-surface`, right-aligned
- Assistant messages: subtle teal tint, left-aligned
- Timestamps: `data-sm`, `text-muted`

### Filter Panel
- Section headers: `heading-md`
- Dividers: `border-strong`
- Chips: `background-surface`, ruled border

---

## Implementation Notes

### Dependencies to Add
- Google Fonts: DM Sans, JetBrains Mono
- Phosphor Icons React: `@phosphor-icons/react`

### Files to Modify
1. `client/src/theme.js` - Complete rewrite with new palette
2. `client/src/index.css` - Font imports
3. `client/src/components/Layout.jsx` - AppBar styling
4. `client/src/components/MapView.jsx` - Custom map style, marker colors
5. `client/src/components/SplashScreen.jsx` - Cartographic reveal
6. `client/src/components/dayinlife/PropertyTile.jsx` - New tile design
7. `client/src/pages/YearInReviewPage.jsx` - Stats card styling
8. `client/src/components/copilot/*.jsx` - Chat styling

### Mapbox Studio
- Create custom style based on "Dark" template
- Add contour layer from Mapbox Terrain tileset
- Configure graticule overlay
- Set custom label fonts

---

## Summary

A dark, precise, cartographic design system that treats the app as a serious navigation tool. The aesthetic draws from captain's logs and technical charts without literal Victorian styling. Swarm orange provides brand continuity for interactive elements while teal carries the cartographic personality through data visualization and structural elements.
