// Shared domain types, imported by both frontend and backend so the two
// sides cannot drift. Field names are the wire format (camelCase JSON).

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

export interface LatLon {
  lat: number
  lon: number
}

export interface WalkPlan {
  startLocation: string
  /** Set when the participant used their current location or picked the start from the place autocomplete */
  startCoordinates?: LatLon
  endLocation: string
  /** Set when the participant picked the end from the place autocomplete */
  endCoordinates?: LatLon
  duration: WalkDuration
  routeType: RouteType
}

/** A park the route detours through for the compassion-meditation section, if any. */
export interface RoutePark extends LatLon {
  name: string
}

export interface RouteOption {
  id: string
  name: string
  description: string
  distanceKm: number
  estimatedMinutes: number
  /** Simple polyline in 0–100 unit space, used by the fallback drawing */
  path: Array<[number, number]>
  /** Real geographic route points in [latitude, longitude] order, for the map */
  mapPath: Array<[number, number]>
  origin: LatLon
  destination: LatLon
  park: RoutePark | null
}

/** One spoken chunk of the AI-generated meditation script. */
export interface ScriptSegment {
  /** Seconds from walk start at which this segment should be played */
  atSecond: number
  /** Which part of the meditation this belongs to */
  section: 'focused_attention' | 'compassion' | 'closing'
  title: string
  text: string
  /** Index into the preparation's audio files; null when no audio was produced */
  audioIndex: number | null
}

/** The AI-generated script as stored on a walk. Never a fixed template. */
export interface GeneratedScript {
  generator: 'ai'
  /** Identifies the LLM and prompt used, so analysis can group walks */
  model: string
  promptVersion: number
  /** The purpose/context sentence given to the generator */
  context: string
  /** Voice the audio was rendered with */
  voice: { speaker: string; instruct: string }
  segments: ScriptSegment[]
  /** The raw text exactly as returned by the LLM */
  rawText: string
}

export type PreparationStatus = 'pending' | 'generating_script' | 'generating_audio' | 'ready' | 'failed'

/**
 * A walk being prepared: the script and audio are generated server-side
 * before the participant starts walking.
 */
export interface WalkPreparation {
  id: string
  status: PreparationStatus
  /** Audio progress: files done / files total (0/0 until the script exists) */
  progress: { done: number; total: number }
  error: string | null
  /** Present once status is `ready` */
  script: GeneratedScript | null
  createdAt: string
  updatedAt: string
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
  /** The script that was read during this walk (returned by the backend) */
  script?: GeneratedScript
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
  /** Calm scores of the latest walk; null when the participant has not walked */
  latestScores: WalkScores | null
  active: boolean
}

/** Result of `POST /admin/participants`. The access code is returned once. */
export interface CreateParticipantResult {
  participant: AdminParticipantItem
  accessCode: string
}

/**
 * An experimental arm as edited on the admin Settings screen. A condition
 * changes the voice that reads the AI-generated script; the script itself is
 * always generated per walk and is never uploaded or edited.
 */
export interface ConditionSetting {
  id: string
  name: string
  /** Text-to-speech persona used to read this arm's script, e.g. "Male", "Female" or a speaker name */
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

export interface RoutesResponse {
  routes: RouteOption[]
}

export interface PreparationResponse {
  preparation: WalkPreparation
}

export interface ApiErrorBody {
  error: {
    code: string
    message: string
    details?: Array<{ field: string; message: string }>
  }
}
