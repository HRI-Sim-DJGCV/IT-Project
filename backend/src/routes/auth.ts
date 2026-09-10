import bcrypt from 'bcryptjs'
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import type { LoginResponse } from '../../../shared/types'
import { signToken } from '../auth/jwt'
import { invalidCredentials, parse } from '../errors'
import { Account, type AccountDoc } from '../models/Account'
import { hashAccessCode } from '../services/accessCode'
import { toParticipant } from '../services/serializers'
import { accessCodeSchema, loginSchema } from '../validation'

export const authRouter = Router()

// Slow down credential guessing. One bucket per route so a burst of logins
// does not lock out access-code redemption (and vice versa).
const authLimiter = () => rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false })
const loginLimiter = authLimiter()
const accessCodeLimiter = authLimiter()

/** Case-insensitive lookup by login id without a collection scan. */
async function findAccount(userId: string): Promise<AccountDoc | null> {
  const candidates = [...new Set([userId, userId.toUpperCase(), userId.toLowerCase()])]
  return Account.findOne({ _id: { $in: candidates } }).lean()
}

function loginResponse(account: AccountDoc): LoginResponse {
  const { token, expiresAt } = signToken({ id: account._id, role: account.role, condition: account.condition })
  return {
    token,
    expiresAt,
    role: account.role,
    participant: account.role === 'participant' ? toParticipant(account) : null,
  }
}

/** POST /auth/login (public) */
authRouter.post('/login', loginLimiter, async (req, res) => {
  const body = parse(loginSchema, req.body)
  const account = await findAccount(body.userId)
  // Same error whichever part is wrong: unknown user, wrong role, inactive, no password yet, bad password.
  if (!account || account.role !== body.role || !account.active || !account.passwordHash) throw invalidCredentials()
  const ok = await bcrypt.compare(body.password, account.passwordHash)
  if (!ok) throw invalidCredentials()
  res.json(loginResponse(account))
})

/** POST /auth/access-code (public): first login. Redeem a single-use code and set a password. */
authRouter.post('/access-code', accessCodeLimiter, async (req, res) => {
  const body = parse(accessCodeSchema, req.body)
  const account = await findAccount(body.userId)
  const codeHash = hashAccessCode(body.accessCode)
  if (!account || account.role !== 'participant' || !account.active || account.accessCodeHash !== codeHash) {
    throw invalidCredentials()
  }
  const passwordHash = await bcrypt.hash(body.password, 10)
  const updated = await Account.findOneAndUpdate(
    { _id: account._id, accessCodeHash: codeHash }, // guards against a concurrent redemption
    { $set: { passwordHash, accessCodeUsedAt: new Date(), accessCodeHash: null } },
    { new: true },
  ).lean()
  if (!updated) throw invalidCredentials()
  res.json(loginResponse(updated))
})
