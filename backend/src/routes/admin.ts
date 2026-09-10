import { Router } from 'express'
import { SCORING_VERSION, calmScore } from '../../../shared/scoring'
import { SURVEY_ITEMS, SURVEY_VERSION, scaleLabel } from '../../../shared/survey'
import type { AdminParticipantItem, CreateParticipantResult, SurveyResponse } from '../../../shared/types'
import { currentUser, requireAdmin, requireAuth } from '../auth/middleware'
import { conflict, notFound, parse } from '../errors'
import { Account, type AccountDoc } from '../models/Account'
import { Condition } from '../models/Condition'
import { WalkRecord, type WalkRecordDoc } from '../models/WalkRecord'
import { generateAccessCode, hashAccessCode } from '../services/accessCode'
import { nextParticipantId } from '../services/participantIds'
import { DEFAULT_SCRIPT } from '../services/scriptTemplate'
import { toConditionSetting, toWalkRecord } from '../services/serializers'
import {
  conditionListSchema,
  conditionUpdateSchema,
  createParticipantSchema,
  patchParticipantSchema,
} from '../validation'

export const adminRouter = Router()
adminRouter.use(requireAuth, requireAdmin)

// ---------------------------------------------------------------------------
// Conditions
// ---------------------------------------------------------------------------

/** GET /admin/conditions */
adminRouter.get('/conditions', async (_req, res) => {
  const docs = await Condition.find().sort({ _id: 1 }).lean()
  res.json({ conditions: docs.map(toConditionSetting) })
})

/**
 * PUT /admin/conditions: replace the whole settings list (what the admin
 * Settings screen saves). New ids are created with the default script;
 * existing ones keep their script. Conditions are never deleted here because
 * participants and walks reference them.
 */
adminRouter.put('/conditions', async (req, res) => {
  const user = currentUser(req)
  const raw = req.body
  const items = parse(conditionListSchema, Array.isArray(raw) ? raw : raw?.conditions)
  const ids = new Set<string>()
  for (const c of items) {
    if (ids.has(c.id)) throw conflict(`Duplicate condition id "${c.id}".`)
    ids.add(c.id)
  }
  const now = new Date()
  await Condition.bulkWrite(
    items.map((c) => ({
      updateOne: {
        filter: { _id: c.id },
        update: {
          $set: { name: c.name, voice: c.voice, age: c.age, updatedAt: now, updatedBy: user.id },
          $setOnInsert: { scriptVersion: 1, script: DEFAULT_SCRIPT, scriptHistory: [] },
        },
        upsert: true,
      },
    })),
  )
  const docs = await Condition.find().sort({ _id: 1 }).lean()
  res.json({ conditions: docs.map(toConditionSetting) })
})

/** PUT /admin/conditions/{id}: edit one condition. Changing `script` bumps scriptVersion. */
adminRouter.put('/conditions/:id', async (req, res) => {
  const user = currentUser(req)
  const id = String(req.params.id)
  const body = parse(conditionUpdateSchema, req.body)
  const existing = await Condition.findById(id)
  const now = new Date()
  if (!existing) {
    if (!body.name || !body.voice || body.age === undefined) throw notFound('Condition')
    const created = await Condition.create({
      _id: id,
      name: body.name,
      voice: body.voice,
      age: body.age,
      scriptVersion: 1,
      script: body.script ?? DEFAULT_SCRIPT,
      scriptHistory: [],
      updatedAt: now,
      updatedBy: user.id,
    })
    res.status(201).json(toConditionSetting(created.toObject()))
    return
  }
  if (body.name !== undefined) existing.name = body.name
  if (body.voice !== undefined) existing.voice = body.voice
  if (body.age !== undefined) existing.age = body.age
  if (body.script) {
    existing.scriptHistory.push({ scriptVersion: existing.scriptVersion, script: existing.script, retiredAt: now })
    existing.script = body.script
    existing.scriptVersion += 1
  }
  existing.updatedAt = now
  existing.updatedBy = user.id
  await existing.save()
  res.json(toConditionSetting(existing.toObject()))
})

