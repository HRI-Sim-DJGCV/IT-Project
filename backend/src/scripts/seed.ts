/**
 * Development seed. Idempotent (upserts), touches ONLY the `accounts`,
 * `conditions` and `walkRecords` collections, and refuses to run in
 * production. Mirrors the frontend's mock data so the demo logins keep working.
 *
 *   npm run seed
 */
import bcrypt from 'bcryptjs'
import { SURVEY_VERSION } from '../../../shared/survey'
import type { Role } from '../../../shared/types'
import { config } from '../config'
import { connectDb, disconnectDb, syncIndexes } from '../db'
import { Account } from '../models/Account'
import { Condition } from '../models/Condition'
import { WalkRecord } from '../models/WalkRecord'
import { buildRouteOptions } from '../services/routeTemplates'
import { DEFAULT_SCRIPT } from '../services/scriptTemplate'

interface SeedAccount {
  _id: string
  role: Role
  password: string
  displayName: string
  condition?: string
  joinedAt: Date
}

async function main() {
  if (config.isProduction) throw new Error('Refusing to seed a production database.')
  await connectDb()
  console.log(`[seed] database "${config.MONGODB_DB_NAME}"`)

  await syncIndexes()
  console.log('[seed] indexes synced')

  const now = new Date()
  for (const c of [
    { _id: 'A', name: 'Condition A', voice: 'Male', age: 30 },
    { _id: 'B', name: 'Condition B', voice: 'Female', age: 30 },
  ]) {
    await Condition.updateOne(
      { _id: c._id },
      {
        $set: { name: c.name, voice: c.voice, age: c.age, updatedAt: now, updatedBy: 'seed' },
        $setOnInsert: { scriptVersion: 1, script: DEFAULT_SCRIPT, scriptHistory: [] },
      },
      { upsert: true },
    )
  }
  console.log('[seed] conditions A, B')

  const joined = new Date('2026-08-12T09:00:00Z')
  const accounts: SeedAccount[] = [
    { _id: 'demo', role: 'participant', password: 'demo', displayName: 'Participant demo', condition: 'A', joinedAt: joined },
    { _id: 'AAA001', role: 'participant', password: 'password', displayName: 'Participant AAA001', condition: 'A', joinedAt: joined },
    { _id: 'admin', role: 'researcher', password: 'admin', displayName: 'Research admin', joinedAt: now },
    { _id: 'doctor', role: 'medical_professional', password: 'doctor', displayName: 'Medical professional', joinedAt: now },
  ]
  for (const a of accounts) {
    const { password, ...rest } = a
    await Account.updateOne(
      { _id: a._id },
      { $set: { ...rest, passwordHash: await bcrypt.hash(password, 10), active: true, createdBy: 'seed' } },
      { upsert: true },
    )
  }
  console.log('[seed] accounts demo/demo, AAA001/password, admin/admin, doctor/doctor')

  const walks = [
    {
      clientId: 'seed-w1',
      date: new Date('2026-08-30T08:15:00Z'),
      plan: { startLocation: 'Home', endLocation: 'Home', duration: 15, routeType: 'loop' },
      route: buildRouteOptions(15)[0],
      preSurvey: { calm: 2, tense: 3, at_ease: 2, worried: 3 },
      postSurvey: { calm: 3, tense: 2, at_ease: 3, worried: 2 },
      actualMinutes: 16,
    },
    {
      clientId: 'seed-w2',
      date: new Date('2026-09-02T17:40:00Z'),
      plan: { startLocation: 'Home', endLocation: 'Home', duration: 30, routeType: 'green_space' },
      route: buildRouteOptions(30)[1],
      preSurvey: { calm: 1, tense: 4, at_ease: 2, worried: 4 },
      postSurvey: { calm: 3, tense: 2, at_ease: 3, worried: 2 },
      actualMinutes: 31,
    },
  ]
  for (const participantId of ['demo', 'AAA001']) {
    for (const w of walks) {
      await WalkRecord.updateOne(
        { participantId, clientId: w.clientId },
        {
          $setOnInsert: {
            ...w,
            participantId,
            condition: 'A',
            scriptVersion: 1,
            surveyVersion: SURVEY_VERSION,
            completed: true,
            createdAt: now,
          },
        },
        { upsert: true },
      )
    }
  }
  console.log('[seed] two walks each for demo and AAA001')
  await disconnectDb()
  console.log('[seed] done')
}

main().catch((err) => {
  console.error('[seed] failed', err)
  process.exit(1)
})
