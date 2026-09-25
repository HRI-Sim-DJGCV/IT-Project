import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AppThemeProvider } from './ContrastThemeProvider'
import { HighContrastProvider } from './context/HighContrastContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* wrapper start */}
    <HighContrastProvider>
      <AppThemeProvider>
        <App />
      </AppThemeProvider>
    </HighContrastProvider>
    {/* wrapper end */}
  </StrictMode>,
)