// ---------------------------------------------------------------------------
// Participants
// ---------------------------------------------------------------------------

interface WalkSummary {
  count: number
  latest: WalkRecordDoc | null
}

/** One aggregation for the whole list: walk count and latest walk per participant. */
async function walkSummaries(): Promise<Map<string, WalkSummary>> {
  const rows = await WalkRecord.aggregate<{ _id: string; count: number; latest: WalkRecordDoc }>([
    { $sort: { date: -1 } },
    { $group: { _id: '$participantId', count: { $sum: 1 }, latest: { $first: '$$ROOT' } } },
  ])
  return new Map(rows.map((r) => [r._id, { count: r.count, latest: r.latest }]))
}

function toAdminItem(a: AccountDoc, s: WalkSummary | undefined): AdminParticipantItem {
  const latest = s?.latest ?? null
  return {
    id: a._id,
    condition: a.condition ?? '',
    status: latest ? (latest.completed ? 'Completed' : 'In progress') : 'Not started',
    walkCount: s?.count ?? 0,
    lastWalkAt: latest ? new Date(latest.date).toISOString() : null,
    stressStart: scaleLabel(latest?.preSurvey.tense),
    stressEnd: scaleLabel(latest?.postSurvey?.tense),
    active: a.active,
  }
}

/** GET /admin/participants: most recently joined first. */
adminRouter.get('/participants', async (_req, res) => {
  const [accounts, summaries] = await Promise.all([
    Account.find({ role: 'participant' }).sort({ joinedAt: -1 }).lean(),
    walkSummaries(),
  ])
  res.json({ participants: accounts.map((a) => toAdminItem(a, summaries.get(a._id))) })
})

/** POST /admin/participants: server assigns the AAA### id; access code returned exactly once. */
adminRouter.post('/participants', async (req, res) => {
  const user = currentUser(req)
  const body = parse(createParticipantSchema, req.body)
  if (!(await Condition.exists({ _id: body.condition }))) throw conflict(`Unknown condition "${body.condition}".`)

  const accessCode = generateAccessCode()
  let created: AccountDoc | null = null
  for (let attempt = 0; attempt < 3 && !created; attempt++) {
    const id = await nextParticipantId()
    try {
      const doc = await Account.create({
        _id: id,
        role: 'participant',
        passwordHash: null,
        displayName: `Participant ${id}`,
        condition: body.condition,
        accessCodeHash: hashAccessCode(accessCode),
        joinedAt: new Date(),
        createdBy: user.id,
        active: true,
      })
      created = doc.toObject()
    } catch (err) {
      if ((err as { code?: number }).code !== 11000) throw err // id race: retry with the next id
    }
  }
  if (!created) throw conflict('Could not allocate a participant id, please retry.')
  const result: CreateParticipantResult = { participant: toAdminItem(created, undefined), accessCode }
  res.status(201).json(result)
})

/** PATCH /admin/participants/{id}: change condition or deactivate. */
adminRouter.patch('/participants/:id', async (req, res) => {
  const body = parse(patchParticipantSchema, req.body)
  if (body.condition && !(await Condition.exists({ _id: body.condition }))) {
    throw conflict(`Unknown condition "${body.condition}".`)
  }
  const set: Record<string, unknown> = {}
  if (body.condition) set.condition = body.condition
  if (body.active !== undefined) set.active = body.active
  const updated = await Account.findOneAndUpdate(
    { _id: String(req.params.id), role: 'participant' },
    { $set: set },
    { new: true },
  ).lean()
  if (!updated) throw notFound('Participant')
  const summaries = await walkSummaries()
  res.json(toAdminItem(updated, summaries.get(updated._id)))
})

