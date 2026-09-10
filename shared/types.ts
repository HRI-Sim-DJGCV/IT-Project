// Shared domain types, imported by both frontend and backend so the two
// sides cannot drift. Field names are the wire format (camelCase JSON).
//
// The frontend currently keeps its own copy in frontend/src/types.ts; the
// participant/walk section below is identical to it. Switching the frontend
// to import from here is a one-line change per file, left to the frontend
// owner.

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

/** Server-computed scores returned with every WalkRecord. Never stored. */
export interface WalkScores {
  scoringVersion: number
  pre: { calm: number }
  post: { calm: number } | null
  delta: { calm: number } | null
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
  /** Present on records returned by the backend; absent on the client-built draft */
  scores?: WalkScores
  /** Which version of the condition's script was read during this walk */
  scriptVersion?: number
}

// ---------------------------------------------------------------------------
// Admin / researcher dashboard
// ---------------------------------------------------------------------------

export type ParticipantStatus = 'Not started' | 'In progress' | 'Completed'

/** One row of `GET /admin/participants`. */
export interface AdminParticipantItem {
  id: string
  condition: string
  status: ParticipantStatus
  walkCount: number
  /** ISO date of the most recent walk, or null if none */
  lastWalkAt: string | null
  /** Scale labels for the "tense" item of the latest walk; placeholders until the UI reads `scores` */
  stressStart: string
  stressEnd: string
  active: boolean
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

// ---------------------------------------------------------------------------
// API envelopes (backend responses that are not a bare entity)
// ---------------------------------------------------------------------------

export interface LoginResponse {
  token: string
  expiresAt: string
  role: Role
  participant: Participant | null
}

export interface WalkHistoryResponse {
  walks: WalkRecord[]
  nextBefore: string | null
}

export interface ScriptResponse {
  condition: string
  scriptVersion: number
  segments: ScriptSegment[]
}

export interface ApiErrorBody {
  error: {
    code: string
    message: string
    details?: Array<{ field: string; message: string }>
  }
}
