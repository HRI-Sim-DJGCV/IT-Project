import { Schema, Types, model } from 'mongoose'

/**
 * Weekly metrics snapshot for a single participant.
 * Generated from walk records for trend analysis and analytics dashboard.
 */
export interface ParticipantMetricsDoc {
  _id: Types.ObjectId
  participantId: string
  weekStart: Date // Monday of the week
  totalWalks: number
  completedWalks: number
  averageCalmScore: number
  averageWalkDuration: number // in minutes
  preferredCondition: string | null
  conditionPreferences: Record<string, number> // { conditionId: count }
  routeTypePreferences: Record<string, number> // { routeType: count }
  createdAt: Date
  updatedAt: Date
}

const ParticipantMetricsSchema = new Schema<ParticipantMetricsDoc>(
  {
    participantId: { type: String, required: true },
    weekStart: { type: Date, required: true },
    totalWalks: { type: Number, required: true, default: 0 },
    completedWalks: { type: Number, required: true, default: 0 },
    averageCalmScore: { type: Number, required: true, default: 0 },
    averageWalkDuration: { type: Number, required: true, default: 0 },
    preferredCondition: { type: String, default: null },
    conditionPreferences: { type: Schema.Types.Mixed, default: {} },
    routeTypePreferences: { type: Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, required: true, default: () => new Date() },
    updatedAt: { type: Date, required: true, default: () => new Date() },
  },
  { collection: 'participantMetrics', versionKey: false },
)

// Index for efficient querying by participant and week
ParticipantMetricsSchema.index({ participantId: 1, weekStart: -1 })
// Index for dashboard queries across all participants for a week
ParticipantMetricsSchema.index({ weekStart: -1 })

export const ParticipantMetrics = model<ParticipantMetricsDoc>(
  'ParticipantMetrics',
  ParticipantMetricsSchema,
)