/** GET /admin/participants/{id}/walks */
adminRouter.get('/participants/:id/walks', async (req, res) => {
  const id = String(req.params.id)
  if (!(await Account.exists({ _id: id, role: 'participant' }))) throw notFound('Participant')
  const docs = await WalkRecord.find({ participantId: id }).sort({ date: -1 }).lean()
  res.json({ walks: docs.map(toWalkRecord), nextBefore: null })
})

// ---------------------------------------------------------------------------
// Walks, stats, export
// ---------------------------------------------------------------------------

/** GET /admin/walks: every walk, newest first, with `condition` and `scores`. */
adminRouter.get('/walks', async (_req, res) => {
  const docs = await WalkRecord.find().sort({ date: -1 }).lean()
  res.json({ walks: docs.map(toWalkRecord) })
})

/** GET /admin/stats: counts and mean calm scores per condition. */
adminRouter.get('/stats', async (_req, res) => {
  const [conditions, accounts, walks] = await Promise.all([
    Condition.find().sort({ _id: 1 }).lean(),
    Account.find({ role: 'participant' }, { condition: 1 }).lean(),
    WalkRecord.find().lean(),
  ])
  const mean = (xs: number[]) =>
    xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : null
  const perCondition = conditions.map((c) => {
    const own = walks.filter((w) => w.condition === c._id)
    const withPost = own.filter((w): w is typeof w & { postSurvey: SurveyResponse } => !!w.postSurvey)
    return {
      condition: c._id,
      name: c.name,
      participants: accounts.filter((a) => a.condition === c._id).length,
      walks: own.length,
      meanPreCalm: mean(own.map((w) => calmScore(w.preSurvey))),
      meanPostCalm: mean(withPost.map((w) => calmScore(w.postSurvey))),
      meanDeltaCalm: mean(withPost.map((w) => calmScore(w.postSurvey) - calmScore(w.preSurvey))),
    }
  })
  res.json({
    scoringVersion: SCORING_VERSION,
    totals: { participants: accounts.length, walks: walks.length },
    perCondition,
  })
})

const csvQuote = (v: unknown) => `"${(v === null || v === undefined ? '' : String(v)).replace(/"/g, '""')}"`

/** GET /admin/export.csv: one row per walk, raw answers plus derived scores. */
adminRouter.get('/export.csv', async (_req, res) => {
  const docs = await WalkRecord.find().sort({ date: -1 }).lean()
  const headers = [
    'participant_id',
    'condition',
    'walk_id',
    'date',
    'planned_minutes',
    'route_type',
    'route_name',
    'distance_km',
    'actual_minutes',
    'completed',
    ...SURVEY_ITEMS.map((i) => `pre_${i.key}`),
    ...SURVEY_ITEMS.map((i) => `post_${i.key}`),
    'pre_calm_score',
    'post_calm_score',
    'delta_calm_score',
    'scoring_version',
    'script_version',
    'survey_version',
  ]
  const rows = docs.map((w) => {
    const r = toWalkRecord(w)
    return [
      w.participantId,
      w.condition,
      r.id,
      r.date,
      w.plan.duration,
      w.plan.routeType,
      w.route.name,
      w.route.distanceKm,
      w.actualMinutes,
      w.completed,
      ...SURVEY_ITEMS.map((i) => w.preSurvey[i.key] ?? ''),
      ...SURVEY_ITEMS.map((i) => w.postSurvey?.[i.key] ?? ''),
      r.scores?.pre.calm,
      r.scores?.post?.calm ?? '',
      r.scores?.delta?.calm ?? '',
      SCORING_VERSION,
      w.scriptVersion,
      w.surveyVersion ?? SURVEY_VERSION,
    ]
  })
  const csv = [headers, ...rows].map((row) => row.map(csvQuote).join(',')).join('\r\n') + '\r\n'
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="walks-${new Date().toISOString().slice(0, 10)}.csv"`)
  res.send(csv)
})
