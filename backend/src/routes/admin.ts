import { Router } from 'express'
import { SCORING_VERSION, calmScore, walkScores } from '../../../shared/scoring'
import { SURVEY_ITEMS, SURVEY_VERSION } from '../../../shared/survey'
import type { AdminParticipantItem, CreateParticipantResult, SurveyResponse } from '../../../shared/types'
import { currentUser, requireAdmin, requireAuth } from '../auth/middleware'
import { conflict, notFound, parse } from '../errors'
import { Account, type AccountDoc } from '../models/Account'
import { Condition } from '../models/Condition'
import { ParticipantMetrics } from '../models/ParticipantMetrics'
import { WalkRecord, type WalkRecordDoc } from '../models/WalkRecord'
import { WeeklyReport } from '../models/WeeklyReport'
import { generateAccessCode, hashAccessCode } from '../services/accessCode'
import { nextParticipantId } from '../services/participantIds'
import { toConditionSetting, toWalkRecord } from '../services/serializers'
import { triggerWeeklyAnalytics } from '../services/cronService'
import {
  conditionListSchema,
  conditionUpdateSchema,
  createParticipantSchema,
  patchParticipantSchema,
} from '../validation'

export const adminRouter = Router()
adminRouter.use(requireAuth, requireAdmin)

// ---------------------------------------------------------------------------
// Conditions: name + voice persona only. Scripts are AI-generated per walk
// and can never be uploaded or edited here.
// ---------------------------------------------------------------------------

/** GET /admin/conditions */
adminRouter.get('/conditions', async (_req, res) => {
  const docs = await Condition.find().sort({ _id: 1 }).lean()
  res.json({ conditions: docs.map(toConditionSetting) })
})

