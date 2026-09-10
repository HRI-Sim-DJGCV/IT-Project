import { Schema, model } from 'mongoose'
import type { Role } from '../../../shared/types'

/**
 * One document per login, all roles. Participants hold NO personal or clinical data by design.
 */
export interface AccountDoc {
  _id: string // login user ID;
  role: Role
  passwordHash: string | null // null until an access code has been redeemed
  displayName: string
  condition?: string 
  accessCodeHash?: string | null 
  accessCodeUsedAt?: Date | null
  joinedAt: Date
  createdBy?: string
  active: boolean
}

const AccountSchema = new Schema<AccountDoc>(
  {
    _id: { type: String, required: true },
    role: {
      type: String,
      required: true,
      enum: ['participant', 'medical_professional', 'researcher'],
      index: true,
    },
    passwordHash: { type: String, default: null },
    displayName: { type: String, required: true },
    condition: { type: String },
    accessCodeHash: { type: String, default: null },
    accessCodeUsedAt: { type: Date, default: null },
    joinedAt: { type: Date, required: true },
    createdBy: { type: String },
    active: { type: Boolean, required: true, default: true },
  },
  { collection: 'accounts', versionKey: false },
)

AccountSchema.index({ accessCodeHash: 1 }, { unique: true, partialFilterExpression: { accessCodeHash: { $type: 'string' } } })

export const Account = model<AccountDoc>('Account', AccountSchema)
