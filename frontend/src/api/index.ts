// Thin async API layer. Every function here will eventually become a fetch()
// against the Python backend; components only ever talk to this module.

import {
  MOCK_CREDENTIALS,
  MOCK_PARTICIPANT,
  MOCK_WALK_HISTORY,
  buildRouteOptions,
  buildScript,
} from '../mock/data'
import type {
  Participant,
  Role,
  RouteOption,
  ScriptSegment,
  WalkDuration,
  WalkRecord,
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
  if (role !== 'participant') {
    // Admin/researcher views are out of scope for now; accept anything.
    return { role, participant: null }
  }
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
