import { WalkRecord } from '../models/WalkRecord'
import { ParticipantMetrics } from '../models/ParticipantMetrics'
import { WeeklyReport } from '../models/WeeklyReport'
import { Account } from '../models/Account'
import type { ParticipantMetricsDoc } from '../models/ParticipantMetrics'
import type { WeeklyReportDoc } from '../models/WeeklyReport'

/**
 * Get Monday of a given date (start of week)
 */
function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getUTCDay()
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d.setUTCDate(diff))
  monday.setUTCHours(0, 0, 0, 0)
  return monday
}

/**
 * Calculate calm score from survey responses
 */
function extractCalmScore(survey: Record<string, unknown>): number {
  if (!survey || typeof survey !== 'object') return 0

  // Look for common calm/stress scale questions
  const calmFields = ['calm', 'calmness', 'stress', 'anxiety', 'wellbeing']
  for (const field of calmFields) {
    const value = (survey as Record<string, unknown>)[field]
    if (typeof value === 'number') {
      // Normalize to 0-100 scale
      if (value <= 10) return (value / 10) * 100
      if (value <= 100) return value
    }
  }

  return 0
}

/**
 * Generate ParticipantMetrics for a specific participant and week
 */
export async function generateParticipantMetrics(
  participantId: string,
  weekStart: Date,
): Promise<ParticipantMetricsDoc | null> {
  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)

  const walks = await WalkRecord.find({
    participantId,
    date: { $gte: weekStart, $lt: weekEnd },
  })

  if (walks.length === 0) return null

  const completedWalks = walks.filter((w) => w.completed).length
  const calmScores = walks
    .filter((w) => w.postSurvey)
    .map((w) => extractCalmScore(w.postSurvey as Record<string, unknown>))
    .filter((score) => score > 0)

  const averageCalmScore =
    calmScores.length > 0 ? calmScores.reduce((a, b) => a + b, 0) / calmScores.length : 0

  const totalDuration = walks.reduce((sum, w) => sum + w.actualMinutes, 0)
  const averageWalkDuration = walks.length > 0 ? totalDuration / walks.length : 0

  // Route type preferences
  const routeTypePreferences: Record<string, number> = {}
  for (const walk of walks) {
    const routeType = walk.plan.routeType
    routeTypePreferences[routeType] = (routeTypePreferences[routeType] ?? 0) + 1
  }

  // Condition preferences
  const conditionPreferences: Record<string, number> = {}
  for (const walk of walks) {
    const condition = walk.condition
    conditionPreferences[condition] = (conditionPreferences[condition] ?? 0) + 1
  }

  const preferredCondition =
    Object.keys(conditionPreferences).length > 0
      ? Object.entries(conditionPreferences).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null
      : null

  return {
    _id: undefined as any,
    participantId,
    weekStart,
    totalWalks: walks.length,
    completedWalks,
    averageCalmScore: Math.round(averageCalmScore * 100) / 100,
    averageWalkDuration: Math.round(averageWalkDuration * 100) / 100,
    preferredCondition,
    conditionPreferences,
    routeTypePreferences,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as ParticipantMetricsDoc
}

/**
 * Generate WeeklyReport for a specific week
 */
