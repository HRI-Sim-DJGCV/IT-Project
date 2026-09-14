import type { ApiErrorBody } from '../types'

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8000/v1'

let authToken: string | null = null
let onUnauthorized: (() => void) | null = null

/** Set by SessionContext; attached to every request as a Bearer token. */
export function setAuthToken(token: string | null) {
  authToken = token
}

/** Set by SessionContext; called when the API answers 401 so the app can sign out. */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: ApiErrorBody['error']['details']

  constructor(status: number, code: string, message: string, details?: ApiErrorBody['error']['details']) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  /** Skip the Authorization header (login, access code) */
  anonymous?: boolean
}

async function request(path: string, opts: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = {}
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
  if (!opts.anonymous && authToken) headers.Authorization = `Bearer ${authToken}`
  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    })
  } catch {
    throw new ApiError(0, 'NETWORK', 'Could not reach the server. Check your connection and try again.')
  }
  if (res.ok) return res
  let parsed: ApiErrorBody['error'] | null = null
  try {
    parsed = ((await res.json()) as ApiErrorBody).error
  } catch {
    /* no JSON body */
  }
  const code = parsed?.code ?? 'HTTP_ERROR'
  const message = parsed?.message ?? `The server returned status ${res.status}.`
  if (res.status === 401 && code === 'UNAUTHENTICATED' && !opts.anonymous) onUnauthorized?.()
  throw new ApiError(res.status, code, message, parsed?.details)
}

/** JSON request; throws ApiError on any non-2xx. */
export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await request(path, opts)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

/** Binary request (audio, CSV). */
export async function apiBlob(path: string, opts: RequestOptions = {}): Promise<Blob> {
  const res = await request(path, opts)
  return res.blob()
}
