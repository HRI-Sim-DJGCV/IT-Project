import dotenv from 'dotenv'
import path from 'node:path'
import { z } from 'zod'

// The universal .env lives at the repo root; a backend/.env, if present,
// overrides it, and variables already in the environment win over both.
dotenv.config({
  path: [path.resolve('.env'), path.resolve('../.env')],
})

const schema = z.object({
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required (see backend/.env)'),
  MONGODB_DB_NAME: z.string().min(1).default('walkingapp'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('24h'),
  PORT: z.coerce.number().int().positive().default(8000),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  NODE_ENV: z.string().default('development'),
  /** Optional so the API can boot without it (e.g. the keyless docker quick start); route generation errors until it is set. */
  GOOGLE_MAPS_API_KEY: z.string().default(''),
  /** The internal Python AI service (routes, script generation, text-to-speech). Never exposed to the app. */
  AI_SERVICE_URL: z.string().url().default('http://localhost:8001'),
  /** Optional shared secret sent as X-Internal-Key; set the same value in server/.env */
  AI_INTERNAL_KEY: z.string().optional(),
  /** Script generation + audio can take minutes on CPU. Per-call timeout. */
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(15 * 60_000),
  /** Where generated mp3 files are written. One folder per walk preparation. */
  AUDIO_DIR: z.string().default('./data/audio'),
})

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  const lines = parsed.error.issues.map(
    (issue) => `  ${issue.path.join('.')}: ${issue.message}`,
  )
  throw new Error(`Invalid environment:\n${lines.join('\n')}`)
}

export const config = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  isProduction: parsed.data.NODE_ENV === 'production',
  audioDir: path.resolve(parsed.data.AUDIO_DIR),
}
