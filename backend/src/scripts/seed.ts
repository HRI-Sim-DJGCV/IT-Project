/**
 * Development seed. Idempotent (upserts), touches ONLY the `accounts`,
 * `conditions` and `walkRecords` collections, and refuses to run in
 * production.
 *
 *   npm run seed
 */
import bcrypt from 'bcryptjs'
import { SURVEY_VERSION } from '../../../shared/survey'
import type { GeneratedScript, Role, RouteOption } from '../../../shared/types'
import { config } from '../config'
import { connectDb, disconnectDb, syncIndexes } from '../db'
import { Account } from '../models/Account'
import { Condition } from '../models/Condition'
import { WalkRecord } from '../models/WalkRecord'
import { buildSegments } from '../services/scriptSegments'

interface SeedAccount {
  _id: string
  role: Role
  password: string
  displayName: string
  condition?: string
  joinedAt: Date
}

/** A short loop near the University of Melbourne, so the seeded history draws on the map. */
const SAMPLE_ROUTE: RouteOption = {
  id: 'seed-direct',
  name: 'Direct walk',
  description: 'University of Melbourne → University of Melbourne',
  distanceKm: 1.2,
  estimatedMinutes: 15,
  path: [
    [8, 92],
    [30, 60],
    [55, 70],
    [75, 35],
    [92, 8],
  ],
  mapPath: [
    [-37.7963, 144.9614],
    [-37.7975, 144.9632],
    [-37.7988, 144.9621],
    [-37.7981, 144.9598],
    [-37.7963, 144.9614],
  ],
  origin: { lat: -37.7963, lon: 144.9614 },
  destination: { lat: -37.7963, lon: 144.9614 },
  park: null,
}

const SAMPLE_RAW = `[FOCUSED_ATTENTION]
Begin walking at an easy pace. Feel your feet meet the ground, heel to toe. (pause) Notice the air on your face and the rhythm of your steps.

[COMPASSION MEDITATION]
As you walk, bring to mind someone who is kind to you. Silently wish them well. (pause) Now offer that same kindness to yourself.

[CLOSING MEDITATION]
You are nearing the end of this walk. Take one slow breath in, and let it go. Carry this steadiness with you.`

function sampleScript(durationMinutes: number): GeneratedScript {
  return {
    generator: 'ai',
    model: 'seed-sample',
    promptVersion: 0,
    context: 'Seed data: sample walk for the demo history.',
    voice: { speaker: 'Ryan', instruct: 'seed' },
    segments: buildSegments(SAMPLE_RAW, durationMinutes).map((s) => ({ ...s, audioIndex: null })),
    rawText: SAMPLE_RAW,
  }
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
      { $set: { name: c.name, voice: c.voice, age: c.age, updatedAt: now, updatedBy: 'seed' } },
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
      plan: { startLocation: 'University of Melbourne', endLocation: 'University of Melbourne', duration: 15, routeType: 'loop' },
      route: SAMPLE_ROUTE,
      preSurvey: { calm: 2, tense: 3, at_ease: 2, worried: 3 },
      postSurvey: { calm: 3, tense: 2, at_ease: 3, worried: 2 },
      actualMinutes: 16,
      script: sampleScript(15),
    },
    {
      clientId: 'seed-w2',
      date: new Date('2026-09-02T17:40:00Z'),
      plan: { startLocation: 'University of Melbourne', endLocation: 'University of Melbourne', duration: 30, routeType: 'green_space' },
      route: { ...SAMPLE_ROUTE, estimatedMinutes: 30, distanceKm: 2.4 },
      preSurvey: { calm: 1, tense: 4, at_ease: 2, worried: 4 },
      postSurvey: { calm: 3, tense: 2, at_ease: 3, worried: 2 },
      actualMinutes: 31,
      script: sampleScript(30),
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
            preparationId: null,
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
