import request from 'supertest'
import { Types } from 'mongoose'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getUtcWeekRange } from '../../shared/week'
import { createApp } from '../src/app'
import { signToken } from '../src/auth/jwt'
import { Account } from '../src/models/Account'
import { WalkRecord, type WalkRecordDoc } from '../src/models/WalkRecord'
import { buildDetailedWalkCsv } from '../src/services/walkCsv'

const app = createApp()
const makeWalk = (overrides: Record<string, unknown> = {}) => ({
  _id: new Types.ObjectId('6a9d30fd79b82bfb86a2beea'),
  participantId: 'demo', clientId: 'walk-1', condition: 'A',
  date: new Date('2026-10-08T09:00:00Z'), createdAt: new Date('2026-10-08T09:16:00Z'),
  actualMinutes: 16, completed: true, surveyVersion: 1, preparationId: null,
  plan: { startLocation: 'Home', endLocation: 'Home', duration: 15, routeType: 'loop' },
  route: { id: 'r1', name: 'Park, "North"', description: 'Quiet route', distanceKm: 1.2,
    estimatedMinutes: 15, path: [[10, 80], [90, 15]], mapPath: [[-33.8, 151.2]],
    origin: { lat: -33.8, lon: 151.2 }, destination: { lat: -33.8, lon: 151.2 }, park: null },
  preSurvey: { calm: 2, at_ease: 2, tense: 3, worried: 3 },
  postSurvey: { calm: 3, at_ease: 3, tense: 2, worried: 2 },
  script: { generator: 'ai', model: 'test-model', promptVersion: 1, context: 'A calming walk',
    voice: { speaker: 'Ryan', instruct: 'Read slowly' },
    rawText: 'Pause, breathe "slowly".\nNotice the trees 🌳.',
    segments: [{ atSecond: 0, section: 'focused_attention', title: 'Start', text: 'Breathe.', audioIndex: 0 }] },
  ...overrides,
} as unknown as WalkRecordDoc)

// Parse quoted CSV fields independently, including commas, quotes and line breaks in cells.
function parseCsv(csv: string): Array<Record<string, string>> {
  const rows: string[][] = []
  let row: string[] = []
  for (const match of csv.replace(/^\uFEFF/, '').matchAll(/"((?:[^"]|"")*)"(,|\r\n)/g)) {
    row.push(match[1]!.replace(/""/g, '"'))
    if (match[2] === '\r\n') { rows.push(row); row = [] }
  }
  const headers = rows.shift()!
  return rows.map((values) => Object.fromEntries(headers.map((key, i) => [key, values[i]!])))
}

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

describe('UTC calendar week', () => {
  it.each([
    ['2026-10-05T00:00:00Z', '2026-10-05T00:00:00.000Z', '2026-10-12T00:00:00.000Z'],
    ['2026-10-11T23:59:59.999Z', '2026-10-05T00:00:00.000Z', '2026-10-12T00:00:00.000Z'],
    ['2026-10-12T10:30:00+11:00', '2026-10-05T00:00:00.000Z', '2026-10-12T00:00:00.000Z'],
    ['2027-01-01T12:00:00Z', '2026-12-28T00:00:00.000Z', '2027-01-04T00:00:00.000Z'],
  ])('uses Monday UTC boundaries for %s', (instant, start, end) => {
    const now = new Date(instant)
    const range = getUtcWeekRange(now)
    expect(range.start.toISOString()).toBe(start)
    expect(range.end.toISOString()).toBe(end)
    expect(now.toISOString()).toBe(new Date(instant).toISOString())
  })
})

