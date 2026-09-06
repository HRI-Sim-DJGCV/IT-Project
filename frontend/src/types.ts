// Shared domain types. These mirror the shape we expect the Python/Mongo
// backend to return so the API layer can be swapped without touching UI.

export type Role = 'participant' | 'medical_professional' | 'researcher'

export interface Participant {
  id: string // e.g. "AAA001"
  displayName: string
  /** Id of the admin-defined experimental arm (see `ConditionSetting`), e.g. "A" */
  condition: string
  joinedAt: string // ISO date
}

/** 1 = Not at all … 4 = Very much */
export type SurveyScore = 1 | 2 | 3 | 4

export interface SurveyItem {
  key: string
  statement: string
}

export type SurveyResponse = Record<string, SurveyScore>

export type WalkDuration = 15 | 30 | 45

export type RouteType = 'loop' | 'out_and_back' | 'quiet_streets' | 'green_space'

export interface WalkPlan {
  startLocation: string
  endLocation: string
  duration: WalkDuration
  routeType: RouteType
}

export interface RouteOption {
  id: string
  name: string
  description: string
  distanceKm: number
  estimatedMinutes: number
  /** Simple polyline in 0–100 unit space, used by the placeholder map */
  path: Array<[number, number]>
}

export interface ScriptSegment {
  /** Seconds from walk start at which this segment should be read */
  atSecond: number
  title: string
  text: string
}

export interface WalkRecord {
  id: string
  participantId: string
  date: string // ISO
  plan: WalkPlan
  route: RouteOption
  preSurvey: SurveyResponse
  postSurvey: SurveyResponse | null
  actualMinutes: number
  completed: boolean
}

// ---------------------------------------------------------------------------
// Admin / researcher dashboard
// ---------------------------------------------------------------------------

/**
 * Where a participant is in the trial. Abandoned walks are never saved, so a
 * participant is either yet to walk or has completed at least one walk;
 * 'In progress' is kept so the backend can report it later without a
 * breaking change.
 */
export type ParticipantStatus = 'Not started' | 'In progress' | 'Completed'

/** One row of `GET /admin/participants`. */
export interface AdminParticipantItem {
  id: string
  condition: string
  status: ParticipantStatus
  walkCount: number
  /** ISO date of the most recent walk, or null if none */
  lastWalkAt: string | null
  /**
   * Placeholder labels derived client-side from the "tense" survey item of
   * the latest walk. The backend (`GET /admin/stats`) owns the real scoring
   * rule; delete this derivation when that exists.
   */
  stressStart: string
  stressEnd: string
}

/** Result of `POST /admin/participants`. The access code is returned once. */
export interface CreateParticipantResult {
  participant: AdminParticipantItem
  accessCode: string
}

/** An experimental arm as edited on the admin Settings screen. */
export interface ConditionSetting {
  id: string
  name: string
  /** Text-to-speech persona used to read this arm's script */
  voice: string
  age: number
}