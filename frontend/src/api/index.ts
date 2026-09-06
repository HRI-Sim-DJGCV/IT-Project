// Mock API layer. Every component fetches data through these functions and
// nowhere else, so swapping to the real backend means editing this file only.
// See docs/backend-api-spec.md for the matching endpoints.

import {
  MOCK_ADMIN_CREDENTIALS,
  MOCK_CONDITIONS,
  MOCK_CREDENTIALS,
  MOCK_PARTICIPANT,
  MOCK_WALK_HISTORY,
  SURVEY_SCALE,
  buildRouteOptions,
  buildScript,
} from '../mock/data'
import type {
  AdminParticipantItem,
  ConditionSetting,
  CreateParticipantResult,
  Participant,
  ParticipantStatus,
  Role,
  RouteOption,
  ScriptSegment,
  SurveyScore,
  WalkDuration,
  WalkRecord,
} from '../types'

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms))

// In-memory stores for data created during this session (reset on reload).
let walks: WalkRecord[] = [...MOCK_WALK_HISTORY]
let participants: Participant[] = [MOCK_PARTICIPANT]
let conditions: ConditionSetting[] = [...MOCK_CONDITIONS]

const newestFirst = (list: WalkRecord[]) => [...list].sort((a, b) => b.date.localeCompare(a.date))

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface LoginResult {
  role: Role
  participant: Participant | null
}

/** POST /auth/login */
export async function login(
  role: Role,
  userId: string,
  password: string,
): Promise<LoginResult> {
  await delay()
  const id = userId.trim().toLowerCase()

  if (role !== 'participant') {
    const adminOk = MOCK_ADMIN_CREDENTIALS.some(
      (c) => c.role === role && c.userId.toLowerCase() === id && c.password === password,
    )
    if (!adminOk) throw new Error('Incorrect user ID or password.')
    return { role, participant: null }
  }

  const ok = MOCK_CREDENTIALS.some((c) => c.userId.toLowerCase() === id && c.password === password)
  if (!ok) throw new Error('Incorrect user ID or password.')
  return { role, participant: MOCK_PARTICIPANT }
}

// ---------------------------------------------------------------------------
// Participant
// ---------------------------------------------------------------------------

/** GET /me/walks — newest first */
export async function getWalkHistory(participantId: string): Promise<WalkRecord[]> {
  await delay()
  return newestFirst(walks.filter((w) => w.participantId === participantId))
}

/** POST /routes/generate */
export async function generateRoutes(duration: WalkDuration): Promise<RouteOption[]> {
  await delay(600) // pretend to compute
  return buildRouteOptions(duration)
}

/** GET /scripts */
export async function getScript(durationMinutes: number): Promise<ScriptSegment[]> {
  await delay(100)
  return buildScript(durationMinutes)
}

/** POST /me/walks */
export async function saveWalk(record: WalkRecord): Promise<WalkRecord> {
  await delay()
  walks = [...walks.filter((w) => w.id !== record.id), record]
  return record
}

// ---------------------------------------------------------------------------
// Admin / researcher (spec §5). All of these require a non-participant role;
// the mock does not enforce that because RequireAdmin guards the routes.
// ---------------------------------------------------------------------------

/** GET /admin/conditions */
export async function getAdminConditions(): Promise<ConditionSetting[]> {
  await delay()
  return conditions.map((c) => ({ ...c }))
}

/** PUT /admin/conditions/{id}, applied to the whole list for the mock. */
export async function saveAdminConditions(next: ConditionSetting[]): Promise<ConditionSetting[]> {
  await delay()
  const ids = new Set<string>()
  for (const c of next) {
    if (!c.id.trim() || !c.name.trim() || !c.voice.trim()) throw new Error('Every condition needs an id, name and voice.')
    if (!Number.isFinite(c.age) || c.age <= 0) throw new Error(`Condition ${c.id}: age must be a positive number.`)
    if (ids.has(c.id)) throw new Error(`Duplicate condition id "${c.id}".`)
    ids.add(c.id)
  }
  conditions = next.map((c) => ({ ...c }))
  return conditions.map((c) => ({ ...c }))
}

/**
 * Placeholder for the backend's scoring. Maps a single survey item to its
 * scale label; the real rule lives in `GET /admin/stats`.
 */
function scaleLabel(score: SurveyScore | undefined): string {
  return SURVEY_SCALE.find((s) => s.value === score)?.label ?? '–'
}

function toAdminItem(p: Participant): AdminParticipantItem {
  const own = newestFirst(walks.filter((w) => w.participantId === p.id))
  const latest = own[0]
  let status: ParticipantStatus = 'Not started'
  if (latest) status = latest.completed ? 'Completed' : 'In progress'
  return {
    id: p.id,
    condition: p.condition,
    status,
    walkCount: own.length,
    lastWalkAt: latest?.date ?? null,
    stressStart: scaleLabel(latest?.preSurvey.tense),
    stressEnd: scaleLabel(latest?.postSurvey?.tense),
  }
}

/** GET /admin/participants — most recently joined first */
export async function getAdminParticipants(): Promise<AdminParticipantItem[]> {
  await delay()
  return [...participants]
    .sort((a, b) => b.joinedAt.localeCompare(a.joinedAt))
    .map(toAdminItem)
}

/** Next free id in the AAA### series (the backend will own this). */
function nextParticipantId(): string {
  const max = participants.reduce((acc, p) => {
    const m = /^AAA(\d{3})$/.exec(p.id)
    return m ? Math.max(acc, Number(m[1])) : acc
  }, 0)
  return `AAA${String(max + 1).padStart(3, '0')}`
}

/** Single-use access code, e.g. "K7P2-QX9M". Unambiguous alphabet (no 0/O, 1/I). */
function generateAccessCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length])
  return `${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`
}

/**
 * POST /admin/participants — the server assigns the id and generates the
 * access code, which is returned exactly once.
 */
export async function createAdminParticipant(conditionId: string): Promise<CreateParticipantResult> {
  await delay()
  if (!conditions.some((c) => c.id === conditionId)) {
    throw new Error(`Unknown condition "${conditionId}".`)
  }
  const id = nextParticipantId()
  const participant: Participant = {
    id,
    displayName: `Participant ${id}`,
    condition: conditionId,
    joinedAt: new Date().toISOString(),
  }
  participants = [...participants, participant]
  return { participant: toAdminItem(participant), accessCode: generateAccessCode() }
}

/**
 * Walks across all participants, newest first, each tagged with the
 * participant's condition. Feeds the CSV export until `GET /admin/export.csv`
 * exists (the backend will copy `condition` onto the walk at save time).
 */
export async function getAdminWalks(): Promise<Array<WalkRecord & { condition: string }>> {
  await delay()
  const conditionOf = new Map(participants.map((p) => [p.id, p.condition]))
  return newestFirst(walks).map((w) => ({ ...w, condition: conditionOf.get(w.participantId) ?? '' }))
}
