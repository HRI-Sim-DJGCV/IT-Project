import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app'
import { signToken } from '../src/auth/jwt'
import { Account } from '../src/models/Account'

const app = createApp()
const ENDPOINT = '/v1/admin/analytics/export.csv'

function mockAccount(account: { role: string; active: boolean } | null) {
  vi.spyOn(Account, 'findById').mockReturnValue({ lean: vi.fn().mockResolvedValue(account) } as never)
}

afterEach(() => { vi.restoreAllMocks() })

describe('requireAuth re-checks the account behind a valid token', () => {
  const token = signToken({ id: 'researcher01', role: 'researcher' }).token

  it('rejects a token for a deactivated account', async () => {
    mockAccount({ role: 'researcher', active: false })
    const res = await request(app).get(ENDPOINT).auth(token, { type: 'bearer' })
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('UNAUTHENTICATED')
  })

  it('rejects a token for an account that no longer exists', async () => {
    mockAccount(null)
    const res = await request(app).get(ENDPOINT).auth(token, { type: 'bearer' })
    expect(res.status).toBe(401)
  })

  it('rejects a token whose role no longer matches the account', async () => {
    mockAccount({ role: 'participant', active: true })
    const res = await request(app).get(ENDPOINT).auth(token, { type: 'bearer' })
    expect(res.status).toBe(401)
  })
})
