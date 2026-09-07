import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { checkServerHealth } from './api'


if (import.meta.env.DEV) {
  void checkServerHealth()
    .then((health) => console.info('Python server:', health.status))
    .catch((error) => console.error('Python server connection failed:', error))
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
