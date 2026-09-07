import { Schema, Types, model } from 'mongoose'
import type { RouteOption, SurveyResponse, WalkPlan } from '../../../shared/types'

/**
 * One document per completed walk. Plan, route and both surveys are embedded:
 * a walk is written once and read as a unit. Named `walkRecords`
 */
export interface WalkRecordDoc {
  _id: Types.ObjectId
  clientId: string // idempotency key from the frontend draft
  participantId: string
  condition: string // copied from the account at save time
  date: Date
  plan: WalkPlan
  route: RouteOption
  preSurvey: SurveyResponse
  postSurvey: SurveyResponse | null
  actualMinutes: number
  scriptVersion: number
  surveyVersion: number
  completed: boolean
  createdAt: Date
}

const PlanSchema = new Schema<WalkPlan>(
  {
    startLocation: { type: String, required: true },
    endLocation: { type: String, required: true },
    duration: { type: Number, required: true },
    routeType: { type: String, required: true },
  },
  { _id: false },
)

const RouteSchema = new Schema<RouteOption>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    distanceKm: { type: Number, required: true },
    estimatedMinutes: { type: Number, required: true },
    path: { type: [[Number]], required: true },
  },
  { _id: false },
)

const WalkRecordSchema = new Schema<WalkRecordDoc>(
  {
    clientId: { type: String, required: true },
    participantId: { type: String, required: true },
    condition: { type: String, required: true },
    date: { type: Date, required: true },
    plan: { type: PlanSchema, required: true },
    route: { type: RouteSchema, required: true },
    preSurvey: { type: Schema.Types.Mixed, required: true },
    postSurvey: { type: Schema.Types.Mixed, default: null },
    actualMinutes: { type: Number, required: true, min: 1 },
    scriptVersion: { type: Number, required: true },
    surveyVersion: { type: Number, required: true },
    completed: { type: Boolean, required: true, default: true },
    createdAt: { type: Date, required: true, default: () => new Date() },
  },
  { collection: 'walkRecords', versionKey: false, minimize: false },
)

WalkRecordSchema.index({ participantId: 1, date: -1 })
WalkRecordSchema.index({ participantId: 1, clientId: 1 }, { unique: true })
WalkRecordSchema.index({ condition: 1, date: -1 })

export const WalkRecord = model<WalkRecordDoc>('WalkRecord', WalkRecordSchema)
