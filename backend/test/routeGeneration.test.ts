import { describe, expect, it } from 'vitest'
import type { ComputedRoute, LngLat } from '../src/services/googleMapsService'
import {
  loopShapeQuality,
  loopWaypoints,
} from '../src/services/routeGenerationService'

function distanceMetres(first: LngLat, second: LngLat): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180
  const latitudeDelta = radians(second[1] - first[1])
  const longitudeDelta = radians(second[0] - first[0])
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(first[1])) *
      Math.cos(radians(second[1])) *
      Math.sin(longitudeDelta / 2) ** 2
  return 2 * 6_371_000 * Math.asin(Math.sqrt(value))
}

function route(mapPath: ComputedRoute['mapPath']): ComputedRoute {
  return { mapPath, distanceMetres: 1_000, durationSeconds: 900 }
}

describe('loop route shape', () => {
  it('creates three well-separated points around the requested circuit', () => {
    const start: LngLat = [145.01, -37.65]
    const points = loopWaypoints(start, 0, 200)

    expect(points).toHaveLength(3)
    expect(distanceMetres(start, points[0]!)).toBeGreaterThan(250)
    expect(distanceMetres(points[0]!, points[1]!)).toBeGreaterThan(250)
    expect(distanceMetres(points[1]!, points[2]!)).toBeGreaterThan(250)
    expect(distanceMetres(points[2]!, start)).toBeGreaterThan(250)
  })

  it('scores a broad circuit above a retraced up-and-back line', () => {
    const broadCircuit = route([
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 0],
      [0, 0],
    ])
    const retracedLine = route([
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 1],
      [0, 0],
    ])

    expect(loopShapeQuality(broadCircuit)).toBeGreaterThan(0.75)
    expect(loopShapeQuality(retracedLine)).toBe(0)
  })
})
