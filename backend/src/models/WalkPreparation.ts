import { Schema, Types, model } from 'mongoose'
import type { GeneratedScript, PreparationStatus, RouteOption, WalkPlan } from '../../../shared/types'
import { PlanSchema, RouteSchema, ScriptSchema } from './WalkRecord'

/**
 * A walk being prepared. Created when the participant confirms a route; the
 * server then generates the script and its audio in the background while the
 * app polls. Audio files live under AUDIO_DIR/<_id>/<index>.mp3.
 */
export interface WalkPreparationDoc {
  _id: Types.ObjectId
  participantId: string
  condition: string
  plan: WalkPlan
  route: RouteOption
  context: string
  status: PreparationStatus
  progress: { done: number; total: number }
  error: string | null
  script: GeneratedScript | null
  createdAt: Date
  updatedAt: Date
}

const WalkPreparationSchema = new Schema<WalkPreparationDoc>(
  {
    participantId: { type: String, required: true },
    condition: { type: String, required: true },
    plan: { type: PlanSchema, required: true },
    route: { type: RouteSchema, required: true },
    context: { type: String, required: true },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'generating_script', 'generating_audio', 'ready', 'failed'],
      default: 'pending',
    },
    progress: {
      type: new Schema({ done: { type: Number, required: true }, total: { type: Number, required: true } }, { _id: false }),
      required: true,
      default: () => ({ done: 0, total: 0 }),
    },
    error: { type: String, default: null },
    script: { type: ScriptSchema, default: null },
    createdAt: { type: Date, required: true, default: () => new Date() },
    updatedAt: { type: Date, required: true, default: () => new Date() },
  },
  { collection: 'walkPreparations', versionKey: false, minimize: false },
)

WalkPreparationSchema.index({ participantId: 1, createdAt: -1 })
WalkPreparationSchema.index({ status: 1, updatedAt: 1 })

export const WalkPreparation = model<WalkPreparationDoc>('WalkPreparation', WalkPreparationSchema)
