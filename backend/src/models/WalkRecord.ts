import { Schema, Types, model } from 'mongoose'
import type { GeneratedScript, RouteOption, SurveyResponse, WalkPlan } from '../../../shared/types'

/**
 * One document per completed walk. Plan, route, both surveys and the
 * generated script are embedded: a walk is written once and read as a unit.
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
  /** The preparation whose audio files were played; audio lives under AUDIO_DIR/<preparationId>/ */
  preparationId: Types.ObjectId | null
  script: GeneratedScript
  surveyVersion: number
  completed: boolean
  createdAt: Date
}

const LatLonSchema = new Schema({ lat: { type: Number, required: true }, lon: { type: Number, required: true } }, { _id: false })

export const PlanSchema = new Schema<WalkPlan>(
  {
    startLocation: { type: String, required: true },
    startCoordinates: { type: LatLonSchema, required: false },
    endLocation: { type: String, required: true },
    duration: { type: Number, required: true },
    routeType: { type: String, required: true },
  },
  { _id: false },
)

export const RouteSchema = new Schema<RouteOption>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    distanceKm: { type: Number, required: true },
    estimatedMinutes: { type: Number, required: true },
    path: { type: [[Number]], required: true },
    mapPath: { type: [[Number]], required: true },
    origin: { type: LatLonSchema, required: true },
    destination: { type: LatLonSchema, required: true },
    park: {
      type: new Schema(
        { name: { type: String, required: true }, lat: { type: Number, required: true }, lon: { type: Number, required: true } },
        { _id: false },
      ),
      default: null,
    },
  },
  { _id: false },
)

export const SegmentSchema = new Schema(
  {
    atSecond: { type: Number, required: true },
    section: { type: String, required: true, enum: ['focused_attention', 'compassion', 'closing'] },
    title: { type: String, required: true },
    text: { type: String, required: true },
    audioIndex: { type: Number, default: null },
  },
  { _id: false },
)

export const ScriptSchema = new Schema<GeneratedScript>(
  {
    generator: { type: String, required: true, enum: ['ai'] },
    model: { type: String, required: true },
    promptVersion: { type: Number, required: true },
    context: { type: String, required: true },
    voice: {
      type: new Schema({ speaker: { type: String, required: true }, instruct: { type: String, required: true } }, { _id: false }),
      required: true,
    },
    segments: { type: [SegmentSchema], required: true },
    rawText: { type: String, required: true },
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
    preparationId: { type: Schema.Types.ObjectId, default: null },
    script: { type: ScriptSchema, required: true },
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
