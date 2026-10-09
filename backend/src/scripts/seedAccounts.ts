/**
 * The shared test logins, one per access level. Passwords never live in the
 * repo: each comes from .env (SEED_PASSWORD_*). When one is missing, a random
 * password is generated for a NEW account and printed once; an existing
 * account keeps its password.
 */
import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import type { Role } from '../../../shared/types'
import { Account } from '../models/Account'

interface SeedAccount {
  _id: string
  role: Role
  passwordEnv: string
  displayName: string
  condition?: string
  joinedAt: Date
}

export const SEED_PARTICIPANT_ID = 'participant01'

/** Logins from before the switch to SEED_PASSWORD_*; deactivated (not deleted) so their data stays. */
const RETIRED_IDS = ['demo', 'AAA001', 'admin', 'doctor']

export async function upsertSeedAccounts(log: (line: string) => void): Promise<void> {
  const now = new Date()
  const accounts: SeedAccount[] = [
    {
      _id: SEED_PARTICIPANT_ID,
      role: 'participant',
      passwordEnv: 'SEED_PASSWORD_PARTICIPANT',
      displayName: 'Participant 01',
      condition: 'A',
      joinedAt: new Date('2026-08-12T09:00:00Z'),
    },
    { _id: 'researcher01', role: 'researcher', passwordEnv: 'SEED_PASSWORD_RESEARCHER', displayName: 'Researcher 01', joinedAt: now },
    { _id: 'doctor01', role: 'medical_professional', passwordEnv: 'SEED_PASSWORD_DOCTOR', displayName: 'Doctor 01', joinedAt: now },
  ]

  for (const { passwordEnv, ...account } of accounts) {
    const fromEnv = process.env[passwordEnv]
    if (fromEnv) {
      // Always applied, so changing .env and re-running rotates the password.
      await Account.updateOne(
        { _id: account._id },
        { $set: { ...account, passwordHash: await bcrypt.hash(fromEnv, 10), active: true, createdBy: 'seed' } },
        { upsert: true },
      )
      log(`account ${account._id} (${account.role}): password from ${passwordEnv}`)
      continue
    }
    const generated = randomBytes(12).toString('base64url')
    const result = await Account.updateOne(
      { _id: account._id },
      {
        $set: { ...account, active: true, createdBy: 'seed' },
        $setOnInsert: { passwordHash: await bcrypt.hash(generated, 10) },
      },
      { upsert: true },
    )
    if (result.upsertedCount) log(`account ${account._id} (${account.role}): ${passwordEnv} not set, generated password ${generated}`)
    else log(`account ${account._id} (${account.role}): ${passwordEnv} not set, existing password kept`)
  }

  const retired = await Account.updateMany({ _id: { $in: RETIRED_IDS }, active: true }, { $set: { active: false } })
  if (retired.modifiedCount) log(`deactivated ${retired.modifiedCount} old login(s): ${RETIRED_IDS.join(', ')}`)
}
