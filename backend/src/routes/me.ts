import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { Types } from 'mongoose'
import { SURVEY_VERSION } from '../../../shared/survey'
import type { LoginResponse, PreparationResponse, WalkHistoryResponse } from '../../../shared/types'
import { currentUser, requireAuth, requireParticipant } from '../auth/middleware'
import { ApiError, conflict, notFound, parse } from '../errors'
import { Account } from '../models/Account'
import { Condition } from '../models/Condition'
import { WalkPreparation } from '../models/WalkPreparation'
import { WalkRecord } from '../models/WalkRecord'
import { audioPath, buildContext, runPreparation } from '../services/preparation'
import { toParticipant, toPreparation, toWalkRecord } from '../services/serializers'
import { prepareWalkSchema, saveWalkSchema, walkHistoryQuerySchema } from '../validation'

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

// ---------------------------------------------------------------------------
// Walk preparation: generate the script and audio before the walk starts
// ---------------------------------------------------------------------------

async function participantCondition(userId: string) {
  const account = await Account.findById(userId).lean()
  if (!account || !account.active || !account.condition) throw notFound('Participant')
  const condition = await Condition.findById(account.condition).lean()
  if (!condition) throw conflict(`Condition "${account.condition}" no longer exists.`)
  return { account, condition }
}

// Each preparation spends OpenAI credits and minutes of TTS compute, so cap
// starts per IP. Polling GET /me/walks/prepare/{id} is deliberately unlimited.
const prepareLimiter = rateLimit({ windowMs: 60_000, limit: 5, standardHeaders: true, legacyHeaders: false })

/** POST /me/walks/prepare: start generating. Returns 202 immediately; poll GET /me/walks/prepare/{id}. */
meRouter.post('/walks/prepare', prepareLimiter, requireParticipant, async (req, res) => {
  const user = currentUser(req)
  const body = parse(prepareWalkSchema, req.body)
  const { account, condition } = await participantCondition(user.id)
  const created = await WalkPreparation.create({
    participantId: user.id,
    condition: account.condition,
    plan: body.plan,
    route: body.route,
    context: buildContext(body.plan),
    status: 'pending',
    progress: { done: 0, total: 0 },
  })
  // Fire and forget: the runner records every outcome on the document.
  void runPreparation(created._id, condition)
  const out: PreparationResponse = { preparation: toPreparation(created.toObject()) }
  res.status(202).json(out)
})

function ownPreparation(userId: string, id: string) {
  if (!Types.ObjectId.isValid(id)) throw notFound('Preparation')
  return WalkPreparation.findOne({ _id: id, participantId: userId }).lean()
}

/** GET /me/walks/prepare/{id}: status, progress and (when ready) the script. */
meRouter.get('/walks/prepare/:id', requireParticipant, async (req, res) => {
  const user = currentUser(req)
  const prep = await ownPreparation(user.id, String(req.params.id))
  if (!prep) throw notFound('Preparation')
  const out: PreparationResponse = { preparation: toPreparation(prep) }
  res.json(out)
})

/** GET /me/walks/prepare/{id}/audio/{index}: one mp3 segment. The app fetches these with its token before the walk. */
meRouter.get('/walks/prepare/:id/audio/:index', requireParticipant, async (req, res) => {
  const user = currentUser(req)
  const prep = await ownPreparation(user.id, String(req.params.id))
  if (!prep || prep.status !== 'ready' || !prep.script) throw notFound('Audio')
  const index = Number(req.params.index)
  if (!Number.isInteger(index) || !prep.script.segments.some((s) => s.audioIndex === index)) throw notFound('Audio')
  const file = audioPath(prep._id, index)
  let size: number
  try {
    size = (await stat(file)).size
  } catch {
    throw new ApiError(410, 'NOT_FOUND', 'This audio is no longer available. Please prepare the walk again.')
  }
  res.setHeader('Content-Type', 'audio/mpeg')
  res.setHeader('Content-Length', String(size))
  res.setHeader('Cache-Control', 'private, max-age=86400')
  createReadStream(file).pipe(res)
})

/** POST /me/walks: save a completed walk. `clientId` is the idempotency key; the script comes from the preparation. */
meRouter.post('/walks', requireParticipant, async (req, res) => {
  const user = currentUser(req)
  const body = parse(saveWalkSchema, req.body)

  const existing = await WalkRecord.findOne({ participantId: user.id, clientId: body.clientId }).lean()
  if (existing) {
    res.status(200).json(toWalkRecord(existing))
    return
  }

  const prep = await ownPreparation(user.id, body.preparationId)
  if (!prep || prep.status !== 'ready' || !prep.script) {
    throw new ApiError(409, 'CONFLICT', 'This walk has no generated script. Please prepare the walk again.')
  }

  // Condition is read from the account, not the token, so a reassignment after login is honoured.
  const { account } = await participantCondition(user.id)

  try {
    const created = await WalkRecord.create({
      clientId: body.clientId,
      participantId: user.id,
      condition: account.condition,
      date: new Date(body.date),
      plan: body.plan,
      route: body.route,
      preSurvey: body.preSurvey,
      postSurvey: body.postSurvey,
      actualMinutes: body.actualMinutes,
      preparationId: prep._id,
      script: prep.script,
      surveyVersion: SURVEY_VERSION,
      completed: true,
    })
    res.status(201).json(toWalkRecord(created.toObject()))
  } catch (err) {
    // Two identical requests raced past the lookup above: return the one that won.
    if ((err as { code?: number }).code === 11000) {
      const winner = await WalkRecord.findOne({ participantId: user.id, clientId: body.clientId }).lean()
      if (winner) {
        res.status(200).json(toWalkRecord(winner))
        return
      }
    }
    throw err
  }
})
