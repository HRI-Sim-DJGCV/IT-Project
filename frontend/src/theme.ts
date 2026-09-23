import { createTheme } from '@mui/material/styles'

// Material design 3 implementation

export const createAppTheme = (highContrast: boolean) => createTheme({
  palette: highContrast
    ? {
      // MUI only accepts dark or light  
      mode: 'dark' as const,
        primary: {
          main: '#FFFF00',
          contrastText: '#000000',
        },
        secondary: {
          main: '#000000',
          contrastText: '#FFFF00',
        },
        background: {
          default: '#000000',
          paper: '#000000',
        },
        text: {
          primary: '#FFFF00',
          secondary: '#FFFF00',
        },
        divider: '#FFFF00',
      }
      
    : {
        mode: 'light' as const,
        primary: {
          main: '#1e2a44',
          light: '#2b3a5c',
          contrastText: '#ffffff',
        },
        secondary: {
          main: '#cfe0f5',
          contrastText: '#1e2a44',
        },
        background: {
          default: '#f5f5f7',
          paper: '#ffffff',
        },
        text: {
          primary: '#16181d',
          secondary: '#6b7280',
        },
        divider: '#e2e4e9',
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