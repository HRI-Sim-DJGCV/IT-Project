import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

const shared = fileURLToPath(new URL('../shared', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // VITE_* variables come from the universal .env at the repo root.
  envDir: fileURLToPath(new URL('..', import.meta.url)),
  resolve: {
    // The domain types and survey constants are shared with the backend (see ../shared).
    alias: { '@shared': shared },
  },
  server: {
    fs: { allow: ['.', shared] },
  },
})
