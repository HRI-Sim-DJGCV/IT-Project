// A route point contains two numbers.
// For mapPath they represent [latitude, longitude].
// For drawingPath they represent [x, y].
type RoutePoint = [number, number]

export interface DecodedRoute {
  drawingPath: RoutePoint[]

  mapPath: RoutePoint[]
}


function normalisePath(coordinates: RoutePoint[]): RoutePoint[] {
  if (coordinates.length === 0) return []

  const averageLatitude =
    coordinates.reduce((sum, [latitude]) => sum + latitude, 0) /
    coordinates.length

  const longitudeScale = Math.cos((averageLatitude * Math.PI) / 180)

  // Convert [latitude, longitude] into flat x/y coordinates.
  const projected = coordinates.map(([latitude, longitude]) => [
    longitude * longitudeScale,
    latitude,
  ] satisfies RoutePoint)

  const xValues = projected.map(([x]) => x)
  const yValues = projected.map(([, y]) => y)

  const minimumX = Math.min(...xValues)
  const maximumX = Math.max(...xValues)
  const minimumY = Math.min(...yValues)
  const maximumY = Math.max(...yValues)

  const width = maximumX - minimumX
  const height = maximumY - minimumY

  if (width === 0 && height === 0) return [[50, 50]]

  const scale = Math.min(
    width === 0 ? Number.POSITIVE_INFINITY : 84 / width,
    height === 0 ? Number.POSITIVE_INFINITY : 84 / height,
  )

  const offsetX = (100 - width * scale) / 2
  const offsetY = (100 - height * scale) / 2

  return projected.map(([x, y]) => [
    offsetX + (x - minimumX) * scale,

    100 - (offsetY + (y - minimumY) * scale),
  ])
}

/**
 * Decodes Google’s compressed polyline string into real
 * [latitude, longitude] route points.
 */
function decodeGooglePolyline(encoded: string): RoutePoint[] {
  const coordinates: RoutePoint[] = []
  let index = 0
  let latitude = 0
  let longitude = 0

  const nextDelta = () => {
    let result = 0
    let shift = 0
    let byte: number

    do {
      if (index >= encoded.length) {
        throw new Error('The server returned an invalid route line.')
      }

      byte = encoded.charCodeAt(index) - 63
      index += 1
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)

    return result & 1 ? ~(result >> 1) : result >> 1
  }

  while (index < encoded.length) {
    latitude += nextDelta()
    longitude += nextDelta()

    coordinates.push([latitude / 100000, longitude / 100000])
  }

  return coordinates
}

/**
 * Produces both coordinate formats from one Google polyline:
 * one for Leaflet and one for the existing placeholder/progress display.
 */
export function decodeRoutePath(encoded: string): DecodedRoute {
  const mapPath = decodeGooglePolyline(encoded)

  return {
    mapPath,
    drawingPath: normalisePath(mapPath),
  }
}