# Design System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the app from generic Material UI to a dark cartographic design system with no hard-coded styles remaining.

**Architecture:** Create a centralized theme with design tokens, then systematically update every component to use theme values instead of hard-coded colors, typography, and spacing.

**Tech Stack:** MUI theming, Emotion CSS-in-JS, Phosphor Icons, Google Fonts (DM Sans, JetBrains Mono), Custom Mapbox Style

---

## Pre-Implementation Checklist

Before starting, ensure you understand:
- All colors must come from `theme.palette.*` - no hex codes in components
- All typography must use theme tokens - no inline `fontFamily`, `fontWeight`, `fontSize`
- All borders use `theme.palette.border.*` tokens
- All spacing uses MUI spacing units (1 = 8px)
- Shadows are removed - use borders for elevation

---

## Task 1: Install Dependencies

**Files:**
- Modify: `client/package.json`

**Step 1: Add Phosphor Icons and verify fonts**

```bash
cd /Users/gabormikes/swarm-visualizer/client && npm install @phosphor-icons/react
```

**Step 2: Verify installation**

```bash
npm list @phosphor-icons/react
```
Expected: Shows `@phosphor-icons/react@X.X.X`

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add phosphor icons for design system"
```

---

## Task 2: Update Global CSS with Font Imports

**Files:**
- Modify: `client/src/index.css`

**Step 1: Replace entire file content**

Replace the contents of `client/src/index.css` with:

```css
/* Google Fonts */
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&display=swap');

/* Global Styles */
body {
  margin: 0;
  font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background-color: #121212;
}

code {
  font-family: 'JetBrains Mono', source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
    monospace;
}

/* Ensure dark scrollbars */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #1e1e1e;
}

::-webkit-scrollbar-thumb {
  background: #333;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #444;
}
```

**Step 2: Commit**

```bash
git add client/src/index.css
git commit -m "style: add Google Fonts and dark scrollbar styles"
```

---

## Task 3: Delete Unused App.css

**Files:**
- Delete: `client/src/App.css`
- Modify: `client/src/App.js` (remove import)

**Step 1: Check if App.css is imported**

Read `client/src/App.js` and check for `import './App.css'`

**Step 2: Remove import from App.js if present**

If the import exists, remove the line `import './App.css';`

**Step 3: Delete the file**

```bash
rm client/src/App.css
```

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove unused App.css"
```

---

## Task 4: Create New Theme File

**Files:**
- Modify: `client/src/theme.js`

**Step 1: Replace entire theme.js with design system**

Replace the entire contents of `client/src/theme.js` with:

