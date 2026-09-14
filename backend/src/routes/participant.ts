import { Router } from 'express'
import type { RoutesResponse } from '../../../shared/types'
import { requireAuth, requireParticipant } from '../auth/middleware'
import { parse } from '../errors'
import { generateWalkingRoute } from '../services/routeGenerationService'
import { generateRoutesSchema } from '../validation'

export const participantRouter = Router()
// This router is mounted at the API root, so auth is attached per route rather
// than with router.use(), which would run for every request in the app.

/** POST /routes/generate: a real route honouring the selected route type (loop, out-and-back, quiet streets, green space). */
participantRouter.post('/routes/generate', requireAuth, requireParticipant, async (req, res) => {
  const plan = parse(generateRoutesSchema, req.body)
  const body: RoutesResponse = { routes: [await generateWalkingRoute(plan)] }
  res.json(body)
})
