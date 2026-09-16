import { describe, expect, it } from 'vitest'
import {
  accessCodeSchema,
  conditionSettingSchema,
  loginSchema,
  patchParticipantSchema,
  planSchema,
  saveWalkSchema,
  surveySchema,
} from '../src/validation'

const survey = { calm: 3, tense: 2, at_ease: 4, worried: 1 }

const plan = {
  startLocation: 'Melbourne Central',
  endLocation: 'Carlton Gardens',
  duration: 30,
  routeType: 'green_space',
}

const route = {
  id: 'r1',
  name: 'Direct',
  description: '',
  distanceKm: 2.1,
  estimatedMinutes: 28,
  path: [[0, 0], [100, 100]],
  mapPath: [[-37.81, 144.96], [-37.8, 144.97]],
  origin: { lat: -37.81, lon: 144.96 },
  destination: { lat: -37.8, lon: 144.97 },
  park: null,
}

describe('surveySchema', () => {
  it('accepts exactly the four items scored 1-4', () => {
    expect(surveySchema.safeParse(survey).success).toBe(true)
  })

  it('rejects a missing item', () => {
    const { tense: _omit, ...partial } = survey
    expect(surveySchema.safeParse(partial).success).toBe(false)
  })

  it('rejects unknown items and out-of-range scores', () => {
    expect(surveySchema.safeParse({ ...survey, happy: 2 }).success).toBe(false)
    expect(surveySchema.safeParse({ ...survey, calm: 5 }).success).toBe(false)
    expect(surveySchema.safeParse({ ...survey, calm: 0 }).success).toBe(false)
  })
})

describe('planSchema', () => {
  it('coerces the duration from a string and trims locations', () => {
    const parsed = planSchema.parse({ ...plan, duration: '15', startLocation: '  Home  ' })
    expect(parsed.duration).toBe(15)
    expect(parsed.startLocation).toBe('Home')
  })

  it('rejects durations outside 15/30/45 and unknown route types', () => {
    expect(planSchema.safeParse({ ...plan, duration: 20 }).success).toBe(false)
    expect(planSchema.safeParse({ ...plan, routeType: 'scenic' }).success).toBe(false)
  })

  it('rejects coordinates outside the valid range', () => {
    expect(planSchema.safeParse({ ...plan, startCoordinates: { lat: 91, lon: 0 } }).success).toBe(false)
  })
})

describe('saveWalkSchema', () => {
  const walk = {
    clientId: 'abc',
    date: '2026-09-16T10:00:00+10:00',
    plan,
    route,
    preSurvey: survey,
    postSurvey: survey,
    actualMinutes: 31,
    preparationId: '0123456789abcdef01234567',
  }

  it('accepts a complete walk', () => {
    expect(saveWalkSchema.safeParse(walk).success).toBe(true)
  })

  it('requires an ISO date with offset and a Mongo-style preparation id', () => {
    expect(saveWalkSchema.safeParse({ ...walk, date: '2026-09-16' }).success).toBe(false)
    expect(saveWalkSchema.safeParse({ ...walk, preparationId: 'not-an-id' }).success).toBe(false)
  })
})

describe('auth schemas', () => {
  it('loginSchema only allows the three roles', () => {
    expect(loginSchema.safeParse({ role: 'participant', userId: 'demo', password: 'demo' }).success).toBe(true)
    expect(loginSchema.safeParse({ role: 'admin', userId: 'demo', password: 'demo' }).success).toBe(false)
  })

  it('accessCodeSchema enforces the 8-character password minimum', () => {
    const base = { userId: 'AAA001', accessCode: 'K7P2-QX9M' }
    expect(accessCodeSchema.safeParse({ ...base, password: 'short' }).success).toBe(false)
    expect(accessCodeSchema.safeParse({ ...base, password: 'longenough' }).success).toBe(true)
  })
})

describe('admin schemas', () => {
  it('conditionSettingSchema restricts ids to letters, digits, _ and -', () => {
    const ok = { id: 'A', name: 'Young voice', voice: 'Ryan', age: 25 }
    expect(conditionSettingSchema.safeParse(ok).success).toBe(true)
    expect(conditionSettingSchema.safeParse({ ...ok, id: 'A B' }).success).toBe(false)
  })

  it('patchParticipantSchema rejects an empty patch', () => {
    expect(patchParticipantSchema.safeParse({}).success).toBe(false)
    expect(patchParticipantSchema.safeParse({ active: false }).success).toBe(true)
  })
})
