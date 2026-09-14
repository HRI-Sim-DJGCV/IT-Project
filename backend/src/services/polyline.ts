type Point = [number, number]

/** Decodes Google's encoded polyline into [latitude, longitude] points. */
export function decodePolyline(encoded: string): Point[] {
  const points: Point[] = []
  let index = 0
  let lat = 0
  let lon = 0
  const next = () => {
    let result = 0
    let shift = 0
    let byte: number
    do {
      if (index >= encoded.length) throw new Error('Invalid polyline')
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    return result & 1 ? ~(result >> 1) : result >> 1
  }
  while (index < encoded.length) {
    lat += next()
    lon += next()
    points.push([lat / 1e5, lon / 1e5])
  }
  return points
}

/** Projects lat/lon points into the 0–100 unit square used by the fallback drawing. */
export function normalisePath(coords: Point[]): Point[] {
  if (coords.length === 0) return []
  const avgLat = coords.reduce((s, [lat]) => s + lat, 0) / coords.length
  const lonScale = Math.cos((avgLat * Math.PI) / 180)
  const projected: Point[] = coords.map(([lat, lon]) => [lon * lonScale, lat])
  const xs = projected.map(([x]) => x)
  const ys = projected.map(([, y]) => y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const w = maxX - minX
  const h = maxY - minY
  if (w === 0 && h === 0) return [[50, 50]]
  const scale = Math.min(w === 0 ? Infinity : 84 / w, h === 0 ? Infinity : 84 / h)
  const offX = (100 - w * scale) / 2
  const offY = (100 - h * scale) / 2
  return projected.map(([x, y]) => [
    Math.round((offX + (x - minX) * scale) * 100) / 100,
    Math.round((100 - (offY + (y - minY) * scale)) * 100) / 100,
  ])
}

/** Keeps at most `max` points, evenly sampled, so a stored route stays small. */
export function thinPath(points: Point[], max = 400): Point[] {
  if (points.length <= max) return points
  const step = (points.length - 1) / (max - 1)
  const out: Point[] = []
  for (let i = 0; i < max; i++) out.push(points[Math.round(i * step)] as Point)
  return out
}
