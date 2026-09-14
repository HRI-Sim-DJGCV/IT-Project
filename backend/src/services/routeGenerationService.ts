import type { RouteOption, RouteType, WalkPlan } from '../../../shared/types'
import {
  computeGoogleRoutes,
  geocodeLocation,
} from './googleMapsService'
import type { ComputedRoute, LngLat } from './googleMapsService'
import {
  loadRouteEnvironment,
  type RouteEnvironment,
} from './openStreetMapService'
import { normalisePath, thinPath } from './polyline'

type RouteRequest = () => Promise<ComputedRoute[]>
const WALKING_METRES_PER_SECOND = 1.3

function routeTypeName(routeType: RouteType): string {
  switch (routeType) {
    case 'loop':
      return 'Loop route'
    case 'out_and_back':
      return 'Out-and-back route'
    case 'quiet_streets':
      return 'Quiet-streets route'
    case 'green_space':
      return 'Parks and green-spaces route'
  }
}

function offsetCoordinate(
  origin: LngLat,
  bearingDegrees: number,
  distanceMetres: number,
): LngLat {
  const earthRadius = 6_371_000
  const [longitude, latitude] = origin
  const bearing = (bearingDegrees * Math.PI) / 180
  const angularDistance = distanceMetres / earthRadius
  const latitudeRadians = (latitude * Math.PI) / 180
  const longitudeRadians = (longitude * Math.PI) / 180
  const nextLatitude = Math.asin(
    Math.sin(latitudeRadians) * Math.cos(angularDistance) +
      Math.cos(latitudeRadians) * Math.sin(angularDistance) * Math.cos(bearing),
  )
  const nextLongitude =
    longitudeRadians +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitudeRadians),
      Math.cos(angularDistance) - Math.sin(latitudeRadians) * Math.sin(nextLatitude),
    )
  return [(nextLongitude * 180) / Math.PI, (nextLatitude * 180) / Math.PI]
}

function midpoint(first: LngLat, second: LngLat): LngLat {
  return [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2]
}

async function runCandidates(requests: RouteRequest[]): Promise<ComputedRoute[]> {
  const routes: ComputedRoute[] = []

  // Avoid sending a large burst of paid Google requests at once.
  for (let index = 0; index < requests.length; index += 3) {
    const batch = await Promise.allSettled(
      requests.slice(index, index + 3).map((request) => request()),
    )
    for (const result of batch) {
      if (result.status === 'fulfilled') routes.push(...result.value)
      else console.warn('[Route candidate rejected]', result.reason)
    }
  }

  return routes
}

function loopRequests(start: LngLat, targetSeconds: number): RouteRequest[] {
  const radius = Math.max(180, (targetSeconds * WALKING_METRES_PER_SECOND) / 3.8)
  const requests: RouteRequest[] = []

  for (const bearing of [0, 90, 180, 270]) {
    for (const scale of [0.85, 1.15]) {
      const first = offsetCoordinate(start, bearing, radius * scale)
      const second = offsetCoordinate(start, bearing + 120, radius * scale)
      requests.push(() => computeGoogleRoutes(start, start, [first, second]))
    }
  }
  return requests
}

function makeOutAndBack(oneWay: ComputedRoute): ComputedRoute {
  return {
    mapPath: [...oneWay.mapPath, ...oneWay.mapPath.slice(0, -1).reverse()],
    distanceMetres: oneWay.distanceMetres * 2,
    durationSeconds: oneWay.durationSeconds * 2,
  }
}

function ordinaryCandidateRequests(
  start: LngLat,
  end: LngLat,
  targetSeconds: number,
): RouteRequest[] {
  const requests: RouteRequest[] = [
    () => computeGoogleRoutes(start, end, [], true),
  ]
  const centre = midpoint(start, end)
  const radius = Math.max(140, (targetSeconds * WALKING_METRES_PER_SECOND) / 6)

  for (const bearing of [0, 45, 90, 135, 180, 225, 270, 315]) {
    requests.push(() =>
      computeGoogleRoutes(start, end, [offsetCoordinate(centre, bearing, radius)]),
    )
  }
  return requests
}

async function withEnvironment(
  routes: ComputedRoute[],
): Promise<RouteEnvironment | undefined> {
  try {
    return await loadRouteEnvironment(routes)
  } catch (error) {
    console.warn('[Route environment scoring skipped]', error)
    return undefined
  }
}

async function addGreenCandidates(
  start: LngLat,
  end: LngLat,
  routes: ComputedRoute[],
  environment: RouteEnvironment | undefined,
): Promise<ComputedRoute[]> {
  if (!environment) return routes
  const requests = environment.greenWaypoints().map<RouteRequest>(
    (waypoint) => () => computeGoogleRoutes(start, end, [waypoint]),
  )
  return [...routes, ...(await runCandidates(requests))]
}

function haversineMetres(first: [number, number], second: [number, number]): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180
  const earthRadius = 6_371_000
  const latitudeDelta = radians(second[0] - first[0])
  const longitudeDelta = radians(second[1] - first[1])
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(first[0])) *
      Math.cos(radians(second[0])) *
      Math.sin(longitudeDelta / 2) ** 2
  return 2 * earthRadius * Math.asin(Math.sqrt(value))
}

function samplePoints(path: Array<[number, number]>, count: number): Array<[number, number]> {
  const step = (path.length - 1) / (count - 1)
  return Array.from({ length: count }, (_, i) => path[Math.round(i * step)] as [number, number])
}

