import { Router } from 'express'
import { SURVEY_VERSION } from '../../../shared/survey'
import type { LoginResponse, WalkHistoryResponse } from '../../../shared/types'
import { currentUser, requireAuth, requireParticipant } from '../auth/middleware'
import { conflict, notFound, parse } from '../errors'
import { Account } from '../models/Account'
import { Condition } from '../models/Condition'
import { WalkRecord } from '../models/WalkRecord'
import { toParticipant, toWalkRecord } from '../services/serializers'
import { saveWalkSchema, walkHistoryQuerySchema } from '../validation'

export const meRouter = Router()
meRouter.use(requireAuth)

/** GET /me: restore a session from a stored token. */
meRouter.get('/', async (req, res) => {
  const user = currentUser(req)
  const account = await Account.findById(user.id).lean()
  if (!account || !account.active) throw notFound('Account')
  const body: Omit<LoginResponse, 'token' | 'expiresAt'> = {
    role: account.role,
    participant: account.role === 'participant' ? toParticipant(account) : null,
  }
  res.json(body)
})

/** GET /me/walks: newest first, cursor-paged. */
meRouter.get('/walks', requireParticipant, async (req, res) => {
  const user = currentUser(req)
  const q = parse(walkHistoryQuerySchema, req.query)
  const filter: Record<string, unknown> = { participantId: user.id }
  if (q.before) filter.date = { $lt: new Date(q.before) }
  const docs = await WalkRecord.find(filter)
    .sort({ date: -1 })
    .limit(q.limit + 1)
    .lean()
  const page = docs.slice(0, q.limit)
  const last = page[page.length - 1]
  const body: WalkHistoryResponse = {
    walks: page.map(toWalkRecord),
    nextBefore: docs.length > q.limit && last ? last.date.toISOString() : null,
  }
  res.json(body)
})

/** POST /me/walks: save a completed walk. `clientId` is the idempotency key. */
meRouter.post('/walks', requireParticipant, async (req, res) => {
  const user = currentUser(req)
  const body = parse(saveWalkSchema, req.body)
  const clientId = (body.clientId ?? body.id) as string

  const existing = await WalkRecord.findOne({ participantId: user.id, clientId }).lean()
  if (existing) {
    res.status(200).json(toWalkRecord(existing))
    return
  }

  // Condition is read from the account, not the token, so a reassignment after login is honoured.
  const account = await Account.findById(user.id).lean()
  if (!account || !account.active || !account.condition) throw notFound('Participant')
  const condition = await Condition.findById(account.condition).lean()
  if (!condition) throw conflict(`Condition "${account.condition}" no longer exists.`)

  try {
    const created = await WalkRecord.create({
      clientId,
      participantId: user.id,
      condition: account.condition,
      date: new Date(body.date),
      plan: body.plan,
      route: body.route,
      preSurvey: body.preSurvey,
      postSurvey: body.postSurvey,
      actualMinutes: body.actualMinutes,
      scriptVersion: body.scriptVersion ?? condition.scriptVersion,
      surveyVersion: SURVEY_VERSION,
      completed: true,
    })
    res.status(201).json(toWalkRecord(created.toObject()))
  } catch (err) {
    // Lost a race with a retried request: return the record that won.
    if ((err as { code?: number }).code === 11000) {
      const winner = await WalkRecord.findOne({ participantId: user.id, clientId }).lean()
      if (winner) {
        res.status(200).json(toWalkRecord(winner))
        return
      }
    }
    throw err
  }
})
