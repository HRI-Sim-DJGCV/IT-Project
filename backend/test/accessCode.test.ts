import { describe, expect, it } from 'vitest'
import { generateAccessCode, hashAccessCode } from '../src/services/accessCode'

describe('generateAccessCode', () => {
  it('produces XXXX-XXXX codes without ambiguous characters', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateAccessCode()).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/)
    }
  })
})

describe('hashAccessCode', () => {
  it('is case- and whitespace-insensitive so typed codes still match', () => {
    expect(hashAccessCode('k7p2-qx9m')).toBe(hashAccessCode(' K7P2-QX9M '))
    expect(hashAccessCode('K7P2-QX9M')).not.toBe(hashAccessCode('K7P2-QX9N'))
  })
})
