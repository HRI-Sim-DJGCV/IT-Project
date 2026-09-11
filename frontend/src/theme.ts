import { createTheme } from '@mui/material/styles'

// Material design 3 implementation

export const theme = createTheme({
  palette: {
    primary: {
      main: '#1e2a44', // --color-primary
      light: '#2b3a5c', // --color-primary-hover
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#cfe0f5', // --color-accent
      contrastText: '#1e2a44',
    },
    background: {
      default: '#f5f5f7', // --color-surface
      paper: '#ffffff', // --color-card
    },
    text: {
      primary: '#16181d', // --color-ink
      secondary: '#6b7280', // --color-muted
    },
    divider: '#e2e4e9', // --color-line
  },
  shape: {
    // to mimic ex. tailwind settings
    borderRadius: 12, 
  },
  typography: {
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  components: {
    // Global overrides
    MuiButton: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
          '&:active': {
            boxShadow: 'none',
          },
        },
      },
    },
  }
})