```javascript
import { createTheme } from '@mui/material/styles';

// Design System Color Tokens
const colors = {
  // Backgrounds
  backgroundPrimary: '#121212',
  backgroundElevated: '#1e1e1e',
  backgroundSurface: '#252525',

  // Accents
  accentInteractive: '#ff6b35',
  accentInteractiveMuted: '#cc5629',
  accentData: '#2d9a8c',
  accentDataMuted: '#246b60',

  // Text
  textPrimary: '#f5f5f5',
  textSecondary: '#a0a0a0',
  textMuted: '#666666',

  // Borders (teal-tinted)
  borderDefault: 'rgba(45, 154, 140, 0.2)',
  borderStrong: 'rgba(45, 154, 140, 0.4)',

  // Category Colors (muted)
  categoryRestaurant: '#a63d30',
  categoryBar: '#6d4080',
  categoryCafe: '#b87a0f',
  categoryCoffeeShop: '#8f3d00',
  categoryMuseum: '#2a6a94',
  categoryPark: '#1e7544',
  categoryHotel: '#127560',
  categoryShop: '#a35a18',
  categoryUnknown: '#5a6566',

  // Chart Colors
  chartPrimary: '#2d9a8c',
  chartSecondary: '#ff6b35',
  chartTertiary: '#6d4080',

  // Contribution Grid
  contributionEmpty: '#1e1e1e',
  contributionLow: '#1a4a45',
  contributionMedium: '#246b60',
  contributionHigh: '#2d9a8c',
  contributionHighest: '#3dbdaa',
};

// Category color mapping for use in components
export const CATEGORY_COLORS = {
  'Restaurant': colors.categoryRestaurant,
  'Bar': colors.categoryBar,
  'Café': colors.categoryCafe,
  'Coffee Shop': colors.categoryCoffeeShop,
  'Museum': colors.categoryMuseum,
  'Park': colors.categoryPark,
  'Hotel': colors.categoryHotel,
  'Shop': colors.categoryShop,
  'Unknown': colors.categoryUnknown,
};

// Contribution grid color function
export const getContributionColor = (count) => {
  if (count === 0) return colors.contributionEmpty;
  if (count <= 2) return colors.contributionLow;
  if (count <= 5) return colors.contributionMedium;
  if (count <= 10) return colors.contributionHigh;
  return colors.contributionHighest;
};

// Chart colors for Recharts
export const chartColors = {
  primary: colors.chartPrimary,
  secondary: colors.chartSecondary,
  tertiary: colors.chartTertiary,
  grid: 'rgba(255, 255, 255, 0.1)',
  axis: colors.textMuted,
  tooltip: colors.backgroundElevated,
};

// Create base theme configuration
const baseTheme = {
  palette: {
    mode: 'dark',
    primary: {
      main: colors.accentInteractive,
      dark: colors.accentInteractiveMuted,
      contrastText: '#121212',
    },
    secondary: {
      main: colors.accentData,
      dark: colors.accentDataMuted,
      contrastText: '#ffffff',
    },
    background: {
      default: colors.backgroundPrimary,
      paper: colors.backgroundElevated,
    },
    text: {
      primary: colors.textPrimary,
      secondary: colors.textSecondary,
      disabled: colors.textMuted,
    },
    divider: colors.borderDefault,
    border: {
      default: colors.borderDefault,
      strong: colors.borderStrong,
    },
    success: {
      main: '#2d9a8c',
    },
    error: {
      main: '#a63d30',
    },
    warning: {
      main: '#b87a0f',
    },
    info: {
      main: '#2a6a94',
    },
  },
  typography: {
    fontFamily: '"DM Sans", "Helvetica", "Arial", sans-serif',
    fontFamilyMono: '"JetBrains Mono", "Consolas", monospace',
    h1: {
      fontFamily: '"DM Sans", sans-serif',
      fontWeight: 700,
      fontSize: '3rem',
    },
    h2: {
      fontFamily: '"DM Sans", sans-serif',
      fontWeight: 700,
      fontSize: '2.5rem',
    },
    h3: {
      fontFamily: '"DM Sans", sans-serif',
      fontWeight: 700,
      fontSize: '2rem',
    },
    h4: {
      fontFamily: '"DM Sans", sans-serif',
      fontWeight: 600,
      fontSize: '1.5rem',
    },
    h5: {
      fontFamily: '"DM Sans", sans-serif',
      fontWeight: 600,
      fontSize: '1.25rem',
    },
    h6: {
      fontFamily: '"DM Sans", sans-serif',
      fontWeight: 600,
      fontSize: '1rem',
    },
    subtitle1: {
      fontFamily: '"DM Sans", sans-serif',
      fontWeight: 500,
      fontSize: '1rem',
    },
    subtitle2: {
      fontFamily: '"DM Sans", sans-serif',
      fontWeight: 500,
      fontSize: '0.875rem',
    },
    body1: {
      fontFamily: '"DM Sans", sans-serif',
      fontWeight: 400,
      fontSize: '1rem',
    },
    body2: {
      fontFamily: '"DM Sans", sans-serif',
      fontWeight: 400,
      fontSize: '0.875rem',
    },
    caption: {
      fontFamily: '"DM Sans", sans-serif',
      fontWeight: 400,
      fontSize: '0.75rem',
    },
    overline: {
      fontFamily: '"DM Sans", sans-serif',
      fontWeight: 500,
      fontSize: '0.75rem',
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
    },
    // Custom data typography variants
    dataLarge: {
      fontFamily: '"JetBrains Mono", monospace',
      fontWeight: 500,
      fontSize: '2rem',
    },
    dataMedium: {
      fontFamily: '"JetBrains Mono", monospace',
      fontWeight: 400,
      fontSize: '1.125rem',
    },
    dataSmall: {
      fontFamily: '"JetBrains Mono", monospace',
      fontWeight: 400,
      fontSize: '0.75rem',
    },
  },
  shape: {
    borderRadius: 4,
  },
  shadows: [
    'none', // 0
    'none', // 1
    'none', // 2
    'none', // 3
    'none', // 4
    'none', // 5
    'none', // 6
    'none', // 7
    'none', // 8
    'none', // 9
    'none', // 10
    'none', // 11
    'none', // 12
    'none', // 13
    'none', // 14
    'none', // 15
    'none', // 16
    'none', // 17
    'none', // 18
    'none', // 19
    'none', // 20
    'none', // 21
    'none', // 22
    'none', // 23
    'none', // 24
  ],
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: colors.backgroundPrimary,
          color: colors.textPrimary,
        },
      },
    },
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: colors.backgroundElevated,
          border: `1px solid ${colors.borderDefault}`,
          borderRadius: 4,
        },
      },
    },
    MuiCard: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: colors.backgroundElevated,
          border: `1px solid ${colors.borderDefault}`,
          borderRadius: 4,
        },
      },
    },
    MuiAppBar: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          backgroundColor: colors.backgroundElevated,
          borderBottom: `1px solid ${colors.borderDefault}`,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          borderRadius: 4,
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
        containedPrimary: {
          backgroundColor: colors.accentInteractive,
          color: '#121212',
          '&:hover': {
            backgroundColor: colors.accentInteractiveMuted,
          },
        },
        containedSecondary: {
          backgroundColor: colors.accentData,
          color: '#ffffff',
          '&:hover': {
            backgroundColor: colors.accentDataMuted,
          },
        },
        outlined: {
          borderColor: colors.borderStrong,
          '&:hover': {
            borderColor: colors.accentInteractive,
            backgroundColor: 'transparent',
          },
        },
        outlinedPrimary: {
          borderColor: colors.accentInteractive,
          color: colors.accentInteractive,
        },
        outlinedSecondary: {
          borderColor: colors.accentData,
          color: colors.accentData,
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: colors.textSecondary,
          '&:hover': {
            backgroundColor: colors.backgroundSurface,
          },
        },
        colorPrimary: {
          color: colors.accentInteractive,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: colors.backgroundSurface,
            '& fieldset': {
              borderColor: colors.borderDefault,
            },
            '&:hover fieldset': {
              borderColor: colors.borderStrong,
            },
            '&.Mui-focused fieldset': {
              borderColor: colors.accentInteractive,
            },
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          backgroundColor: colors.backgroundSurface,
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: colors.backgroundElevated,
          border: `1px solid ${colors.borderDefault}`,
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: colors.backgroundSurface,
          },
          '&.Mui-selected': {
            backgroundColor: colors.backgroundSurface,
            '&:hover': {
              backgroundColor: colors.backgroundSurface,
            },
          },
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: colors.borderDefault,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 4,
        },
        outlined: {
          borderColor: colors.borderDefault,
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: colors.backgroundSurface,
          border: `1px solid ${colors.borderDefault}`,
          color: colors.textPrimary,
        },
      },
    },
    MuiFab: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
        primary: {
          backgroundColor: colors.accentInteractive,
          color: '#121212',
          '&:hover': {
            backgroundColor: colors.accentInteractiveMuted,
          },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 4,
        },
        standardError: {
          backgroundColor: 'rgba(166, 61, 48, 0.1)',
          border: `1px solid ${colors.categoryRestaurant}`,
        },
        standardSuccess: {
          backgroundColor: 'rgba(45, 154, 140, 0.1)',
          border: `1px solid ${colors.accentData}`,
        },
        standardWarning: {
          backgroundColor: 'rgba(184, 122, 15, 0.1)',
          border: `1px solid ${colors.categoryCafe}`,
        },
        standardInfo: {
          backgroundColor: 'rgba(42, 106, 148, 0.1)',
          border: `1px solid ${colors.categoryMuseum}`,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: colors.backgroundElevated,
          borderRight: `1px solid ${colors.borderDefault}`,
        },
      },
    },
    MuiModal: {
      styleOverrides: {
        root: {
          '& .MuiBackdrop-root': {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
          },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          backgroundColor: colors.backgroundSurface,
          borderRadius: 4,
        },
        bar: {
          backgroundColor: colors.accentData,
          borderRadius: 4,
        },
      },
    },
    MuiCircularProgress: {
      styleOverrides: {
        root: {
          color: colors.accentData,
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: {
          borderBottom: `1px solid ${colors.borderDefault}`,
        },
        indicator: {
          backgroundColor: colors.accentInteractive,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          color: colors.textSecondary,
          '&.Mui-selected': {
            color: colors.accentInteractive,
          },
        },
      },
    },
    MuiLink: {
      styleOverrides: {
        root: {
          color: colors.accentInteractive,
          textDecorationColor: colors.accentInteractive,
        },
      },
    },
  },
};

// Export single dark theme (no light theme in this design system)
export const darkTheme = createTheme(baseTheme);

// For backwards compatibility, also export as default
export default darkTheme;
```

