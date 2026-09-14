import { Router } from 'express'
import type { ScriptResponse } from '../../../shared/types'
import { currentUser, requireAuth, requireParticipant } from '../auth/middleware'
import { notFound, parse } from '../errors'
import { Account } from '../models/Account'
import { Condition } from '../models/Condition'
import { generateWalkingRoute } from '../services/openRouteService'
import { scaleScript } from '../services/scriptTemplate'
import { generateRoutesSchema, scriptQuerySchema } from '../validation'

export const participantRouter = Router()
// This router is mounted at the API root, so auth is attached per route rather
// than with router.use(), which would run for every request in the app.

/** POST /routes/generate: always exactly three options. */
/** POST /routes/generate: generates a real walking route for the selected plan. */
participantRouter.post(
  '/routes/generate',
  requireAuth,
  requireParticipant,
  async (req, res) => {
    const body = parse(generateRoutesSchema, req.body)
    const route = await generateWalkingRoute(body)

    res.json({
      routes: [route],
    })
  },
)

/** GET /scripts?duration=: the condition comes from the account, never the query. */
participantRouter.get('/scripts', requireAuth, requireParticipant, async (req, res) => {
  const user = currentUser(req)
  const q = parse(scriptQuerySchema, req.query)
  const account = await Account.findById(user.id).lean()
  if (!account?.condition) throw notFound('Participant')
  const condition = await Condition.findById(account.condition).lean()
  if (!condition) throw notFound('Condition')
  const body: ScriptResponse = {
    condition: condition._id,
    scriptVersion: condition.scriptVersion,
    segments: scaleScript(condition.script, q.duration),
  }
  res.json(body)
})
