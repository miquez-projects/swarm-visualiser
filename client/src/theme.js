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
      surface: colors.backgroundSurface,
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