**Step 2: Commit**

```bash
git add client/src/theme.js
git commit -m "feat: implement comprehensive dark cartographic theme"
```

---

## Task 5: Update App.js to Use Single Theme

**Files:**
- Modify: `client/src/App.js`

**Step 1: Read current App.js**

Read `client/src/App.js` to understand current structure.

**Step 2: Update theme imports and remove light theme**

Find the theme-related imports and state. Update to:
- Import only `darkTheme` from `./theme`
- Remove `lightTheme` import
- Remove dark mode toggle state if it controls theme switching
- Keep dark mode toggle button but make it non-functional (or remove entirely)

The theme provider should always use `darkTheme`:

```javascript
import { darkTheme } from './theme';
// ... in render:
<ThemeProvider theme={darkTheme}>
```

**Step 3: Commit**

```bash
git add client/src/App.js
git commit -m "refactor: use single dark theme, remove light mode"
```

---

## Task 6: Update Layout Component

**Files:**
- Modify: `client/src/components/Layout.jsx`

**Step 1: Read current Layout.jsx**

Read the file to understand current structure.

**Step 2: Update AppBar and navigation styling**

Key changes:
- Remove `elevation={1}` from AppBar (theme handles this)
- Remove dark mode toggle button (or make it decorative)
- Ensure sidebar uses theme border colors
- Remove any hard-coded colors

The AppBar should look like:
```jsx
<AppBar position="static">
```

Update sidebar border to use theme:
```jsx
borderRight: 1,
borderColor: 'divider',
```

**Step 3: Commit**

```bash
git add client/src/components/Layout.jsx
git commit -m "style: update Layout to use theme tokens"
```

---

## Task 7: Update MapView - Category Colors and Map Style

**Files:**
- Modify: `client/src/components/MapView.jsx`

**Step 1: Read current MapView.jsx**

Read the file to understand the current color usage.

**Step 2: Import theme colors and remove hard-coded colors**

