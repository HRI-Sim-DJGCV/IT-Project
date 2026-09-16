import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app'

// No database is connected in these tests, so /health reports disconnected.
const app = createApp()

describe('GET /v1/health', () => {
  it('reports the database state', async () => {
    const res = await request(app).get('/v1/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: false, db: 'disconnected' })
  })
})

describe('error handling', () => {
  it('returns NOT_FOUND for unknown endpoints', async () => {
    const res = await request(app).get('/v1/nope')
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  it('returns VALIDATION_ERROR for malformed JSON', async () => {
    const res = await request(app)
      .post('/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{not json')
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns VALIDATION_ERROR with field details for a bad login body', async () => {
    const res = await request(app).post('/v1/auth/login').send({ role: 'admin' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(res.body.error.details.map((d: { field: string }) => d.field)).toEqual(
      expect.arrayContaining(['role', 'userId', 'password']),
    )
  })
})

describe('auth', () => {
  it('rejects protected routes without a token', async () => {
    const res = await request(app).get('/v1/me/walks')
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('UNAUTHENTICATED')
  })

  it('allows configured and Vercel preview origins, not others', async () => {
    const ok = await request(app).get('/v1/health').set('Origin', 'https://my-app-abc123.vercel.app')
    expect(ok.headers['access-control-allow-origin']).toBe('https://my-app-abc123.vercel.app')
    const no = await request(app).get('/v1/health').set('Origin', 'https://evil.example')
    expect(no.headers['access-control-allow-origin']).toBeUndefined()
  })
})
