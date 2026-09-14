import { config } from '../config'
import type { ComputedRoute, LngLat } from './googleMapsService'

type Tags = Record<string, string | undefined>

interface OverpassElement {
  type: string
  tags?: Tags
  geometry?: Array<{ lat: number; lon: number }>
}

interface OverpassResponse {
  elements?: OverpassElement[]
}

interface MapFeature {
  tags: Tags
  geometry: LngLat[]
}

export interface RouteEnvironmentScore {
  quietScore: number
  greenScore: number
}

export interface RouteEnvironment {
  score(route: ComputedRoute): RouteEnvironmentScore
  greenWaypoints(limit?: number): LngLat[]
}

const QUIET_HIGHWAYS = new Set([
  'residential',
  'living_street',
  'service',
  'pedestrian',
  'footway',
  'path',
  'track',
  'cycleway',
])
const MAJOR_HIGHWAYS = new Set([
  'motorway',
  'motorway_link',
  'trunk',
  'trunk_link',
  'primary',
  'primary_link',
  'secondary',
  'secondary_link',
])
const GREEN_HIGHWAYS = new Set([
  'footway',
  'path',
  'track',
  'bridleway',
  'cycleway',
])

function routeBounds(routes: ComputedRoute[]): [number, number, number, number] {
  const points = routes.flatMap((route) => route.mapPath)
  const latitudes = points.map(([latitude]) => latitude)
  const longitudes = points.map(([, longitude]) => longitude)
  const padding = 0.004

  return [
    Math.min(...latitudes) - padding,
    Math.min(...longitudes) - padding,
    Math.max(...latitudes) + padding,
    Math.max(...longitudes) + padding,
  ]
}

function haversineMetres(first: LngLat, second: LngLat): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180
  const earthRadius = 6_371_000
  const latitudeDelta = radians(second[1] - first[1])
  const longitudeDelta = radians(second[0] - first[0])
  const firstLatitude = radians(first[1])
  const secondLatitude = radians(second[1])
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2
  return 2 * earthRadius * Math.asin(Math.sqrt(value))
}

function nearestFeature(
  point: LngLat,
  features: MapFeature[],
  maximumDistance: number,
): MapFeature | undefined {
  let nearest: MapFeature | undefined
  let nearestDistance = maximumDistance

  for (const feature of features) {
    // Checking every third point keeps scoring fast without losing useful detail.
    for (let index = 0; index < feature.geometry.length; index += 3) {
      const distance = haversineMetres(point, feature.geometry[index])
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearest = feature
      }
    }
  }

  return nearest
}

function pointInPolygon(point: LngLat, polygon: LngLat[]): boolean {
  let inside = false
  const [longitude, latitude] = point

  for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current++) {
    const [currentLongitude, currentLatitude] = polygon[current]
    const [previousLongitude, previousLatitude] = polygon[previous]
    const crosses =
      currentLatitude > latitude !== previousLatitude > latitude &&
      longitude <
        ((previousLongitude - currentLongitude) *
          (latitude - currentLatitude)) /
          (previousLatitude - currentLatitude || Number.EPSILON) +
          currentLongitude
    if (crosses) inside = !inside
  }

  return inside
}

function sampleRoute(route: ComputedRoute): LngLat[] {
  const points = route.mapPath
  const step = Math.max(1, Math.floor(points.length / 80))
  const samples: LngLat[] = []

  for (let index = 0; index < points.length; index += step) {
    const [latitude, longitude] = points[index]
    samples.push([longitude, latitude])
  }

  return samples
}

function centreOfGeometry(geometry: LngLat[]): LngLat {
  return [
    geometry.reduce((sum, point) => sum + point[0], 0) / geometry.length,
    geometry.reduce((sum, point) => sum + point[1], 0) / geometry.length,
  ]
}

export async function loadRouteEnvironment(
  routes: ComputedRoute[],
): Promise<RouteEnvironment> {
  const [south, west, north, east] = routeBounds(routes)
  const boundingBox = `${south},${west},${north},${east}`
  const query = `[out:json][timeout:20];(
    way["highway"](${boundingBox});
    way["leisure"="park"](${boundingBox});
    way["leisure"="nature_reserve"](${boundingBox});
    way["landuse"~"forest|grass|recreation_ground"](${boundingBox});
    way["natural"~"wood|scrub"](${boundingBox});
  );out tags geom;`

  const response = await fetch(config.OVERPASS_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'User-Agent': 'walkingapp/1.0',
    },
    body: new URLSearchParams({ data: query }),
  })

  if (!response.ok) {
    const details = await response.text()
    console.warn('[OpenStreetMap scoring unavailable]', response.status, details)
    throw new Error('OpenStreetMap route information is temporarily unavailable.')
  }

  const data = (await response.json()) as OverpassResponse
  const features: MapFeature[] = (data.elements ?? [])
    .filter((element) => element.type === 'way' && (element.geometry?.length ?? 0) >= 2)
    .map((element) => ({
      tags: element.tags ?? {},
      geometry: element.geometry!.map(({ lat, lon }) => [lon, lat]),
    }))

  const roads = features.filter((feature) => feature.tags.highway)
  const greenPaths = roads.filter((feature) =>
    GREEN_HIGHWAYS.has(feature.tags.highway ?? ''),
  )
  const greenAreas = features.filter(
    (feature) =>
      Boolean(feature.tags.leisure || feature.tags.landuse || feature.tags.natural) &&
      feature.geometry.length >= 4,
  )

  return {
    score(route) {
      const samples = sampleRoute(route)
      let quietPoints = 0
      let greenPoints = 0

      for (const point of samples) {
        const road = nearestFeature(point, roads, 35)
        const highway = road?.tags.highway ?? ''
        if (QUIET_HIGHWAYS.has(highway)) quietPoints += 1
        if (MAJOR_HIGHWAYS.has(highway)) quietPoints -= 2

        if (nearestFeature(point, greenPaths, 30)) greenPoints += 1
        if (greenAreas.some((area) => pointInPolygon(point, area.geometry))) {
          greenPoints += 2
        }
      }

      const divisor = Math.max(1, samples.length)
      return {
        quietScore: quietPoints / divisor,
        greenScore: greenPoints / divisor,
      }
    },

    greenWaypoints(limit = 8) {
      const candidates = [
        ...greenAreas.map((feature) => centreOfGeometry(feature.geometry)),
        ...greenPaths.map((feature) =>
          feature.geometry[Math.floor(feature.geometry.length / 2)],
        ),
      ]
      return candidates.slice(0, limit)
    },
  }
}
