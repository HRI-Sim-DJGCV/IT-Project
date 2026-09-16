import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // config.ts validates these at import time. Nothing in the tests connects
    // to a database, so any syntactically valid values will do.
    env: {
      MONGODB_URI: 'mongodb://localhost:27017',
      MONGODB_DB_NAME: 'walkingapp-test',
      JWT_SECRET: 'test-only-secret-that-is-at-least-32-characters-long',
      NODE_ENV: 'test',
      CORS_ORIGINS: 'http://localhost:5173',
    },
  },
})
