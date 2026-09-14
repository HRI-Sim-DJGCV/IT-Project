import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import type { RoutesResponse } from '../../../shared/types'
import { requireAuth, requireParticipant } from '../auth/middleware'
import { parse } from '../errors'
import { generateWalkingRoutes } from '../services/routeGenerationService'
import { generateRoutesSchema } from '../validation'

export const participantRouter = Router()
// This router is mounted at the API root, so auth is attached per route rather
// than with router.use(), which would run for every request in the app.

// Every call fans out to paid Google Routes requests, so cap the spend per IP.
// A real participant taps "Generate route" a handful of times per walk.
const routesLimiter = rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: true, legacyHeaders: false })

/** POST /routes/generate: up to three distinct routes honouring the selected route type, best match first. */
participantRouter.post('/routes/generate', routesLimiter, requireAuth, requireParticipant, async (req, res) => {
  const plan = parse(generateRoutesSchema, req.body)
  const body: RoutesResponse = { routes: await generateWalkingRoutes(plan) }
  res.json(body)
})
