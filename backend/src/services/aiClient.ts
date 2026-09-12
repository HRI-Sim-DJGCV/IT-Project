/**
 * Client for the internal Python AI service (server/). The app never talks to
 * it directly: every call goes through this API so the Google and OpenAI keys
 * stay server-side and identity always comes from our JWT.
 */
import type { LatLon } from '../../../shared/types'
import { config } from '../config'
import { ApiError } from '../errors'

export interface AiRouteInfo {
  duration_s: number
  distance_m: number
  polyline: string
}

export interface AiParkDetour {
  park: { place_id: string; name: string; lat: number; lon: number }
  baseline_s: number
  detour_s: number
  added_s: number
  slack_s: number
  /** Present for the first few parks when `park_polylines` > 0 */
  route: AiRouteInfo | null
}

export interface AiRouteResponse {
  origin: LatLon
  destination: LatLon
  total_travel_time: number
  baseline: AiRouteInfo
  parks: AiParkDetour[]
}

export interface AiScriptRequest {
  source: LatLon
  destination: LatLon
  total_walking_time: number
  context: string
  park: LatLon | null
  /** Seconds walking to the park, at the park, and from the park to the end (park routes only) */
  park_timing: { to_park: number; at_park: number; park_to_destination: number } | null
}

export interface AiScriptResponse {
  script: string
  model: string
  prompt_version: number
}

class AiServiceError extends ApiError {
  constructor(message: string) {
    super(502, 'AI_SERVICE', message)
  }
}

async function call<T>(path: string, body: unknown, accept: 'json' | 'audio'): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (config.AI_INTERNAL_KEY) headers['X-Internal-Key'] = config.AI_INTERNAL_KEY
  let res: Response
  try {
    res = await fetch(`${config.AI_SERVICE_URL}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(config.AI_TIMEOUT_MS),
    })
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    throw new AiServiceError(`The meditation service is unavailable (${reason}).`)
  }
  if (!res.ok) {
    let detail = `status ${res.status}`
    try {
      const j = (await res.json()) as { detail?: unknown }
      if (typeof j.detail === 'string') detail = j.detail
    } catch {
      /* not json */
    }
    // 404 from the Places lookup means the typed address could not be found; pass that message through as a 400.
    if (res.status === 404) throw new ApiError(400, 'VALIDATION_ERROR', detail)
    throw new AiServiceError(detail)
  }
  if (accept === 'audio') return Buffer.from(await res.arrayBuffer()) as unknown as T
  return (await res.json()) as T
}

export interface RouteQuery {
  startLocation: string
  startCoordinates?: LatLon
  endLocation: string
  totalSeconds: number
  parkPolylines: number
}

export const aiClient = {
  async health(): Promise<boolean> {
    try {
      const res = await fetch(`${config.AI_SERVICE_URL}/health`, { signal: AbortSignal.timeout(3000) })
      return res.ok
    } catch {
      return false
    }
  },

  generateRoute(q: RouteQuery): Promise<AiRouteResponse> {
    return call<AiRouteResponse>(
      '/route/generate-from-text',
      {
        start_location: q.startLocation,
        start_coordinates: q.startCoordinates ?? null,
        end_location: q.endLocation,
        total_travel_time: q.totalSeconds,
        park_polylines: q.parkPolylines,
      },
      'json',
    )
  },

  generateScript(req: AiScriptRequest): Promise<AiScriptResponse> {
    return call<AiScriptResponse>('/script/generate', req, 'json')
  },

  /** Returns mp3 bytes. */
  synthesize(text: string, speaker: string, instruct: string): Promise<Buffer> {
    return call<Buffer>('/tts', { text, language: 'English', speaker, instruct, bitrate: '128k' }, 'audio')
  },
}
