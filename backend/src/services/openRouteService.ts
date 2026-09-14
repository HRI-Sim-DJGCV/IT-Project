import type {
  RouteOption,
  RouteType,
  WalkPlan,
} from '../../../shared/types'
import { config } from '../config'

type LngLat = [longitude: number, latitude: number]

interface GoogleGeocodeResponse {
  status?: string
  error_message?: string
  results?: Array<{
    geometry?: {
      location?: {
        lat?: number
        lng?: number
      }
    }
  }>
}

interface GoogleRoutesResponse {
  routes?: Array<{
    distanceMeters?: number
    duration?: string
    polyline?: {
      encodedPolyline?: string
    }
  }>
  error?: {
    message?: string
  }
}

function routeTypeDescription(routeType: RouteType): string {
  switch (routeType) {
    case 'loop':
      return 'A walking loop that returns to your starting point.'

    case 'out_and_back':
      return 'An out-and-back walking route.'

    case 'quiet_streets':
      return 'A walking route selected for a calmer street experience.'

    case 'green_space':
      return 'A walking route intended to include nearby green space.'
  }
}

/**
 * Converts a typed place or address into coordinates.
 */
async function geocodeLocation(
  location: string,
  near?: LngLat,
): Promise<LngLat> {
  const url = new URL(
    'https://maps.googleapis.com/maps/api/geocode/json',
  )

  url.searchParams.set('address', location)
  url.searchParams.set('components', 'country:AU')
  url.searchParams.set('region', 'au')
  url.searchParams.set('key', config.GOOGLE_MAPS_API_KEY)

  if (near) {
    const [longitude, latitude] = near
    const latitudeDelta = 0.225
    const longitudeDelta = 0.285

    url.searchParams.set(
      'bounds',
      `${latitude - latitudeDelta},${longitude - longitudeDelta}|${latitude + latitudeDelta},${longitude + longitudeDelta}`,
    )
  }

  const response = await fetch(url)

  if (!response.ok) {
    const details = await response.text()

    console.error(
      '[Google geocoding]',
      response.status,
      response.statusText,
      details,
    )

    throw new Error(
      `Google geocoding failed with status ${response.status}.`,
    )
  }

  const data = (await response.json()) as GoogleGeocodeResponse

  if (data.status !== 'OK') {
    console.error(
      '[Google geocoding]',
      data.status,
      data.error_message ?? '',
    )

    if (data.status !== 'ZERO_RESULTS') {
      throw new Error(
        `Google geocoding failed: ${
          data.error_message ??
          data.status ??
          'unknown error'
        }.`,
      )
    }
  }

  const googleLocation =
    data.results?.[0]?.geometry?.location

  const longitude = googleLocation?.lng
  const latitude = googleLocation?.lat

  if (
    typeof longitude !== 'number' ||
    typeof latitude !== 'number' ||
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude)
  ) {
    throw new Error(
      `Could not find "${location}". Please enter a more specific location.`,
    )
  }

  return [longitude, latitude]
}

/**
 * Converts Google's encoded route into Leaflet coordinates.
 */
function decodeGooglePolyline(
  encoded: string,
): Array<[number, number]> {
  const points: Array<[number, number]> = []

  let index = 0
  let latitude = 0
  let longitude = 0

  const decodeValue = (): number => {
    let result = 0
    let shift = 0
    let byte: number

    do {
      if (index >= encoded.length) {
        throw new Error(
          'Google Routes returned an invalid encoded polyline.',
        )
      }

      byte = encoded.charCodeAt(index) - 63
      index += 1

      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)

    return (result & 1) !== 0
      ? ~(result >> 1)
      : result >> 1
  }

  while (index < encoded.length) {
    latitude += decodeValue()
    longitude += decodeValue()

    points.push([
      latitude / 1e5,
      longitude / 1e5,
    ])
  }

  return points
}

/**
 * Generates a walking route with Google Routes API.
 */
export async function generateWalkingRoute(
  plan: WalkPlan,
): Promise<RouteOption> {
  const start: LngLat = plan.startCoordinates
    ? [
        plan.startCoordinates.lon,
        plan.startCoordinates.lat,
      ]
    : await geocodeLocation(plan.startLocation)

  const end: LngLat = plan.endCoordinates
    ? [
        plan.endCoordinates.lon,
        plan.endCoordinates.lat,
      ]
    : plan.endLocation === plan.startLocation
      ? start
      : await geocodeLocation(
          plan.endLocation,
          start,
        )

  const response = await fetch(
    'https://routes.googleapis.com/directions/v2:computeRoutes',
    {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key':
          config.GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask':
          'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline',
      },

      body: JSON.stringify({
        origin: {
          location: {
            latLng: {
              latitude: start[1],
              longitude: start[0],
            },
          },
        },

        destination: {
          location: {
            latLng: {
              latitude: end[1],
              longitude: end[0],
            },
          },
        },

        travelMode: 'WALK',
        computeAlternativeRoutes: false,
        languageCode: 'en-AU',
        units: 'METRIC',
      }),
    },
  )

  if (!response.ok) {
    const details = await response.text()

    console.error(
      '[Google Routes]',
      response.status,
      response.statusText,
      details,
    )

    throw new Error(
      `Google Routes failed with status ${response.status}.`,
    )
  }

  const data =
    (await response.json()) as GoogleRoutesResponse

  const route = data.routes?.[0]

  const encodedPolyline =
    route?.polyline?.encodedPolyline

  if (!encodedPolyline) {
    throw new Error(
      data.error?.message ??
        'Google could not find a walking route for these locations.',
    )
  }

  const mapPath =
    decodeGooglePolyline(encodedPolyline)

  if (mapPath.length < 2) {
    throw new Error(
      'Google returned an empty walking route.',
    )
  }

  const distanceMetres =
    route?.distanceMeters ?? 0

  const parsedDurationSeconds =
    Number.parseFloat(
      route?.duration?.replace(/s$/, '') ?? '',
    )

  const durationSeconds =
    Number.isFinite(parsedDurationSeconds)
      ? parsedDurationSeconds
      : plan.duration * 60

  return {
    id: 'google-walking-route',
    name: 'Google walking route',
    description: routeTypeDescription(
      plan.routeType,
    ),

    distanceKm: Number(
      (distanceMetres / 1000).toFixed(2),
    ),

    estimatedMinutes: Math.max(
      1,
      Math.round(durationSeconds / 60),
    ),

    path: mapPath,
    mapPath,
  }
}