At the top of the file, change:
```javascript
// REMOVE this:
const CATEGORY_COLORS = {
  'Restaurant': '#e74c3c',
  // ...
};

// ADD this:
import { CATEGORY_COLORS, getContributionColor } from '../theme';
```

**Step 3: Update map style to use dark basemap**

Change the mapStyle prop:
```javascript
// CHANGE from:
mapStyle="mapbox://styles/mapbox/streets-v12"

// TO:
mapStyle="mapbox://styles/mapbox/dark-v11"
```

Note: A fully custom style will need to be created in Mapbox Studio later. For now, use the standard dark style.

**Step 4: Update cluster colors**

Find the cluster layer paint and update:
```javascript
paint={{
  'circle-color': [
    'step',
    ['get', 'point_count'],
    '#2d9a8c',  // accent-data (low)
    100,
    '#246b60',  // accent-data-muted (medium)
    750,
    '#1e7544'   // categoryPark (high)
  ],
  // ...
}}
```

**Step 5: Update unclustered point colors**

Update the category color expressions to use the muted palette:
```javascript
paint={{
  'circle-color': [
    'match',
    ['get', 'category'],
    'Restaurant', '#a63d30',
    'Bar', '#6d4080',
    'Café', '#b87a0f',
    'Coffee Shop', '#8f3d00',
    'Museum', '#2a6a94',
    'Park', '#1e7544',
    'Hotel', '#127560',
    'Shop', '#a35a18',
    '#5a6566' // default - categoryUnknown
  ],
  'circle-radius': 8,
  'circle-stroke-width': 2,
  'circle-stroke-color': '#1e1e1e'  // backgroundElevated
}}
```

**Step 6: Update CheckinContributionGrid colors**

Find the `getColor` function and replace it with the import:
```javascript
// REMOVE the local getColor function
// USE the imported getContributionColor instead
```

**Step 7: Remove all remaining hard-coded colors**

Search for any remaining hex codes like:
- `#ffffff` → `'text.primary'` or `'#f5f5f5'`
- `rgba(0,0,0,...)` → use theme tokens

**Step 8: Commit**

```bash
git add client/src/components/MapView.jsx
git commit -m "style: update MapView to use theme colors and dark basemap"
```

---

## Task 8: Update StatsPanel - Chart Colors

**Files:**
- Modify: `client/src/components/StatsPanel.jsx`

**Step 1: Import chart colors from theme**

Add at top:
```javascript
import { chartColors } from '../theme';
```

**Step 2: Update Bar chart colors**

Find all `<Bar>` components and update:
```javascript
// CHANGE from:
<Bar dataKey="count" fill="#1976d2" />
<Bar dataKey="period1" fill="#1976d2" name="Period 1" />
<Bar dataKey="period2" fill="#dc004e" name="Period 2" />

// TO:
<Bar dataKey="count" fill={chartColors.primary} />
<Bar dataKey="period1" fill={chartColors.primary} name="Period 1" />
<Bar dataKey="period2" fill={chartColors.secondary} name="Period 2" />
```

Also update the category chart:
```javascript
// CHANGE from:
<Bar dataKey="count" fill="#f57c00" />

// TO:
<Bar dataKey="count" fill={chartColors.tertiary} />
```

**Step 3: Update Line chart colors**

```javascript
// CHANGE from:
<Line stroke="#1976d2" ... />
<Line stroke="#dc004e" ... />

// TO:
<Line stroke={chartColors.primary} ... />
<Line stroke={chartColors.secondary} ... />
```

**Step 4: Update CartesianGrid**

```javascript
<CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
```

**Step 5: Update XAxis/YAxis styling**

```javascript
<XAxis
  ...
  tick={{ fill: chartColors.axis, fontSize: 12 }}
  axisLine={{ stroke: chartColors.grid }}
/>
<YAxis
  tick={{ fill: chartColors.axis }}
  axisLine={{ stroke: chartColors.grid }}
/>
```

**Step 6: Remove elevation from Paper components**

Find all `<Paper>` components and remove `elevation` prop.

**Step 7: Commit**

```bash
git add client/src/components/StatsPanel.jsx
git commit -m "style: update StatsPanel to use theme chart colors"
```

---

## Task 9: Update SplashScreen - Cartographic Reveal

**Files:**
- Modify: `client/src/components/SplashScreen.jsx`

**Step 1: Complete redesign of SplashScreen**

Replace the entire component with the new cartographic reveal design:

