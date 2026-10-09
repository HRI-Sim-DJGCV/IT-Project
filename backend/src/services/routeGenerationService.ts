import type { RouteOption, RouteType, WalkPlan } from '../../../shared/types'
import {
  computeGoogleRoutes,
  geocodeLocation,
  searchNearbyParks,
} from './googleMapsService'
import type { ComputedRoute, LngLat, NearbyPark } from './googleMapsService'
import { normalisePath, thinPath } from './polyline'

type GreenMode = 'nearby-parks' | 'park-detour' | 'no-nearby-park'

interface RouteCandidate extends ComputedRoute {
  parks?: NearbyPark[]
  greenMode?: GreenMode
  quietDetour?: boolean
}

type RouteRequest = () => Promise<RouteCandidate[]>
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

function sameLocation(first: LngLat, second: LngLat): boolean {
  return Math.abs(first[0] - second[0]) < 0.00001 &&
    Math.abs(first[1] - second[1]) < 0.00001
}

async function runCandidates(requests: RouteRequest[]): Promise<RouteCandidate[]> {
  const routes: RouteCandidate[] = []

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

export function loopWaypoints(
  start: LngLat,
  bearing: number,
  radius: number,
): LngLat[] {
  const centre = offsetCoordinate(start, bearing, radius)
  return [
    offsetCoordinate(centre, bearing + 270, radius),
    offsetCoordinate(centre, bearing, radius),
    offsetCoordinate(centre, bearing + 90, radius),
  ]
}

function loopRequests(start: LngLat, targetSeconds: number): RouteRequest[] {
  // Put the start on the edge of an imaginary circle, then force Google through
  // the other three quarters. This prevents the narrow out-and-back shape that
  // one or two waypoints commonly produce.
  const radius = Math.max(140, (targetSeconds * WALKING_METRES_PER_SECOND) / 6.2)
  const requests: RouteRequest[] = []

  for (const bearing of [0, 90, 180, 270]) {
    for (const scale of [0.85, 1.15]) {
      const scaledRadius = radius * scale
      const waypoints = loopWaypoints(start, bearing, scaledRadius)
      requests.push(() => computeGoogleRoutes(start, start, waypoints))
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

function quietCandidateRequests(
  start: LngLat,
  end: LngLat,
  targetSeconds: number,
): RouteRequest[] {
  const mark = (routes: ComputedRoute[], quietDetour: boolean): RouteCandidate[] =>
    routes.map((route) => ({ ...route, quietDetour }))

  if (sameLocation(start, end)) {
    const radius = Math.max(140, (targetSeconds * WALKING_METRES_PER_SECOND) / 6.2)
    const requests: RouteRequest[] = []
    for (const bearing of [0, 90, 180, 270]) {
      for (const scale of [0.85, 1.15]) {
        requests.push(async () =>
          mark(
            await computeGoogleRoutes(
              start,
              end,
              loopWaypoints(start, bearing, radius * scale),
            ),
            true,
          ),
        )
      }
    }
    return requests
  }

  const centre = midpoint(start, end)
  const detourRadius = Math.min(
    700,
    Math.max(120, (targetSeconds * WALKING_METRES_PER_SECOND) / 8),
  )
  const requests: RouteRequest[] = [
    async () => mark(await computeGoogleRoutes(start, end, [], true), false),
  ]
  for (const bearing of [0, 45, 90, 135, 180, 225, 270, 315]) {
    requests.push(async () =>
      mark(
        await computeGoogleRoutes(start, end, [
          offsetCoordinate(centre, bearing, detourRadius),
        ]),
        true,
      ),
    )
  }
  return requests
}

async function addGreenCandidates(
  start: LngLat,
  end: LngLat,
  routes: RouteCandidate[],
  places: NearbyPark[],
): Promise<RouteCandidate[]> {
  const selectedPlaces = places.slice(0, 6)
  const requests = selectedPlaces.map<RouteRequest>((place) => async () =>
    (await computeGoogleRoutes(start, end, [place.location])).map((route) => ({
      ...route,
      parks: [place],
      greenMode: 'nearby-parks',
    })),
  )

  // Also try a route through several nearby parks/trails. Duration ranking will
  // discard it when the detour is too large for the participant's chosen time.
  if (selectedPlaces.length > 1) {
    const combined = selectedPlaces.slice(0, 3)
    requests.push(async () =>
      (await computeGoogleRoutes(start, end, combined.map((place) => place.location))).map(
        (route) => ({
          ...route,
          parks: combined,
          greenMode: 'nearby-parks',
        }),
      ),
    )
  }
  return [...routes, ...(await runCandidates(requests))]
}

function distanceFromParkToRoutes(
  park: NearbyPark,
  routes: ComputedRoute[],
): number {
  const parkLatLon: [number, number] = [park.location[1], park.location[0]]
  return Math.min(
    ...routes.flatMap((route) => {
      const step = Math.max(1, Math.floor(route.mapPath.length / 80))
      return route.mapPath
        .filter((_, index) => index % step === 0)
        .map((point) => haversineMetres(parkLatLon, point))
    }),
  )
}

function parkSearchArea(
  start: LngLat,
  end: LngLat,
  targetSeconds: number,
): { centre: LngLat; radiusMetres: number } {
  const centre = midpoint(start, end)
  const directDistance = haversineMetres(
    [start[1], start[0]],
    [end[1], end[0]],
  )
  return {
    centre,
    radiusMetres: Math.min(
      5_000,
      Math.max(1_200, directDistance / 2 + 800, targetSeconds * WALKING_METRES_PER_SECOND / 2),
    ),
  }
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

/** 0 for a retraced line, closer to 1 for a broad circular loop. */
export function loopShapeQuality(route: ComputedRoute): number {
  const averageLatitude =
    route.mapPath.reduce((sum, [latitude]) => sum + latitude, 0) /
    route.mapPath.length
  const longitudeScale = Math.cos((averageLatitude * Math.PI) / 180)
  const points = route.mapPath.map(([latitude, longitude]) => [
    longitude * longitudeScale,
    latitude,
  ] as const)
  let twiceArea = 0
  let perimeter = 0
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!
    const next = points[(index + 1) % points.length]!
    twiceArea += current[0] * next[1] - next[0] * current[1]
    perimeter += Math.hypot(next[0] - current[0], next[1] - current[1])
  }
  const circularity =
    perimeter === 0 ? 0 : Math.min(1, (2 * Math.PI * Math.abs(twiceArea)) / perimeter ** 2)
  const xs = points.map(([x]) => x)
  const ys = points.map(([, y]) => y)
  const width = Math.max(...xs) - Math.min(...xs)
  const height = Math.max(...ys) - Math.min(...ys)
  const aspect = Math.max(width, height) === 0
    ? 0
    : Math.min(width, height) / Math.max(width, height)
  return circularity * 0.65 + aspect * 0.35
}

function selectBestRoutes(
  routes: RouteCandidate[],
  targetSeconds: number,
  routeType: RouteType,
  count = 3,
): RouteCandidate[] {
  if (routes.length === 0) {
    throw new Error('No valid route candidates could be generated.')
  }

  const toleranceSeconds = Math.max(120, targetSeconds * 0.1)
  const withinTolerance = routes.filter(
    (route) => Math.abs(route.durationSeconds - targetSeconds) <= toleranceSeconds,
  )
  const eligible = withinTolerance.length > 0 ? withinTolerance : routes

  const ranked = [...eligible].sort((first, second) => {
    const rank = (route: RouteCandidate) => {
      const durationError = Math.abs(route.durationSeconds - targetSeconds) / targetSeconds
      const preference =
        routeType === 'loop'
          ? loopShapeQuality(route)
          : routeType === 'quiet_streets'
            ? route.quietDetour ? 1 : 0
            : 0

      // When at least one route is within tolerance, the route-type preference
      // can decide between them. Otherwise, duration remains dominant.
      if (routeType === 'loop') {
        return withinTolerance.length > 0
          ? durationError * 0.4 - preference * 1.4
          : durationError * 3 - preference * 0.8
      }
      return withinTolerance.length > 0
        ? durationError * 0.5 - preference
        : durationError * 5 - preference * 0.25
    }
    return rank(first) - rank(second)
  })

  // Best first, skipping near-duplicates so the options genuinely differ.
  const picked: RouteCandidate[] = []
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
  let candidates: RouteCandidate[] = []
  let greenFallback = false
  let parkSearchAvailable = false

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
      if (plan.routeType === 'quiet_streets') {
        candidates = await runCandidates(
          quietCandidateRequests(start, end, targetSeconds),
        )
      } else if (plan.routeType === 'green_space') {
        candidates = await runCandidates(
          ordinaryCandidateRequests(start, end, targetSeconds),
        )
        const ordinary = candidates.map((route) => ({ ...route }))
        const searchArea = parkSearchArea(start, end, targetSeconds)
        let parks: NearbyPark[] = []
        try {
          parks = await searchNearbyParks(searchArea.centre, searchArea.radiusMetres)
          parkSearchAvailable = true
        } catch (error) {
          console.warn('[Google park search skipped]', error)
        }

        const directParks = parks.filter(
          (park) => distanceFromParkToRoutes(park, ordinary) <= 300,
        )
        if (directParks.length > 0) {
          candidates = await addGreenCandidates(start, end, ordinary, directParks)
        } else if (parks.length > 0) {
          const nearestPark = [...parks].sort(
            (first, second) =>
              distanceFromParkToRoutes(first, ordinary) -
              distanceFromParkToRoutes(second, ordinary),
          )[0]!
          const detours = await runCandidates([
            async () =>
              (await computeGoogleRoutes(start, end, [nearestPark.location])).map(
                (route) => ({
                  ...route,
                  parks: [nearestPark],
                  greenMode: 'park-detour' as const,
                }),
              ),
          ])
          candidates = [
            ...ordinary.map((route) => ({
              ...route,
              greenMode: 'no-nearby-park' as const,
            })),
            ...detours,
          ]
          greenFallback = detours.length > 0
        } else if (parkSearchAvailable) {
          candidates = ordinary.map((route) => ({
            ...route,
            greenMode: 'no-nearby-park' as const,
          }))
        }
      }
    }
  }

  let typeNote: string
  switch (plan.routeType) {
    case 'loop':
      typeNote = 'A broad, rounded circuit that returns to the starting point without retracing the same path.'
      break
    case 'out_and_back':
      typeNote = 'It reaches the selected turnaround point and follows the same path back.'
      break
    case 'quiet_streets':
      typeNote = 'Google generated several walking alternatives and this option favours a gentle detour where possible. Street noise and traffic levels cannot be guaranteed.'
      break
    case 'green_space':
      typeNote = parkSearchAvailable
        ? 'Nearby parks and gardens are prioritised where the selected duration allows.'
        : 'Google park information was unavailable, so park use cannot be guaranteed.'
      break
  }

  let best: RouteCandidate[]
  if (plan.routeType === 'green_space' && greenFallback) {
    const detours = candidates.filter((route) => route.greenMode === 'park-detour')
    const withoutPark = candidates.filter((route) => route.greenMode !== 'park-detour')
    best = [
      ...selectBestRoutes(detours, targetSeconds, plan.routeType, 1),
      ...selectBestRoutes(withoutPark, targetSeconds, plan.routeType, 2),
    ]
  } else if (
    plan.routeType === 'green_space' &&
    candidates.some((route) => (route.parks?.length ?? 0) > 0)
  ) {
    const throughParks = candidates.filter((route) => (route.parks?.length ?? 0) > 0)
    const otherRoutes = candidates.filter((route) => (route.parks?.length ?? 0) === 0)
    best = selectBestRoutes(throughParks, targetSeconds, plan.routeType, 3)
    if (best.length < 3 && otherRoutes.length > 0) {
      best.push(
        ...selectBestRoutes(
          otherRoutes,
          targetSeconds,
          plan.routeType,
          3 - best.length,
        ),
      )
    }
  } else {
    best = selectBestRoutes(candidates, targetSeconds, plan.routeType)
  }
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
    let optionTypeNote = typeNote
    if (plan.routeType === 'green_space') {
      const parks = route.parks ?? []
      const parkNames = [...new Set(parks.map((park) => park.name))]
      if (route.greenMode === 'park-detour' && parkNames[0]) {
        optionTypeNote = `No park was found on the direct routes, so this option takes a clearly marked detour through ${parkNames[0]}.`
      } else if (greenFallback) {
        optionTypeNote = 'No park was found on the direct routes; this option avoids the longer park detour.'
      } else if (route.greenMode === 'no-nearby-park') {
        optionTypeNote = 'No park was found within a reasonable detour for this walk.'
      } else if (parkNames.length > 0) {
        optionTypeNote = `This route goes through ${parkNames.join(' and ')} to include as much nearby green space as the selected duration allows.`
      }
    }

    const firstPark = route.parks?.[0]
    return {
      id: `google-${plan.routeType}-route-${index + 1}`,
      name: index === 0 ? routeTypeName(plan.routeType) : `${routeTypeName(plan.routeType)} · option ${index + 1}`,
      description: `${optionTypeNote} ${durationNote}`,
      distanceKm: Number((route.distanceMetres / 1000).toFixed(2)),
      estimatedMinutes,
      path: normalisePath(mapPath),
      mapPath,
      origin: { lat: first[0], lon: first[1] },
      destination: { lat: last[0], lon: last[1] },
      park: firstPark
        ? { name: firstPark.name, lat: firstPark.location[1], lon: firstPark.location[0] }
        : null,
    }
  })
}
