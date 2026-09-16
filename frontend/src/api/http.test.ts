import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api, setAuthToken, setUnauthorizedHandler } from './http'

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

afterEach(() => {
  vi.restoreAllMocks()
  setAuthToken(null)
  setUnauthorizedHandler(null)
})

describe('api', () => {
  it('sends the bearer token and JSON body', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, { ok: true }))
    setAuthToken('tok')
    await expect(api('/me/walks', { method: 'POST', body: { a: 1 } })).resolves.toEqual({ ok: true })
    const [url, init] = fetchMock.mock.calls[0]!
    expect(String(url)).toMatch(/\/me\/walks$/)
    expect(init?.method).toBe('POST')
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer tok')
    expect(init?.body).toBe('{"a":1}')
  })

  it('omits the token for anonymous requests', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, {}))
    setAuthToken('tok')
    await api('/auth/login', { method: 'POST', body: {}, anonymous: true })
    const init = fetchMock.mock.calls[0]![1]
    expect((init!.headers as Record<string, string>).Authorization).toBeUndefined()
  })

  it('turns an API error body into an ApiError', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'Walk not found.' } }),
    )
    await expect(api('/me/walks/x')).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND', message: 'Walk not found.' })
  })

  it('signs the session out on 401 UNAUTHENTICATED', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(401, { error: { code: 'UNAUTHENTICATED', message: 'Please log in.' } }),
    )
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)
    await expect(api('/me')).rejects.toBeInstanceOf(ApiError)
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })

  it('reports a network failure as a NETWORK ApiError', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
    const err = await api('/health').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).code).toBe('NETWORK')
  })
})
