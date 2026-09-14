// API layer. Every component fetches data through these functions and nowhere
// else. Endpoints are documented in docs/backend-api-spec.md.

import type {
  AdminParticipantItem,
  ConditionSetting,
  CreateParticipantResult,
  LoginResponse,
  Participant,
  PreparationResponse,
  Role,
  RouteOption,
  RoutesResponse,
  SurveyResponse,
  WalkHistoryResponse,
  WalkPlan,
  WalkPreparation,
  WalkRecord,
} from '../types'
import { api, apiBlob } from './http'

export { ApiError } from './http'

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface LoginResult {
  token: string
  expiresAt: string
  role: Role
  participant: Participant | null
}

/** POST /auth/login */
export function login(role: Role, userId: string, password: string): Promise<LoginResult> {
  return api<LoginResponse>('/auth/login', { method: 'POST', body: { role, userId, password }, anonymous: true })
}

/** POST /auth/access-code: first login. Redeems the single-use code and sets a password. */
export function redeemAccessCode(userId: string, accessCode: string, password: string): Promise<LoginResult> {
  return api<LoginResponse>('/auth/access-code', {
    method: 'POST',
    body: { userId, accessCode, password },
    anonymous: true,
  })
}

/** GET /me: validates a stored token and returns who it belongs to. */
export function getMe(): Promise<{ role: Role; participant: Participant | null }> {
  return api('/me')
}

// ---------------------------------------------------------------------------
// Participant
// ---------------------------------------------------------------------------

/** GET /me/walks: newest first. */
export async function getWalkHistory(): Promise<WalkRecord[]> {
  const res = await api<WalkHistoryResponse>('/me/walks?limit=200')
  return res.walks
}

/** POST /routes/generate: real routes for the plan. A direct route first, then park detours that fit. */
export async function generateRoutes(plan: WalkPlan): Promise<RouteOption[]> {
  const res = await api<RoutesResponse>('/routes/generate', { method: 'POST', body: plan })
  return res.routes
}

/** POST /me/walks/prepare: start generating this walk's script and audio. Poll with getPreparation. */
export async function prepareWalk(plan: WalkPlan, route: RouteOption): Promise<WalkPreparation> {
  const res = await api<PreparationResponse>('/me/walks/prepare', { method: 'POST', body: { plan, route } })
  return res.preparation
}

/** GET /me/walks/prepare/{id} */
export async function getPreparation(id: string): Promise<WalkPreparation> {
  const res = await api<PreparationResponse>(`/me/walks/prepare/${encodeURIComponent(id)}`)
  return res.preparation
}

/** GET /me/walks/prepare/{id}/audio/{index}: one mp3 segment. */
export function getSegmentAudio(preparationId: string, index: number): Promise<Blob> {
  return apiBlob(`/me/walks/prepare/${encodeURIComponent(preparationId)}/audio/${index}`)
}

export interface SaveWalkInput {
  clientId: string
  date: string
  plan: WalkPlan
  route: RouteOption
  preSurvey: SurveyResponse
  postSurvey: SurveyResponse
  actualMinutes: number
  preparationId: string
}

/** POST /me/walks. `clientId` makes a retry safe; the server attaches the generated script. */
export function saveWalk(input: SaveWalkInput): Promise<WalkRecord> {
  return api<WalkRecord>('/me/walks', { method: 'POST', body: input })
}

// ---------------------------------------------------------------------------
// Admin / researcher
// ---------------------------------------------------------------------------

/** GET /admin/conditions */
export async function getAdminConditions(): Promise<ConditionSetting[]> {
  const res = await api<{ conditions: ConditionSetting[] }>('/admin/conditions')
  return res.conditions
}

/** PUT /admin/conditions: replaces the whole list. */
export async function saveAdminConditions(next: ConditionSetting[]): Promise<ConditionSetting[]> {
  const res = await api<{ conditions: ConditionSetting[] }>('/admin/conditions', { method: 'PUT', body: { conditions: next } })
  return res.conditions
}

/** GET /admin/participants: most recently joined first. */
export async function getAdminParticipants(): Promise<AdminParticipantItem[]> {
  const res = await api<{ participants: AdminParticipantItem[] }>('/admin/participants')
  return res.participants
}

/** POST /admin/participants: the server assigns the id and returns the access code exactly once. */
export function createAdminParticipant(conditionId: string): Promise<CreateParticipantResult> {
  return api<CreateParticipantResult>('/admin/participants', { method: 'POST', body: { condition: conditionId } })
}

/** GET /admin/export.csv: one row per walk, built by the server. */
export function getAdminExportCsv(): Promise<Blob> {
  return apiBlob('/admin/export.csv')
}