export async function generateWeeklyReport(weekStart: Date): Promise<WeeklyReportDoc> {
  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)

  // Get all walks for this week
  const walks = await WalkRecord.find({
    date: { $gte: weekStart, $lt: weekEnd },
  })

  // Get all active participants (walkers)
  const allParticipants = await Account.find({ role: 'participant', active: true })
  const participantIds = new Set(allParticipants.map((a) => a._id))

  // Get participants who walked this week
  const activeParticipantIds = new Set(walks.map((w) => w.participantId))

  const completedWalks = walks.filter((w) => w.completed).length
  const completionRate =
    walks.length > 0 ? Math.round((completedWalks / walks.length) * 100 * 100) / 100 : 0

  // Calm scores
  const calmScores = walks
    .filter((w) => w.postSurvey)
    .map((w) => extractCalmScore(w.postSurvey as Record<string, unknown>))
    .filter((score) => score > 0)
  const averageCalmScore =
    calmScores.length > 0 ? Math.round((calmScores.reduce((a, b) => a + b, 0) / calmScores.length) * 100) / 100 : 0

  // Duration
  const totalDuration = walks.reduce((sum, w) => sum + w.actualMinutes, 0)
  const averageWalkDuration = walks.length > 0 ? Math.round((totalDuration / walks.length) * 100) / 100 : 0

  // Route type performance
  const routeTypePerformance: Record<string, any> = {}
  const routeTypeCounts: Record<string, number> = {}
  for (const walk of walks) {
    const routeType = walk.plan.routeType
    routeTypeCounts[routeType] = (routeTypeCounts[routeType] ?? 0) + 1

    if (!routeTypePerformance[routeType]) {
      routeTypePerformance[routeType] = {
        walksCount: 0,
        averageCalmScore: 0,
        calmScores: [],
      }
    }
    routeTypePerformance[routeType].walksCount += 1
    if (walk.postSurvey) {
      const calmScore = extractCalmScore(walk.postSurvey as Record<string, unknown>)
      if (calmScore > 0) {
        routeTypePerformance[routeType].calmScores.push(calmScore)
      }
    }
  }

  // Clean up route type performance
  for (const routeType of Object.keys(routeTypePerformance)) {
    const data = routeTypePerformance[routeType]
    data.averageCalmScore =
      data.calmScores.length > 0
        ? Math.round((data.calmScores.reduce((a: number, b: number) => a + b, 0) / data.calmScores.length) * 100) / 100
        : 0
    delete data.calmScores
  }

  const topRouteType =
    Object.keys(routeTypeCounts).length > 0
      ? Object.entries(routeTypeCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null
      : null

  // Condition performance
  const conditionPerformance: Record<string, any> = {}
  const conditionCounts: Record<string, number> = {}
  for (const walk of walks) {
    const condition = walk.condition
    conditionCounts[condition] = (conditionCounts[condition] ?? 0) + 1

    if (!conditionPerformance[condition]) {
      conditionPerformance[condition] = {
        walksCount: 0,
        averageCalmScore: 0,
        completionRate: 0,
        completed: 0,
        calmScores: [],
      }
    }
    conditionPerformance[condition].walksCount += 1
    if (walk.completed) {
      conditionPerformance[condition].completed += 1
    }
    if (walk.postSurvey) {
      const calmScore = extractCalmScore(walk.postSurvey as Record<string, unknown>)
      if (calmScore > 0) {
        conditionPerformance[condition].calmScores.push(calmScore)
      }
    }
  }

  // Clean up condition performance
  for (const condition of Object.keys(conditionPerformance)) {
    const data = conditionPerformance[condition]
    data.averageCalmScore =
      data.calmScores.length > 0
        ? Math.round((data.calmScores.reduce((a: number, b: number) => a + b, 0) / data.calmScores.length) * 100) / 100
        : 0
    data.completionRate = Math.round((data.completed / data.walksCount) * 100 * 100) / 100
    delete data.calmScores
    delete data.completed
  }

  const topCondition =
    Object.keys(conditionCounts).length > 0
      ? Object.entries(conditionCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null
      : null

  // Participant breakdown
  const participantWalkCounts: Record<string, number> = {}
  for (const walk of walks) {
    participantWalkCounts[walk.participantId] =
      (participantWalkCounts[walk.participantId] ?? 0) + 1
  }

  const participantBreakdown = {
    onceOrMore: Object.values(participantWalkCounts).filter((c) => c >= 1).length,
    threeOrMore: Object.values(participantWalkCounts).filter((c) => c >= 3).length,
    fiveOrMore: Object.values(participantWalkCounts).filter((c) => c >= 5).length,
  }

  return {
    _id: undefined as any,
    week: weekStart,
    totalParticipants: participantIds.size,
    activeParticipants: activeParticipantIds.size,
    totalWalks: walks.length,
    completedWalks,
    completionRate,
    averageCalmScore,
    averageWalkDuration,
    topRouteType,
    topCondition,
    participantBreakdown,
    conditionPerformance,
    routeTypePerformance,
    createdAt: new Date(),
  } as WeeklyReportDoc
}

/**
 * Generate all analytics for a given week
 * Creates WeeklyReport and ParticipantMetrics for all participants with walks
 */
export async function generateWeeklyAnalytics(weekStart?: Date): Promise<{
  report: WeeklyReportDoc
  participantCount: number
}> {
  const week = weekStart ? getMonday(weekStart) : getMonday(new Date())

  // Generate weekly report
  const report = await generateWeeklyReport(week)
  await WeeklyReport.findOneAndUpdate({ week }, report, {
    upsert: true,
    new: true,
  })

  // Get all participants who walked this week
  const weekEnd = new Date(week)
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)

  const walks = await WalkRecord.find({
    date: { $gte: week, $lt: weekEnd },
  }).distinct('participantId')

  // Generate metrics for each participant
  let generatedCount = 0
  for (const participantId of walks) {
    const metrics = await generateParticipantMetrics(participantId, week)
    if (metrics) {
      await ParticipantMetrics.findOneAndUpdate(
        { participantId, weekStart: week },
        metrics,
        { upsert: true, new: true },
      )
      generatedCount += 1
    }
  }

  return {
    report,
    participantCount: generatedCount,
  }
}
