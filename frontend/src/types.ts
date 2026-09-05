// Shared domain types. These mirror the shape we expect the Python/Mongo
// backend to return so the API layer can be swapped without touching UI.

export type Role = 'participant' | 'medical_professional' | 'researcher'

export interface Participant {
  id: string // e.g. "AAA001"
  displayName: string
  condition: 'A' | 'B'
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
