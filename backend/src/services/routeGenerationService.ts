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

function selectBest(
  routes: ComputedRoute[],
  targetSeconds: number,
  routeType: RouteType,
  environment: RouteEnvironment | undefined,
): ComputedRoute {
  if (routes.length === 0) {
    throw new Error('No valid route candidates could be generated.')
  }

  const toleranceSeconds = Math.max(120, targetSeconds * 0.1)
  const withinTolerance = routes.filter(
    (route) => Math.abs(route.durationSeconds - targetSeconds) <= toleranceSeconds,
  )
  const eligible = withinTolerance.length > 0 ? withinTolerance : routes

  return [...eligible].sort((first, second) => {
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
  })[0]
}

export async function generateWalkingRoute(plan: WalkPlan): Promise<RouteOption> {
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

  const route = selectBest(candidates, targetSeconds, plan.routeType, environment)
  const estimatedMinutes = Math.max(1, Math.round(route.durationSeconds / 60))
  const difference = Math.abs(estimatedMinutes - plan.duration)
  const durationNote =
    difference <= Math.max(2, Math.round(plan.duration * 0.1))
      ? `It matches the ${plan.duration}-minute target.`
      : `The closest safe route is ${estimatedMinutes} minutes; the selected locations cannot make an exact ${plan.duration}-minute walk.`
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

  return {
    id: `google-osm-${plan.routeType}-route`,
    name: routeTypeName(plan.routeType),
    description: `${typeNote} ${durationNote}`,
    distanceKm: Number((route.distanceMetres / 1000).toFixed(2)),
    estimatedMinutes,
    path: route.mapPath,
    mapPath: route.mapPath,
  }
}
