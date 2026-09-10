import 'dotenv/config'
import { z } from 'zod'

const schema = z.object({
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required (see backend/.env)'),
  MONGODB_DB_NAME: z.string().min(1).default('walkingapp'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('24h'),
  PORT: z.coerce.number().int().positive().default(8000),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  NODE_ENV: z.string().default('development'),
})

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  const lines = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`)
  throw new Error(`Invalid environment:\n${lines.join('\n')}`)
}

export const config = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  isProduction: parsed.data.NODE_ENV === 'production',
}
