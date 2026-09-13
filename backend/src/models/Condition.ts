import { Schema, model } from 'mongoose'

/**
 * An experimental arm. A condition selects the text-to-speech voice that reads
 * the participant's AI-generated script. There is deliberately no script
 * field: scripts are generated per walk and stored on the walk record.
 */
export interface ConditionDoc {
  _id: string
  name: string
  description?: string
  voice: string // TTS persona, e.g. "Male", "Female", or a speaker name
  age: number // apparent age of the persona; shapes the delivery instruction
  updatedAt: Date
  updatedBy?: string
}

const ConditionSchema = new Schema<ConditionDoc>(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String },
    voice: { type: String, required: true },
    age: { type: Number, required: true, min: 1 },
    updatedAt: { type: Date, required: true, default: () => new Date() },
    updatedBy: { type: String },
  },
  { collection: 'conditions', versionKey: false },
)

export const Condition = model<ConditionDoc>('Condition', ConditionSchema)
