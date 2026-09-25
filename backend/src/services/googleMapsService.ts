import { config } from '../config'

function mapsKey(): string {
  if (!config.GOOGLE_MAPS_API_KEY) {
    throw new Error(
      'GOOGLE_MAPS_API_KEY is not set. Add it to the repo-root .env (see .env.example) to enable route generation.',
    )
  }
  return config.GOOGLE_MAPS_API_KEY
}

export type LngLat = [longitude: number, latitude: number]

export interface ComputedRoute {
  mapPath: Array<[latitude: number, longitude: number]>
  distanceMetres: number
  durationSeconds: number
  detail?: string
}

export interface NearbyPark {
  name: string
  location: LngLat
}

interface GoogleGeocodeResponse {
  status?: string
  error_message?: string
  results?: Array<{
    geometry?: { location?: { lat?: number; lng?: number } }
  }>
}

interface GoogleRoutesResponse {
  routes?: Array<{
    distanceMeters?: number
    duration?: string
    polyline?: { encodedPolyline?: string }
  }>
  error?: { message?: string }
}

interface GooglePlacesResponse {
  places?: Array<{
    displayName?: { text?: string }
    location?: { latitude?: number; longitude?: number }
  }>
  error?: { message?: string }
}

const GOOGLE_ROUTES_URL =
  'https://routes.googleapis.com/directions/v2:computeRoutes'
const GOOGLE_PLACES_NEARBY_URL =
  'https://places.googleapis.com/v1/places:searchNearby'

export async function searchNearbyParks(
  centre: LngLat,
  radiusMetres: number,
): Promise<NearbyPark[]> {
  const [longitude, latitude] = centre
  const response = await fetch(GOOGLE_PLACES_NEARBY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': mapsKey(),
      'X-Goog-FieldMask': 'places.displayName,places.location',
    },
    body: JSON.stringify({
      includedTypes: [
        'park',
        'city_park',
        'national_park',
        'state_park',
        'garden',
        'botanical_garden',
        'hiking_area',
        'picnic_ground',
      ],
      maxResultCount: 20,
      rankPreference: 'DISTANCE',
      languageCode: 'en-AU',
      regionCode: 'AU',
      locationRestriction: {
        circle: {
          center: { latitude, longitude },
          radius: Math.min(50_000, Math.max(1, radiusMetres)),
        },
      },
    }),
  })

  if (!response.ok) {
    const details = await response.text()
    console.error('[Google Places nearby parks]', response.status, details)
    throw new Error(`Google Places failed with status ${response.status}.`)
  }

  const data = (await response.json()) as GooglePlacesResponse
  if (data.error?.message) throw new Error(data.error.message)

  return (data.places ?? []).flatMap((place) => {
    const placeLatitude = place.location?.latitude
    const placeLongitude = place.location?.longitude
    if (
      typeof placeLatitude !== 'number' ||
      typeof placeLongitude !== 'number' ||
      !Number.isFinite(placeLatitude) ||
      !Number.isFinite(placeLongitude)
    ) {
      return []
    }
    return [{
      name: place.displayName?.text?.trim() || 'a nearby park',
      location: [placeLongitude, placeLatitude] as LngLat,
    }]
  })
}

export async function geocodeLocation(
  location: string,
  near?: LngLat,
): Promise<LngLat> {
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')

  url.searchParams.set('address', location)
  url.searchParams.set('components', 'country:AU')
  url.searchParams.set('region', 'au')
  url.searchParams.set('key', mapsKey())

  if (near) {
    const [longitude, latitude] = near
    url.searchParams.set(
      'bounds',
      `${latitude - 0.225},${longitude - 0.285}|${latitude + 0.225},${longitude + 0.285}`,
    )
  }

  const response = await fetch(url)
  if (!response.ok) {
    const details = await response.text()
    console.error('[Google geocoding]', response.status, details)
    throw new Error(`Google geocoding failed with status ${response.status}.`)
  }

  const data = (await response.json()) as GoogleGeocodeResponse
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(
      `Google geocoding failed: ${data.error_message ?? data.status ?? 'unknown error'}.`,
    )
  }

  const result = data.results?.[0]?.geometry?.location
  if (
    typeof result?.lng !== 'number' ||
    typeof result.lat !== 'number' ||
    !Number.isFinite(result.lng) ||
    !Number.isFinite(result.lat)
  ) {
    throw new Error(
      `Could not find "${location}". Please enter a more specific location.`,
    )
  }

  return [result.lng, result.lat]
}

function decodeGooglePolyline(
  encoded: string,
): Array<[latitude: number, longitude: number]> {
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
        throw new Error('Google Routes returned an invalid encoded polyline.')
      }
      byte = encoded.charCodeAt(index) - 63
      index += 1
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)

    return (result & 1) !== 0 ? ~(result >> 1) : result >> 1
  }

  while (index < encoded.length) {
    latitude += decodeValue()
    longitude += decodeValue()
    points.push([latitude / 1e5, longitude / 1e5])
  }

  return points
}

function googleWaypoint([longitude, latitude]: LngLat, via = false) {
  return {
    location: { latLng: { latitude, longitude } },
    via,
  }
}

export async function computeGoogleRoutes(
  start: LngLat,
  end: LngLat,
  intermediates: LngLat[] = [],
  alternatives = false,
): Promise<ComputedRoute[]> {
  const response = await fetch(GOOGLE_ROUTES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': mapsKey(),
      'X-Goog-FieldMask':
        'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline',
    },
    body: JSON.stringify({
      origin: googleWaypoint(start),
      destination: googleWaypoint(end),
      ...(intermediates.length > 0
        ? { intermediates: intermediates.map((point) => googleWaypoint(point, true)) }
        : {}),
      travelMode: 'WALK',
      computeAlternativeRoutes: alternatives && intermediates.length === 0,
      languageCode: 'en-AU',
      units: 'METRIC',
    }),
  })

  if (!response.ok) {
    const details = await response.text()
    console.error('[Google Routes]', response.status, details)
    throw new Error(`Google Routes failed with status ${response.status}.`)
  }

  const data = (await response.json()) as GoogleRoutesResponse
  const routes: ComputedRoute[] = []

  for (const route of data.routes ?? []) {
    const encoded = route.polyline?.encodedPolyline
    const durationSeconds = Number.parseFloat(
      route.duration?.replace(/s$/, '') ?? '',
    )
    if (!encoded || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      continue
    }

    const mapPath = decodeGooglePolyline(encoded)
    if (mapPath.length >= 2) {
      routes.push({
        mapPath,
        distanceMetres: route.distanceMeters ?? 0,
        durationSeconds,
      })
    }
  }

  if (routes.length === 0) {
    throw new Error(
      data.error?.message ??
        'Google could not find a walking route for these locations.',
    )
  }

  return routes
}
