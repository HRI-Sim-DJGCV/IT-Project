import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

const shared = fileURLToPath(new URL('../shared', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // The domain types and survey constants are shared with the backend (see ../shared).
    alias: { '@shared': shared },
  },
  server: {
    fs: { allow: ['.', shared] },
  },
})
