{/* NOTE: Not to be confused with ThemeProvider from MUI */}
{/* This provider reads from HighContrastContext.tsx (highContrast value) and calls createAppTheme fx */}

import { useMemo, type ReactNode } from 'react'
import CssBaseline from '@mui/material/CssBaseline'

import { ThemeProvider } from '@mui/material/styles'
import { useHighContrast } from './context/HighContrastContext'
import { createAppTheme } from './theme'

{/* react content within tags children = <App /> */}
export function AppThemeProvider({ children }: { children: ReactNode }) {
  const { highContrast } = useHighContrast()
  const theme = useMemo(
    () => createAppTheme(highContrast),
    [highContrast],
  )

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  )
}