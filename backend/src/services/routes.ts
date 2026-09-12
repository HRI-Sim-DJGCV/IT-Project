import type { RouteOption, WalkPlan } from '../../../shared/types'
import { aiClient, type AiRouteInfo } from './aiClient'
import { decodePolyline, normalisePath, thinPath } from './polyline'

const MAX_PARK_OPTIONS = 2

function toOption(
  id: string,
  name: string,
  description: string,
  info: AiRouteInfo,
  origin: RouteOption['origin'],
  destination: RouteOption['destination'],
  park: RouteOption['park'],
): RouteOption {
  const mapPath = thinPath(decodePolyline(info.polyline))
  return {
    id,
    name,
    description,
    distanceKm: Math.round(info.distance_m / 100) / 10,
    estimatedMinutes: Math.max(1, Math.ceil(info.duration_s / 60)),
    path: normalisePath(mapPath),
    mapPath,
    origin,
    destination,
    park,
  }
}

/**
 * Real routes from the AI service (Google Routes under the hood). Always a
 * direct route first, then up to two detours through a park that still fit
 * the requested duration, so the compassion section can happen in a park.
 */
export async function generateRouteOptions(plan: WalkPlan): Promise<RouteOption[]> {
  const res = await aiClient.generateRoute({
    startLocation: plan.startLocation,
    startCoordinates: plan.startCoordinates,
    endLocation: plan.endLocation,
    totalSeconds: plan.duration * 60,
    parkPolylines: MAX_PARK_OPTIONS,
  })
  const options: RouteOption[] = [
    toOption(
      'direct',
      'Direct walk',
      `${plan.startLocation} → ${plan.endLocation}`,
      res.baseline,
      res.origin,
      res.destination,
      null,
    ),
  ]
  for (const p of res.parks) {
    if (!p.route || options.length > MAX_PARK_OPTIONS) continue
    options.push(
      toOption(
        `park-${p.park.place_id}`,
        `Via ${p.park.name}`,
        `Detour through ${p.park.name} for the compassion meditation (+${Math.round(p.added_s / 60)} min).`,
        p.route,
        res.origin,
        res.destination,
        { name: p.park.name, lat: p.park.lat, lon: p.park.lon },
      ),
    )
  }
  return options
}