describe('detailed walk CSV', () => {
  it('preserves all nested data, raw text, IDs, dates and derived scores', () => {
    const walk = makeWalk()
    const csv = buildDetailedWalkCsv([walk])
    const row = parseCsv(csv)[0]!
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(row.participantId).toBe('demo')
    expect(row._id).toBe(walk._id.toString())
    expect(row.date).toBe('2026-10-08T09:00:00.000Z')
    expect(row['route.name']).toBe(walk.route.name)
    expect(row['route.origin.lat']).toBe('-33.8')
    expect(JSON.parse(row['route.mapPath']!)).toEqual(walk.route.mapPath)
    expect(row['script.rawText']).toBe(walk.script.rawText)
    expect(JSON.parse(row['script.segments']!)).toEqual(walk.script.segments)
    expect(row['scores.pre.calm']).toBe('8')
    expect(row['scores.post.calm']).toBe('12')
    expect(row['scores.delta.calm']).toBe('4')
    expect(JSON.parse(row.walk_record_json!)).toEqual(JSON.parse(JSON.stringify(walk)))
  })

  it('retains legacy fields and walks with missing audio, script or post-survey', () => {
    const walk = makeWalk({ script: undefined, postSurvey: null, scriptVersion: 1, completed: false })
    const rows = parseCsv(buildDetailedWalkCsv([walk, makeWalk({ clientId: 'walk-2' })]))
    expect(rows).toHaveLength(2)
    expect(rows[0]!.scriptVersion).toBe('1')
    expect(rows[0]!['script.rawText']).toBe('')
    expect(rows[0]!['scores.post.calm']).toBe('')
    expect(rows[0]!.completed).toBe('false')
    expect(JSON.parse(rows[0]!.walk_record_json!).postSurvey).toBeNull()
  })

  it('downloads headers when there are no walks', () => {
    const csv = buildDetailedWalkCsv([])
    expect(parseCsv(csv)).toEqual([])
    expect(csv).toContain('"participantId"')
    expect(csv).toContain('"walk_record_json"')
  })

  it('keeps participant-entered formulas as text while retaining the original record', () => {
    const walk = makeWalk({ plan: { startLocation: '=HYPERLINK("example")', endLocation: 'Home', duration: 15, routeType: 'loop' } })
    const row = parseCsv(buildDetailedWalkCsv([walk]))[0]!
    expect(row['plan.startLocation']).toBe('\'=HYPERLINK("example")')
    expect(JSON.parse(row.walk_record_json!).plan.startLocation).toBe(walk.plan.startLocation)
  })
})

/** requireAuth re-checks the account on every request; stand in for the database lookup. */
function mockAccount(account: { role: string; active: boolean }) {
  vi.spyOn(Account, 'findById').mockReturnValue({ lean: vi.fn().mockResolvedValue(account) } as never)
}

describe('GET /v1/admin/analytics/export.csv', () => {
  it('restricts the download to researchers and medical professionals', async () => {
    const anonymous = await request(app).get('/v1/admin/analytics/export.csv')
    expect(anonymous.status).toBe(401)
    mockAccount({ role: 'participant', active: true })
    const participant = signToken({ id: 'demo', role: 'participant' }).token
    const forbidden = await request(app).get('/v1/admin/analytics/export.csv').auth(participant, { type: 'bearer' })
    expect(forbidden.status).toBe(403)
  })

  it('queries all saved walks inside the current UTC week and returns an uncached CSV', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-08T20:00:00Z'))
    const lean = vi.fn().mockResolvedValue([makeWalk()])
    const sort = vi.fn().mockReturnValue({ lean })
    const find = vi.spyOn(WalkRecord, 'find').mockReturnValue({ sort } as never)
    mockAccount({ role: 'researcher', active: true })
    const token = signToken({ id: 'admin', role: 'researcher' }).token
    const response = await request(app).get('/v1/admin/analytics/export.csv').auth(token, { type: 'bearer' })
    expect(response.status).toBe(200)
    expect(find).toHaveBeenCalledWith({ date: {
      $gte: new Date('2026-10-05T00:00:00Z'), $lt: new Date('2026-10-12T00:00:00Z'),
    } })
    expect(response.headers['content-type']).toContain('text/csv')
    expect(response.headers['cache-control']).toBe('no-store')
    expect(response.headers['content-disposition']).toContain('walking_meditation_walks_week_2026-10-05.csv')
    expect(parseCsv(response.text)).toHaveLength(1)
  })
})
