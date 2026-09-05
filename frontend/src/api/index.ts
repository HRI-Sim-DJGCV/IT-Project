// Thin async API layer. Every function here will eventually become a fetch()
// against the Python backend; components only ever talk to this module.

import {
  MOCK_CREDENTIALS,
  MOCK_PARTICIPANT,
  MOCK_WALK_HISTORY,
  buildRouteOptions,
  buildScript,
  // for admin
  MOCK_ADMIN_CREDENTIALS,
  MOCK_CONDITIONS
} from '../mock/data'
import type {
  Participant,
  Role,
  RouteOption,
  ScriptSegment,
  WalkDuration,
  WalkRecord,
  AdminParticipantItem,
  ParticipantStatus
} from '../types'

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms))

// In-memory store for walks created during this session (reset on reload).
let walks: WalkRecord[] = [...MOCK_WALK_HISTORY]

export interface LoginResult {
  role: Role
  participant: Participant | null
}

export async function login(
  role: Role,
  userId: string,
  password: string,
): Promise<LoginResult> {
  await delay()

  // admin login logic
  if (role !== 'participant') {
    const adminOk = MOCK_ADMIN_CREDENTIALS.some(
      (c) => c.role === role && c.userId.toLowerCase() === userId.trim().toLowerCase() && c.password === password
    )
    if (!adminOk) throw new Error('Incorrect admin user ID or password.')
    return { role, participant: null }
  }
  // if (role !== 'participant') {
  //   // Admin/researcher views are out of scope for now; accept anything.
  //   return { role, participant: null }
  // }

  // participant login logic
  const ok = MOCK_CREDENTIALS.some(
    (c) => c.userId.toLowerCase() === userId.trim().toLowerCase() && c.password === password,
  )
  if (!ok) throw new Error('Incorrect user ID or password.')
  return { role, participant: MOCK_PARTICIPANT }
}

export async function getWalkHistory(participantId: string): Promise<WalkRecord[]> {
  await delay()
  return walks
    .filter((w) => w.participantId === participantId)
    .sort((a, b) => b.date.localeCompare(a.date))
}

export async function generateRoutes(duration: WalkDuration): Promise<RouteOption[]> {
  await delay(600) // pretend to compute
  return buildRouteOptions(duration)
}

export async function getScript(durationMinutes: number): Promise<ScriptSegment[]> {
  await delay(100)
  return buildScript(durationMinutes)
}

export async function saveWalk(record: WalkRecord): Promise<WalkRecord> {
  await delay()
  walks = [...walks.filter((w) => w.id !== record.id), record]
  return record
}

// ---------------------------------------------------------------------------
// Mock admin endpoints
// ---------------------------------------------------------------------------
export async function getAdminConditions() {
  await delay()
  return [...MOCK_CONDITIONS]
}

export async function getAdminParticipantsFeed(): Promise<AdminParticipantItem[]> {
  await delay()
  
  const participantWalks = walks.filter(w => w.participantId === MOCK_PARTICIPANT.id)
  const latestWalk = participantWalks[0]

  const stressText = (score?: number) => {
    if (!score) return '-'
    if (score === 1) return 'Not at all'
    if (score === 2) return 'Somewhat'
    if (score === 3) return 'Moderate'
    return 'Very much'
  }

  // Explicitly tell TypeScript this string is a ParticipantStatus
  const currentStatus: ParticipantStatus = latestWalk 
    ? (latestWalk.completed ? 'Completed' : 'In progress') 
    : 'Not started'

  return [
    {
      id: MOCK_PARTICIPANT.id,
      condition: MOCK_PARTICIPANT.condition,
      status: currentStatus,
      setup: participantWalks.length || 1,
      stressStart: stressText(latestWalk?.preSurvey?.tense), 
      stressEnd: stressText(latestWalk?.postSurvey?.tense),
    }
  ]
}