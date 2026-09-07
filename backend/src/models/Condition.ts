import { Schema, model } from 'mongoose'

export interface ScriptTemplateSegment {
  atFraction: number // 0..1 of total walk duration
  title: string
  text: string
}

/** Each holds its own script and TTS persona. */
export interface ConditionDoc {
  _id: string 
  name: string
  description?: string
  voice: string // TTS persona, e.g. "Male"
  age: number // apparent age of the persona
  scriptVersion: number
  script: ScriptTemplateSegment[]
  scriptHistory: Array<{ scriptVersion: number; script: ScriptTemplateSegment[]; retiredAt: Date }>
  updatedAt: Date
  updatedBy?: string
}

const SegmentSchema = new Schema<ScriptTemplateSegment>(
  {
    atFraction: { type: Number, required: true, min: 0, max: 1 },
    title: { type: String, required: true },
    text: { type: String, required: true },
  },
  { _id: false },
)

const HistorySchema = new Schema(
  {
    scriptVersion: { type: Number, required: true },
    script: { type: [SegmentSchema], required: true },
    retiredAt: { type: Date, required: true },
  },
  { _id: false },
)

const ConditionSchema = new Schema<ConditionDoc>(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String },
    voice: { type: String, required: true },
    age: { type: Number, required: true, min: 1 },
    scriptVersion: { type: Number, required: true, default: 1 },
    script: { type: [SegmentSchema], required: true },
    scriptHistory: { type: [HistorySchema], default: [] },
    updatedAt: { type: Date, required: true, default: () => new Date() },
    updatedBy: { type: String },
  },
  { collection: 'conditions', versionKey: false },
)

export const Condition = model<ConditionDoc>('Condition', ConditionSchema)
