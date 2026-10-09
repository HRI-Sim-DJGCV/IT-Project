import { Schema, Types, model } from 'mongoose'

/**
 * Aggregated weekly report snapshot.
 * Generated every Monday at 00:00 UTC with metrics from the previous week.
 * Used for analytics dashboard and trend analysis.
 */
export interface WeeklyReportDoc {
  _id: Types.ObjectId
  week: Date // Monday of the week
  totalParticipants: number
  activeParticipants: number // participants who completed at least one walk
  totalWalks: number
  completedWalks: number
  completionRate: number // percentage (0-100)
  averageCalmScore: number
  averageWalkDuration: number // in minutes
  topRouteType: string | null
  topCondition: string | null
  participantBreakdown: {
    onceOrMore: number // participants with 1+ walks
    threeOrMore: number // participants with 3+ walks
    fiveOrMore: number // participants with 5+ walks
  }
  conditionPerformance: Record<
    string,
    {
      walksCount: number
      averageCalmScore: number
      completionRate: number
    }
  >
  routeTypePerformance: Record<
    string,
    {
      walksCount: number
      averageCalmScore: number
    }
  >
  createdAt: Date
}

const ConditionPerformanceSchema = new Schema(
  {
    walksCount: { type: Number, required: true, default: 0 },
    averageCalmScore: { type: Number, required: true, default: 0 },
    completionRate: { type: Number, required: true, default: 0 },
  },
  { _id: false },
)

const RouteTypePerformanceSchema = new Schema(
  {
    walksCount: { type: Number, required: true, default: 0 },
    averageCalmScore: { type: Number, required: true, default: 0 },
  },
  { _id: false },
)

const ParticipantBreakdownSchema = new Schema(
  {
    onceOrMore: { type: Number, required: true, default: 0 },
    threeOrMore: { type: Number, required: true, default: 0 },
    fiveOrMore: { type: Number, required: true, default: 0 },
  },
  { _id: false },
)

const WeeklyReportSchema = new Schema<WeeklyReportDoc>(
  {
    week: { type: Date, required: true, unique: true },
    totalParticipants: { type: Number, required: true, default: 0 },
    activeParticipants: { type: Number, required: true, default: 0 },
    totalWalks: { type: Number, required: true, default: 0 },
    completedWalks: { type: Number, required: true, default: 0 },
    completionRate: { type: Number, required: true, default: 0 },
    averageCalmScore: { type: Number, required: true, default: 0 },
    averageWalkDuration: { type: Number, required: true, default: 0 },
    topRouteType: { type: String, default: null },
    topCondition: { type: String, default: null },
    participantBreakdown: { type: ParticipantBreakdownSchema, required: true },
    conditionPerformance: { type: Schema.Types.Mixed, default: {} },
    routeTypePerformance: { type: Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, required: true, default: () => new Date() },
  },
  { collection: 'weeklyReports', versionKey: false },
)

// Index for efficient querying by week
WeeklyReportSchema.index({ week: -1 })

export const WeeklyReport = model<WeeklyReportDoc>('WeeklyReport', WeeklyReportSchema)
