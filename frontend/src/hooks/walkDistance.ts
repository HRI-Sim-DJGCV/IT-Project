export interface Fix {
  lat: number
  lon: number
  /** Horizontal accuracy in metres, as reported by the browser. */
  accuracy: number
  /** Milliseconds since the epoch. */
  time: number
}

/** Fixes less accurate than this are ignored; indoors or under tree cover they wander by tens of metres. */
export const MAX_ACCURACY_M = 30
/** A step shorter than this is GPS jitter, not walking. The anchor stays put so slow real movement still adds up. */
export const MIN_STEP_M = 4
/** Faster than a fast walk or jog means a GPS jump, not the participant. */
export const MAX_SPEED_MS = 4

export function haversineMetres(a: Pick<Fix, 'lat' | 'lon'>, b: Pick<Fix, 'lat' | 'lon'>): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180
  const earthRadius = 6_371_000
  const dLat = radians(b.lat - a.lat)
  const dLon = radians(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * earthRadius * Math.asin(Math.sqrt(h))
}

/**
 * Metres of real walking between the last accepted fix and a new one, or 0 when
 * the new fix should be ignored (too inaccurate, jitter, or an impossible jump).
 * The caller moves its anchor to `next` only when this returns more than 0.
 */
export function walkedMetres(anchor: Fix, next: Fix): number {
  if (next.accuracy > MAX_ACCURACY_M) return 0
  const metres = haversineMetres(anchor, next)
  if (metres < MIN_STEP_M) return 0
  const seconds = Math.max((next.time - anchor.time) / 1000, 0.001)
  if (metres / seconds > MAX_SPEED_MS) return 0
  return metres
}