```javascript
import React, { useState, useEffect } from 'react';
import { Box, TextField, Button, Typography, CircularProgress, Alert } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { validateToken } from '../services/api';

const SplashScreen = ({ onTokenValidated }) => {
  const theme = useTheme();
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [token, setToken] = useState('');
  const [fadeOut, setFadeOut] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState('');
  const [animationPhase, setAnimationPhase] = useState(0);

  useEffect(() => {
    // Animation sequence
    const timer1 = setTimeout(() => setAnimationPhase(1), 500);
    const timer2 = setTimeout(() => setAnimationPhase(2), 1200);

    // Check for token in URL or localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    const storedToken = localStorage.getItem('authToken');

    if (urlToken || storedToken) {
      validateExistingToken(urlToken || storedToken);
    } else {
      setTimeout(() => setShowTokenInput(true), 2000);
    }

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  const validateExistingToken = async (tokenToValidate) => {
    try {
      setIsValidating(true);
      await validateToken(tokenToValidate);
      setTimeout(() => setFadeOut(true), 2000);
      setTimeout(() => onTokenValidated(tokenToValidate), 2300);
    } catch (err) {
      localStorage.removeItem('authToken');
      setError('Your token is invalid or expired. Please enter a new one.');
      setShowTokenInput(true);
      setIsValidating(false);
    }
  };

  const handleTokenSubmit = async () => {
    if (!token.trim()) {
      setError('Please enter a token');
      return;
    }

    try {
      setIsValidating(true);
      setError('');
      await validateToken(token);
      localStorage.setItem('authToken', token);
      setFadeOut(true);
      setTimeout(() => onTokenValidated(token), 300);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid token. Please check and try again.');
      setIsValidating(false);
    }
  };

  const handleSetupNewUser = () => {
    onTokenValidated(null);
    setTimeout(() => {
      window.location.href = '/data-sources';
    }, 100);
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        bgcolor: '#0a0a0a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 0.3s ease-out',
        overflow: 'hidden',
      }}
    >
      {/* Coordinate Grid Background */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: animationPhase >= 1 ? 0.15 : 0,
          transition: 'opacity 1s ease-in',
          backgroundImage: `
            linear-gradient(rgba(45, 154, 140, 0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(45, 154, 140, 0.3) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
          backgroundPosition: 'center center',
        }}
      />

      {/* Radial Fade */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(circle at center, transparent 0%, #0a0a0a 70%)',
        }}
      />

      {/* Content */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          opacity: animationPhase >= 2 ? 1 : 0,
          transform: animationPhase >= 2 ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.8s ease-out',
        }}
      >
        <Typography
          variant="h2"
          sx={{
            color: 'text.primary',
            fontWeight: 700,
            mb: 1,
            letterSpacing: '-0.02em',
          }}
        >
          Life Visualizer
        </Typography>

        <Typography
          sx={{
            fontFamily: theme.typography.fontFamilyMono,
            fontSize: '0.75rem',
            color: 'text.secondary',
            mb: 6,
            letterSpacing: '0.1em',
          }}
        >
          48.2082° N, 16.3738° E
        </Typography>

        {isValidating && !showTokenInput && (
          <CircularProgress size={32} />
        )}

        {showTokenInput && !isValidating && (
          <Box sx={{ width: 400, maxWidth: '90%' }}>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Enter your token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleTokenSubmit()}
              autoFocus
              disabled={isValidating}
              sx={{ mb: 2 }}
            />
            <Button
              fullWidth
              variant="contained"
              onClick={handleTokenSubmit}
              disabled={isValidating}
              sx={{ mb: 1 }}
            >
              Continue
            </Button>
            <Button
              fullWidth
              variant="text"
              onClick={handleSetupNewUser}
              disabled={isValidating}
              sx={{ color: 'text.secondary' }}
            >
              Set up a new user
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default SplashScreen;
```

**Step 2: Commit**

```bash
git add client/src/components/SplashScreen.jsx
git commit -m "feat: redesign SplashScreen with cartographic reveal animation"
```

---

## Task 10: Update PropertyTile with Phosphor Icons

**Files:**
- Modify: `client/src/components/dayinlife/PropertyTile.jsx`

**Step 1: Replace emoji icons with Phosphor icons**

```javascript
import React from 'react';
import { Paper, Typography, Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  CloudSun,
  Moon,
  Sneaker,
  MapPin,
  Activity,
  Heart,
  Flame,
} from '@phosphor-icons/react';

// Map of icon types to Phosphor components
const iconMap = {
  weather: CloudSun,
  sleep: Moon,
  steps: Sneaker,
  checkins: MapPin,
  activities: Activity,
  heartRate: Heart,
  calories: Flame,
};

const PropertyTile = ({ icon, iconType, label, value, sublabel }) => {
  const theme = useTheme();
  const IconComponent = iconType ? iconMap[iconType] : null;

  return (
    <Paper sx={{
      p: 2,
      textAlign: 'center',
      minWidth: 140,
      height: 140,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center'
    }}>
      {IconComponent ? (
        <Box sx={{ color: 'secondary.main', mb: 1 }}>
          <IconComponent size={32} weight="regular" />
        </Box>
      ) : (
        <Typography variant="h4" sx={{ mb: 1 }}>{icon}</Typography>
      )}
      <Typography
        sx={{
          fontFamily: theme.typography.fontFamilyMono,
          fontSize: '1.5rem',
          fontWeight: 500,
          color: 'text.primary',
        }}
      >
        {value || 'No data'}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Box sx={{ minHeight: 18 }}>
        {sublabel && (
          <Typography variant="caption" display="block" color="text.secondary">
            {sublabel}
          </Typography>
        )}
      </Box>
    </Paper>
  );
};

export default PropertyTile;
```

**Step 2: Commit**

```bash
git add client/src/components/dayinlife/PropertyTile.jsx
git commit -m "style: update PropertyTile with Phosphor icons and theme typography"
```

---

## Task 11: Update DayInLifePage to Use Icon Types

**Files:**
- Modify: `client/src/pages/DayInLifePage.jsx`

**Step 1: Update PropertyTile usage to use iconType prop**

Find the PropertyTile usages and add iconType props:

```javascript
<PropertyTile
  iconType="weather"
  label="Weather"
  value={`${dayData.properties.weather.temp}°C`}
  sublabel={dayData.properties.weather.country}
/>

<PropertyTile
  iconType="sleep"
  label="Sleep"
  value={...}
  sublabel={...}
/>

<PropertyTile
  iconType="steps"
  label="Steps"
  value={...}
/>

<PropertyTile
  iconType="checkins"
  label="Check-ins"
  value={...}
/>

<PropertyTile
  iconType="activities"
  label="Activities"
  value={...}
/>

<PropertyTile
  iconType="heartRate"
  label="Heart Rate"
  value={...}
  sublabel="bpm"
/>

<PropertyTile
  iconType="calories"
  label="Calories"
  value={...}
/>
```

**Step 2: Commit**

```bash
git add client/src/pages/DayInLifePage.jsx
git commit -m "style: use iconType prop for PropertyTiles"
```

---

## Task 12: Update YearInReviewPage

**Files:**
- Modify: `client/src/pages/YearInReviewPage.jsx`

**Step 1: Import Phosphor icons**

Replace MUI icons with Phosphor:
```javascript
import {
  MapPin,
  Globe,
  Buildings,
  SquaresFour,
  Calendar,
  Trophy,
} from '@phosphor-icons/react';
```

**Step 2: Update StatTile to use monospace for values**

Find the StatTile component and update:
```javascript
const StatTile = ({ icon, label, value, color = 'primary' }) => {
  const theme = useTheme();
  return (
    <Paper
      sx={{
        p: 3,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 150,
      }}
    >
      <Box sx={{ color: 'secondary.main', mb: 1 }}>
        {icon}
      </Box>
      <Typography variant="overline" color="text.secondary" gutterBottom>
        {label}
      </Typography>
      <Typography
        sx={{
          fontFamily: theme.typography.fontFamilyMono,
          fontSize: '2rem',
          fontWeight: 500,
        }}
      >
        {typeof value === 'number' ? value.toLocaleString() : value || 0}
      </Typography>
    </Paper>
  );
};
```

**Step 3: Update icon usage**

```javascript
<StatTile
  icon={<MapPin size={40} weight="regular" />}
  label="TOTAL CHECK-INS"
  value={summary.total_checkins}
/>
<StatTile
  icon={<Globe size={40} weight="regular" />}
  label="COUNTRIES"
  value={summary.countries_count}
/>
// etc.
```

**Step 4: Remove elevation props and update year display styling**

Remove all `elevation={...}` props from Paper/Card components.

Update the year display accent bar:
```javascript
<Box
  sx={{
    width: 200,
    height: 2,
    bgcolor: 'secondary.main', // Use teal accent
    mx: 'auto',
    mt: 2,
  }}
/>
```

**Step 5: Commit**

```bash
git add client/src/pages/YearInReviewPage.jsx
git commit -m "style: update YearInReviewPage with Phosphor icons and theme styling"
```

---

## Task 13: Update Copilot Components

**Files:**
- Modify: `client/src/components/copilot/CopilotChat.jsx`
- Modify: `client/src/components/copilot/ChatHeader.jsx`
- Modify: `client/src/components/copilot/ChatMessage.jsx`
- Modify: `client/src/components/copilot/ChatInput.jsx`

### Step 1: Update ChatHeader.jsx

Replace MUI icons with Phosphor and update styling:
```javascript
import React from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import { Trash, ArrowsOut, ArrowsIn, Minus, X } from '@phosphor-icons/react';

function ChatHeader({ onClose, onMinimize, onToggleExpand, isExpanded, onClear }) {
  return (
    <Box
      sx={{
        p: 2,
        borderBottom: 1,
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        bgcolor: 'background.paper',
      }}
    >
      <Typography variant="h6" sx={{ fontWeight: 600 }}>
        Copilot
      </Typography>
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        <IconButton size="small" onClick={onClear} title="Clear history">
          <Trash size={18} />
        </IconButton>
        <IconButton size="small" onClick={onToggleExpand} title={isExpanded ? "Collapse" : "Expand"}>
          {isExpanded ? <ArrowsIn size={18} /> : <ArrowsOut size={18} />}
        </IconButton>
        <IconButton size="small" onClick={onMinimize} title="Minimize">
          <Minus size={18} />
        </IconButton>
        <IconButton size="small" onClick={onClose} title="Close">
          <X size={18} />
        </IconButton>
      </Box>
    </Box>
  );
}

export default ChatHeader;
```

### Step 2: Update ChatMessage.jsx

Update styling for message bubbles:
- Remove elevation
- User messages: `bgcolor: 'background.surface'`
- Assistant messages: subtle teal tint
- Update venue chip styling

### Step 3: Update CopilotChat.jsx

- Import `ChatCircle` from Phosphor instead of MUI `Chat`
- Remove `elevation={8}` from Paper
- Ensure FAB uses theme colors

### Step 4: Update ChatInput.jsx

- Import `PaperPlaneTilt` from Phosphor instead of MUI `Send`

**Step 5: Commit**

```bash
git add client/src/components/copilot/
git commit -m "style: update Copilot components with Phosphor icons and theme styling"
```

---

## Task 14: Update DataSourcesPage - Strava Colors

**Files:**
- Modify: `client/src/pages/DataSourcesPage.jsx`

**Step 1: Find and update Strava orange**

Find `#FC4C02` and `#E34402` (Strava brand orange) and update to use theme:
```javascript
// Keep Strava brand color for brand recognition, but could use:
sx={{ bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' } }}
```

Or if keeping Strava orange is important for brand recognition, keep it but ensure consistency:
```javascript
// Strava brand orange - keeping for brand recognition
const STRAVA_ORANGE = '#FC4C02';
const STRAVA_ORANGE_DARK = '#E34402';
```

**Step 2: Update monospace styling**

Find `fontFamily: 'monospace'` and update to use theme:
```javascript
fontFamily: theme.typography.fontFamilyMono,
```

**Step 3: Commit**

```bash
git add client/src/pages/DataSourcesPage.jsx
git commit -m "style: update DataSourcesPage typography and colors"
```

---

## Task 15: Update Remaining Day-in-Life Components

**Files:**
- Modify: `client/src/components/dayinlife/CheckinEventTile.jsx`
- Modify: `client/src/components/dayinlife/ActivityEventTile.jsx`
- Modify: `client/src/components/dayinlife/ActivityWithCheckinsTile.jsx`

**Step 1: Update CheckinEventTile**

- Replace MUI Map icon with Phosphor `MapTrifold`
- Update timeline dot color: `bgcolor: 'secondary.main'`
- Update photo overlay color: `rgba(18, 18, 18, 0.8)` (theme background with opacity)
- Remove hard-coded `borderRadius: 8` → use theme value

**Step 2: Update ActivityEventTile**

- Replace MUI OpenInNew with Phosphor `ArrowSquareOut`
- Update styling to match theme

**Step 3: Update ActivityWithCheckinsTile**

- Same updates as above
- Ensure all colors use theme tokens

**Step 4: Commit**

```bash
git add client/src/components/dayinlife/
git commit -m "style: update day-in-life tiles with theme styling"
```

---

## Task 16: Update ContextMenu with Phosphor Icons

**Files:**
- Modify: `client/src/components/ContextMenu.jsx`

**Step 1: Replace MUI icons with Phosphor**

```javascript
import {
  MapTrifold,
  Calendar,
  Sun,
  Gear,
  ArrowsClockwise,
} from '@phosphor-icons/react';
```

**Step 2: Update icon usage**

Replace all MUI icon components with Phosphor equivalents.

**Step 3: Commit**

```bash
git add client/src/components/ContextMenu.jsx
git commit -m "style: update ContextMenu with Phosphor icons"
```

---

## Task 17: Update FilterPanel Icons

**Files:**
- Modify: `client/src/components/FilterPanel.jsx`

**Step 1: Replace MUI icons with Phosphor**

```javascript
import { Funnel, X, ArrowsOut, ArrowsIn } from '@phosphor-icons/react';
```

Update all icon usages.

**Step 2: Commit**

```bash
git add client/src/components/FilterPanel.jsx
git commit -m "style: update FilterPanel with Phosphor icons"
```

---

## Task 18: Update ImportPage and PrivacyPolicyPage

**Files:**
- Modify: `client/src/pages/ImportPage.jsx`
- Modify: `client/src/pages/PrivacyPolicyPage.jsx`

**Step 1: Remove elevation props**

Find all `elevation={...}` and remove them.

**Step 2: Update any hard-coded colors**

Find `bgcolor: 'grey.100'` and update to use theme:
```javascript
bgcolor: 'background.surface'
```

**Step 3: Commit**

```bash
git add client/src/pages/ImportPage.jsx client/src/pages/PrivacyPolicyPage.jsx
git commit -m "style: update ImportPage and PrivacyPolicyPage styling"
```

---

## Task 19: Update SyncProgressBar

**Files:**
- Modify: `client/src/components/SyncProgressBar.jsx`

**Step 1: Ensure LinearProgress uses theme colors**

The theme already configures LinearProgress, but verify no hard-coded colors.

**Step 2: Commit if changes needed**

```bash
git add client/src/components/SyncProgressBar.jsx
git commit -m "style: update SyncProgressBar to use theme colors"
```

---

## Task 20: Final Audit - Search for Remaining Hard-coded Values

**Step 1: Search for remaining hex colors**

```bash
grep -r "#[0-9a-fA-F]\{6\}" client/src --include="*.jsx" --include="*.js" | grep -v theme.js | grep -v node_modules
```

**Step 2: Search for remaining rgba**

```bash
grep -r "rgba(" client/src --include="*.jsx" --include="*.js" | grep -v theme.js | grep -v node_modules
```

**Step 3: Search for hard-coded fonts**

```bash
grep -r "fontFamily:" client/src --include="*.jsx" --include="*.js" | grep -v theme.js | grep -v node_modules
```

**Step 4: Search for elevation props**

```bash
grep -r "elevation=" client/src --include="*.jsx" | grep -v node_modules
```

**Step 5: Fix any remaining issues found**

Address each finding by replacing with theme tokens.

**Step 6: Final commit**

```bash
git add -A
git commit -m "style: remove all remaining hard-coded style values"
```

---

## Task 21: Test the Application

**Step 1: Start the development server**

```bash
cd /Users/gabormikes/swarm-visualizer && npm run dev
```

**Step 2: Visual verification checklist**

- [ ] Splash screen shows dark background with teal grid
- [ ] Title "Life Visualizer" appears with animation
- [ ] Login input uses theme styling
- [ ] App bar is dark with teal-tinted border
- [ ] Map uses dark basemap
- [ ] Map markers use muted category colors
- [ ] Clusters use teal colors
- [ ] Filter panel has proper borders and styling
- [ ] Stats charts use teal/orange colors
- [ ] Year in Review page uses monospace for numbers
- [ ] Day in Life property tiles show Phosphor icons
- [ ] Copilot chat panel matches theme
- [ ] All Paper components have borders, no shadows

**Step 3: Fix any visual issues found**

**Step 4: Final commit if fixes needed**

---

## Task 22: Create Custom Mapbox Style (External)

**Note:** This task requires Mapbox Studio and cannot be done in code.

**Step 1: Log into Mapbox Studio**

Go to https://studio.mapbox.com/

**Step 2: Create new style based on "Dark"**

- Start with Dark template
- Name: "Life Visualizer Cartographic"

**Step 3: Customize land and water colors**

- Land: #1a1a1a
- Water: #0d1117
- Parks: #1e2420
- Buildings: #252525

**Step 4: Add topographic contours**

- Add Mapbox Terrain source
- Create contour layer with:
  - Color: rgba(45, 154, 140, 0.15)
  - Width: 0.5px
  - Min zoom: 10

**Step 5: Update label fonts**

- Change all labels to use condensed/monospace fonts
- Country labels: #666666, uppercase, 10px
- City labels: #888888, 11px
- Street labels: #555555, 9px

**Step 6: Publish and get style URL**

Copy the style URL and update MapView.jsx:
```javascript
mapStyle="mapbox://styles/YOUR_USERNAME/YOUR_STYLE_ID"
```

**Step 7: Commit**

```bash
git add client/src/components/MapView.jsx
git commit -m "feat: use custom cartographic Mapbox style"
```

---

## Summary of Files Modified

| File | Changes |
|------|---------|
| `client/package.json` | Added @phosphor-icons/react |
| `client/src/index.css` | Google Fonts, dark scrollbars |
| `client/src/App.css` | DELETED |
| `client/src/App.js` | Single dark theme |
| `client/src/theme.js` | Complete design system |
| `client/src/components/Layout.jsx` | Theme styling |
| `client/src/components/MapView.jsx` | Theme colors, dark map |
| `client/src/components/StatsPanel.jsx` | Chart colors |
| `client/src/components/FilterPanel.jsx` | Phosphor icons |
| `client/src/components/SplashScreen.jsx` | Cartographic reveal |
| `client/src/components/ContextMenu.jsx` | Phosphor icons |
| `client/src/components/SyncProgressBar.jsx` | Theme colors |
| `client/src/components/copilot/*.jsx` | Phosphor icons, styling |
| `client/src/components/dayinlife/*.jsx` | Phosphor icons, styling |
| `client/src/pages/YearInReviewPage.jsx` | Phosphor icons, monospace |
| `client/src/pages/DayInLifePage.jsx` | Icon types |
| `client/src/pages/DataSourcesPage.jsx` | Theme typography |
| `client/src/pages/ImportPage.jsx` | Remove elevation |
| `client/src/pages/PrivacyPolicyPage.jsx` | Remove elevation |

---

## Hard-coded Values Removed

| Type | Before | After |
|------|--------|-------|
| Primary blue | #1976d2 | theme.palette.primary.main |
| Secondary pink | #dc004e | theme.palette.secondary.main |
| Background | #121212 | theme.palette.background.default |
| Paper | #1e1e1e | theme.palette.background.paper |
| Orange gradient | #ff6b35 | theme.palette.primary.main |
| Category colors | Bright hex | Muted from CATEGORY_COLORS |
| Cluster colors | #51bbd6 etc | Teal palette |
| Contribution grid | GitHub green | Teal gradient |
| Chart colors | #1976d2 | chartColors.* |
| Font | Roboto | DM Sans |
| Monospace | system | JetBrains Mono |
| Shadows | MUI defaults | none (borders only) |

---

## Verification Commands

Run after each major task:

```bash
# Check for remaining hard-coded colors
grep -rn "#[0-9a-fA-F]\{3,6\}" client/src --include="*.jsx" | grep -v theme.js

# Check for remaining elevation
grep -rn "elevation=" client/src --include="*.jsx"

# Check for remaining fontFamily
grep -rn "fontFamily:" client/src --include="*.jsx" | grep -v theme.js

# Verify build succeeds
cd client && npm run build
```
