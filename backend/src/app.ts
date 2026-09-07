import cors from 'cors'
import express from 'express'
import { config } from './config'
import { errorHandler, notFoundHandler } from './errors'

/**
 * Builds the Express app: CORS, JSON body parsing and the shared error
 * handling. 
 */
export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', 1) // container hosts sit behind a proxy; needed for correct client IPs

  app.use(
    cors({
      origin(origin, cb) {
        const ok = !origin || config.corsOrigins.includes(origin) || /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)
        cb(null, ok)
      },
      allowedHeaders: ['Authorization', 'Content-Type'],
    }),
  )
  app.use(express.json({ limit: '1mb' }))

  const v1 = express.Router()
  app.use('/v1', v1)

  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}
