import { describe, expect, it } from 'vitest'
import { decodePolyline, normalisePath, thinPath } from '../src/services/polyline'

describe('decodePolyline', () => {
  it('decodes the example from the Google encoded polyline docs', () => {
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual([
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453],
    ])
  })

  it('returns no points for an empty string and throws on a truncated one', () => {
    expect(decodePolyline('')).toEqual([])
    expect(() => decodePolyline('_p~iF~ps|U_')).toThrow('Invalid polyline')
  })
})

describe('normalisePath', () => {
  it('maps points into the 0-100 unit square with a margin', () => {
    const out = normalisePath([
      [-37.8, 144.96],
      [-37.81, 144.97],
    ])
    expect(out).toHaveLength(2)
    for (const [x, y] of out) {
      expect(x).toBeGreaterThanOrEqual(8)
      expect(x).toBeLessThanOrEqual(92)
      expect(y).toBeGreaterThanOrEqual(8)
      expect(y).toBeLessThanOrEqual(92)
    }
  })

  it('handles degenerate input', () => {
    expect(normalisePath([])).toEqual([])
    expect(normalisePath([[1, 1]])).toEqual([[50, 50]])
  })
})

describe('thinPath', () => {
  it('keeps short paths untouched and samples long ones down to max, keeping both ends', () => {
    const short: Array<[number, number]> = [[0, 0], [1, 1]]
    expect(thinPath(short)).toBe(short)

    const long = Array.from({ length: 1000 }, (_, i) => [i, i] as [number, number])
    const thinned = thinPath(long, 50)
    expect(thinned).toHaveLength(50)
    expect(thinned[0]).toEqual([0, 0])
    expect(thinned[49]).toEqual([999, 999])
  })
})