/**
 * PUT /admin/conditions: replace the whole settings list (what the admin
 * Settings screen saves). Conditions are never deleted here because
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
        update: { $set: { name: c.name, voice: c.voice, age: c.age, updatedAt: now, updatedBy: user.id } },
        upsert: true,
      },
    })),
  )
  const docs = await Condition.find().sort({ _id: 1 }).lean()
  res.json({ conditions: docs.map(toConditionSetting) })
})

/** PUT /admin/conditions/{id}: edit one condition's name, voice or age. */
adminRouter.put('/conditions/:id', async (req, res) => {
  const user = currentUser(req)
  const id = String(req.params.id)
  const body = parse(conditionUpdateSchema, req.body)
  const existing = await Condition.findById(id)
  const now = new Date()
  if (!existing) {
    if (!body.name || !body.voice || body.age === undefined) throw notFound('Condition')
    const created = await Condition.create({ _id: id, name: body.name, voice: body.voice, age: body.age, updatedAt: now, updatedBy: user.id })
    res.status(201).json(toConditionSetting(created.toObject()))
    return
  }
  if (body.name !== undefined) existing.name = body.name
  if (body.voice !== undefined) existing.voice = body.voice
  if (body.age !== undefined) existing.age = body.age
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
    latestScores: latest ? walkScores(latest.preSurvey, latest.postSurvey ?? null) : null,
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

/** GET /admin/walks: every walk, newest first, with `condition`, `scores` and the generated script. */
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

/** GET /admin/export.csv: one row per walk, raw answers plus derived scores and the script that was read. */
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
    'via_park',
    'distance_km',
    'actual_minutes',
    'completed',
    ...SURVEY_ITEMS.map((i) => `pre_${i.key}`),
    ...SURVEY_ITEMS.map((i) => `post_${i.key}`),
    'pre_calm_score',
    'post_calm_score',
    'delta_calm_score',
    'scoring_version',
    'survey_version',
    'script_model',
    'script_prompt_version',
    'script_voice',
    'script_word_count',
    'script_text',
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
      w.route.park?.name ?? '',
      w.route.distanceKm,
      w.actualMinutes,
      w.completed,
      ...SURVEY_ITEMS.map((i) => w.preSurvey[i.key] ?? ''),
      ...SURVEY_ITEMS.map((i) => w.postSurvey?.[i.key] ?? ''),
      r.scores?.pre.calm,
      r.scores?.post?.calm ?? '',
      r.scores?.delta?.calm ?? '',
      SCORING_VERSION,
      w.surveyVersion ?? SURVEY_VERSION,
      w.script?.model ?? '',
      w.script?.promptVersion ?? '',
      w.script?.voice.speaker ?? '',
      w.script ? w.script.rawText.split(/\s+/).filter(Boolean).length : '',
      w.script?.rawText ?? '',
    ]
  })
  const csv = [headers, ...rows].map((row) => row.map(csvQuote).join(',')).join('\r\n') + '\r\n'
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="walks-${new Date().toISOString().slice(0, 10)}.csv"`)
  res.send(csv)
})

// ---------------------------------------------------------------------------
// Analytics: Weekly reports and participant metrics
// ---------------------------------------------------------------------------

/**
 * GET /admin/analytics/dashboard: Current week summary for the dashboard.
 * Returns the most recent weekly report (or null if none exists).
 */
adminRouter.get('/analytics/dashboard', async (_req, res) => {
  const report = await WeeklyReport.findOne().sort({ week: -1 }).lean()
  if (!report) {
    res.json({
      report: null,
      message: 'No analytics data available yet. Reports are generated every Monday at 00:00 UTC.',
    })
    return
  }
  res.json({ report })
})

/**
 * GET /admin/analytics/reports: Paginated list of weekly reports.
 * Query params: page (default 1), limit (default 10, max 50)
 */
adminRouter.get('/analytics/reports', async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? 1), 10))
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? 10), 10)))
  const skip = (page - 1) * limit

  const [reports, total] = await Promise.all([
    WeeklyReport.find().sort({ week: -1 }).skip(skip).limit(limit).lean(),
    WeeklyReport.countDocuments(),
  ])

  res.json({
    reports,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  })
})

/**
 * GET /admin/analytics/reports/:week: Get report for a specific week.
 * Week should be a valid ISO date string (e.g., 2024-10-07 for the week starting Monday).
 */
adminRouter.get('/analytics/reports/:week', async (req, res) => {
  const weekStr = String(req.params.week)
  const weekDate = new Date(`${weekStr}T00:00:00Z`)
  if (Number.isNaN(weekDate.getTime())) {
    throw conflict(`Invalid week date format: "${weekStr}". Use ISO format (e.g., 2024-10-07).`)
  }

  const report = await WeeklyReport.findOne({ week: weekDate }).lean()
  if (!report) throw notFound('Weekly report')

  res.json({ report })
})

/**
 * GET /admin/analytics/participants/:participantId: Get metrics for a participant.
 * Returns recent weekly metrics for trend analysis.
 * Query params: weeks (default 12, max 52)
 */
adminRouter.get('/analytics/participants/:participantId', async (req, res) => {
  const participantId = String(req.params.participantId)
  const weeksParam = parseInt(String(req.query.weeks ?? 12), 10)
  const weeks = Math.min(52, Math.max(1, weeksParam))

  const cutoff = new Date()
  cutoff.setUTCDate(cutoff.getUTCDate() - weeks * 7)

  const metrics = await ParticipantMetrics.find({
    participantId,
    weekStart: { $gte: cutoff },
  })
    .sort({ weekStart: -1 })
    .lean()

  if (metrics.length === 0) throw notFound('Participant metrics')

  res.json({
    participantId,
    metrics,
    periodWeeks: weeks,
  })
})

/**
 * POST /admin/analytics/generate: Manually trigger weekly analytics generation.
 * Generates both WeeklyReport and ParticipantMetrics for the current/specified week.
 * Query params: week (optional, ISO date string; defaults to current week)
 */
adminRouter.post('/analytics/generate', async (req, res) => {
  let targetWeek: Date | undefined
  const weekParam = req.query.week

  if (weekParam) {
    const weekStr = String(weekParam)
    const weekDate = new Date(`${weekStr}T00:00:00Z`)
    if (Number.isNaN(weekDate.getTime())) {
      throw conflict(`Invalid week date format: "${weekStr}". Use ISO format (e.g., 2024-10-07).`)
    }
    targetWeek = weekDate
  }

  const result = await triggerWeeklyAnalytics()

  res.json({
    success: true,
    message: 'Analytics generated successfully',
    data: {
      week: result.report.week,
      totalWalks: result.report.totalWalks,
      activeParticipants: result.report.activeParticipants,
      participantMetricsGenerated: result.participantCount,
    },
  })
})

/**
 * GET /admin/analytics/summary: Quick stats for the admin dashboard.
 * Returns aggregate metrics across all time.
 */
adminRouter.get('/analytics/summary', async (_req, res) => {
  const [totalReports, latestReport, participantMetricsCount] = await Promise.all([
    WeeklyReport.countDocuments(),
    WeeklyReport.findOne().sort({ week: -1 }).lean(),
    ParticipantMetrics.countDocuments(),
  ])

  const allReports = await WeeklyReport.find().select('totalWalks completedWalks activeParticipants').lean()
  const totalWalksAllTime = allReports.reduce((sum, r) => sum + r.totalWalks, 0)
  const totalCompletedAllTime = allReports.reduce((sum, r) => sum + r.completedWalks, 0)

  res.json({
    reports: {
      total: totalReports,
      latest: latestReport ?? null,
    },
    metrics: {
      participantMetricsRecorded: participantMetricsCount,
      totalWalksAllTime,
      totalCompletedAllTime,
      overallCompletionRate:
        totalWalksAllTime > 0
          ? Math.round((totalCompletedAllTime / totalWalksAllTime) * 10000) / 100
          : 0,
    },
  })
})
