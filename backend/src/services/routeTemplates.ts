import type { RouteOption, WalkDuration } from '../../../shared/types'

/**
 * Placeholder routing. Returns the same three template routes the frontend
 * mock did, so the participant app is fully on the real API for the demo.
 * When a map/routing provider (or the landmark model) is adopted, only this
 * function changes; `RouteOption.path` becomes real geometry.
 */
const ROUTE_TEMPLATES: Array<Omit<RouteOption, 'distanceKm' | 'estimatedMinutes'>> = [
  {
    id: 'r1',
    name: 'Route Option 1',
    description: 'Gentle, mostly flat streets with wide footpaths.',
    path: [
      [10, 80],
      [25, 60],
      [45, 65],
      [60, 40],
      [80, 30],
      [90, 15],
    ],
  },
  {
    id: 'r2',
    name: 'Route Option 2',
    description: 'Passes a small park with benches to pause at.',
    path: [
      [10, 80],
      [20, 45],
      [40, 35],
      [55, 55],
      [75, 45],
      [90, 15],
    ],
  },
  {
    id: 'r3',
    name: 'Route Option 3',
    description: 'Quietest option, fewer road crossings.',
    path: [
      [10, 80],
      [30, 85],
      [50, 70],
      [65, 75],
      [85, 40],
      [90, 15],
    ],
  },
]

export function buildRouteOptions(duration: WalkDuration): RouteOption[] {
  const paceKmPerMin = 0.08 // ~4.8 km/h, a relaxed pace
  return ROUTE_TEMPLATES.map((t, i) => {
    const minutes = duration + (i - 1) * 2
    return { ...t, estimatedMinutes: minutes, distanceKm: Math.round(minutes * paceKmPerMin * 10) / 10 }
  })
}