/** Two candidates count as the same walk when most of their sampled points nearly coincide. */
function isSimilarRoute(first: ComputedRoute, second: ComputedRoute): boolean {
  const a = samplePoints(first.mapPath, 5)
  const b = samplePoints(second.mapPath, 5)
  const close = a.filter((point, i) => haversineMetres(point, b[i] as [number, number]) < 80).length
  return close >= 4
}

function selectBestRoutes(
  routes: ComputedRoute[],
  targetSeconds: number,
  routeType: RouteType,
  environment: RouteEnvironment | undefined,
  count = 3,
): ComputedRoute[] {
  if (routes.length === 0) {
    throw new Error('No valid route candidates could be generated.')
  }

  const toleranceSeconds = Math.max(120, targetSeconds * 0.1)
  const withinTolerance = routes.filter(
    (route) => Math.abs(route.durationSeconds - targetSeconds) <= toleranceSeconds,
  )
  const eligible = withinTolerance.length > 0 ? withinTolerance : routes

  const ranked = [...eligible].sort((first, second) => {
    const rank = (route: ComputedRoute) => {
      const durationError = Math.abs(route.durationSeconds - targetSeconds) / targetSeconds
      const scores = environment?.score(route)
      const preference =
        routeType === 'quiet_streets'
          ? scores?.quietScore ?? 0
          : routeType === 'green_space'
            ? scores?.greenScore ?? 0
            : 0

      // When at least one route is within tolerance, environmental quality can
      // decide between them. Otherwise, duration remains the dominant factor.
      return withinTolerance.length > 0
        ? durationError * 0.5 - preference
        : durationError * 5 - preference * 0.25
    }
    return rank(first) - rank(second)
  })

  // Best first, skipping near-duplicates so the options genuinely differ.
  const picked: ComputedRoute[] = []
  for (const route of ranked) {
    if (picked.some((existing) => isSimilarRoute(existing, route))) continue
    picked.push(route)
    if (picked.length === count) break
  }
  return picked
}

export async function generateWalkingRoutes(plan: WalkPlan): Promise<RouteOption[]> {
  const start: LngLat = plan.startCoordinates
    ? [plan.startCoordinates.lon, plan.startCoordinates.lat]
    : await geocodeLocation(plan.startLocation)
  const targetSeconds = plan.duration * 60
  let candidates: ComputedRoute[]
  let environment: RouteEnvironment | undefined

  if (plan.routeType === 'loop') {
    candidates = await runCandidates(loopRequests(start, targetSeconds))
  } else {
    if (!plan.endLocation?.trim()) {
      throw new Error(
        plan.routeType === 'out_and_back'
          ? 'Choose a turnaround point for the out-and-back route.'
          : 'Choose an end location or select “End where I started”.',
      )
    }
    const end: LngLat = plan.endCoordinates
      ? [plan.endCoordinates.lon, plan.endCoordinates.lat]
      : plan.endLocation === plan.startLocation
        ? start
        : await geocodeLocation(plan.endLocation, start)

    if (plan.routeType === 'out_and_back') {
      const oneWay = await computeGoogleRoutes(start, end, [], true)
      candidates = oneWay.map(makeOutAndBack)
    } else {
      candidates = await runCandidates(
        ordinaryCandidateRequests(start, end, targetSeconds),
      )
      environment = await withEnvironment(candidates)
      if (plan.routeType === 'green_space') {
        candidates = await addGreenCandidates(start, end, candidates, environment)
        environment = await withEnvironment(candidates)
      }
    }
  }

  let typeNote: string
  switch (plan.routeType) {
    case 'loop':
      typeNote = 'It returns to the starting point without needing an end address.'
      break
    case 'out_and_back':
      typeNote = 'It reaches the selected turnaround point and follows the same path back.'
      break
    case 'quiet_streets':
      typeNote = environment
        ? 'OpenStreetMap road data was used to favour side and residential streets.'
        : 'Street scoring was unavailable, so this route cannot guarantee quiet streets.'
      break
    case 'green_space':
      typeNote = environment
        ? 'OpenStreetMap data was used to favour parks, paths, and trails.'
        : 'Green-space scoring was unavailable, so this route cannot guarantee park or trail use.'
      break
  }

  const best = selectBestRoutes(candidates, targetSeconds, plan.routeType, environment)
  return best.map((route, index) => {
    const estimatedMinutes = Math.max(1, Math.round(route.durationSeconds / 60))
    const difference = Math.abs(estimatedMinutes - plan.duration)
    const durationNote =
      difference <= Math.max(2, Math.round(plan.duration * 0.1))
        ? `It matches the ${plan.duration}-minute target.`
        : `This option is ${estimatedMinutes} minutes; the selected locations cannot make an exact ${plan.duration}-minute walk.`

    const mapPath = thinPath(route.mapPath)
    const first = mapPath[0] as [number, number]
    const last = mapPath[mapPath.length - 1] as [number, number]
    return {
      id: `google-osm-${plan.routeType}-route-${index + 1}`,
      name: index === 0 ? routeTypeName(plan.routeType) : `${routeTypeName(plan.routeType)} · option ${index + 1}`,
      description: `${typeNote} ${durationNote}`,
      distanceKm: Number((route.distanceMetres / 1000).toFixed(2)),
      estimatedMinutes,
      path: normalisePath(mapPath),
      mapPath,
      origin: { lat: first[0], lon: first[1] },
      destination: { lat: last[0], lon: last[1] },
      park: null,
    }
  })
}
