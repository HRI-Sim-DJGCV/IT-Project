import cors from 'cors'
import express from 'express'
import { config } from './config'
import { dbState } from './db'
import { errorHandler, notFoundHandler } from './errors'
import { adminRouter } from './routes/admin'
import { authRouter } from './routes/auth'
import { meRouter } from './routes/me'
import { participantRouter } from './routes/participant'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', 1) // container hosts sit behind a proxy; needed for correct rate-limit IPs

  app.use(
    cors({
      origin(origin, cb) {
        // Allow configured origins plus any *.vercel.app preview. No Origin header = same-origin or curl.
        const ok = !origin || config.corsOrigins.includes(origin) || /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)
        cb(null, ok)
      },
      allowedHeaders: ['Authorization', 'Content-Type'],
    }),
  )
  app.use(express.json({ limit: '1mb' }))

  const v1 = express.Router()
  v1.get('/health', (_req, res) => {
    res.json({ ok: dbState() === 'connected', db: dbState() })
  })
  // Each router is mounted under its own prefix so its router-level auth
  // middleware only ever sees its own routes.
  v1.use('/auth', authRouter)
  v1.use('/me', meRouter)
  v1.use(participantRouter) // per-route middleware; owns /routes/* and /scripts
  v1.use('/admin', adminRouter)
  app.use('/v1', v1)

  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}
