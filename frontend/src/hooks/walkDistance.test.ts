import { describe, expect, it } from 'vitest'
import { type Fix, haversineMetres, walkedMetres } from './walkDistance'

const base: Fix = { lat: -37.65, lon: 145.01, accuracy: 10, time: 0 }
// About 0.0000090 degrees of latitude is one metre.
const north = (metres: number, seconds: number, accuracy = 10): Fix => ({
  lat: base.lat + metres * 0.000009,
  lon: base.lon,
  accuracy,
  time: seconds * 1000,
})

describe('haversineMetres', () => {
  it('measures roughly one metre per 0.000009 degrees of latitude', () => {
    expect(haversineMetres(base, north(100, 0))).toBeGreaterThan(98)
    expect(haversineMetres(base, north(100, 0))).toBeLessThan(102)
  })
})

describe('walkedMetres', () => {
  it('counts a normal walking step', () => {
    expect(walkedMetres(base, north(6, 5))).toBeGreaterThan(5)
  })

  it('ignores jitter smaller than a real step', () => {
    expect(walkedMetres(base, north(2, 3))).toBe(0)
  })

  it('ignores fixes that are too inaccurate to trust', () => {
    expect(walkedMetres(base, north(20, 15, 80))).toBe(0)
  })

  it('ignores impossible jumps', () => {
    expect(walkedMetres(base, north(200, 5))).toBe(0)
  })

  it('accepts a long gap after the signal was lost', () => {
    expect(walkedMetres(base, north(120, 120))).toBeGreaterThan(100)
  })
})
