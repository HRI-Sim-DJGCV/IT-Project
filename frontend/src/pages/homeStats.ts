import { ROUTE_TYPES } from '@shared/survey'
import type { RouteType, WalkRecord } from '../types'

type Walk = Pick<WalkRecord, 'date' | 'actualMinutes' | 'plan'>

export interface WeekSummary {
  /** Monday first. True for each day that has at least one walk. */
  days: boolean[]
  /** 0 (Monday) to 6 (Sunday). */
  todayIndex: number
  walkCount: number
  minutes: number
}

function mondayOf(now: Date): Date {
  const start = new Date(now)
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  start.setHours(0, 0, 0, 0)
  return start
}

/** This calendar week (Monday to Sunday, in the participant's local time). */
export function summariseWeek(walks: Walk[], now = new Date()): WeekSummary {
  const start = mondayOf(now)
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  const days = Array.from({ length: 7 }, () => false)
  let walkCount = 0
  let minutes = 0

  for (const walk of walks) {
    const date = new Date(walk.date)
    if (date < start || date >= end) continue
    const dayIndex = (date.getDay() + 6) % 7
    days[dayIndex] = true
    walkCount += 1
    minutes += walk.actualMinutes
  }
  return { days, todayIndex: (now.getDay() + 6) % 7, walkCount, minutes }
}

export interface RouteSuggestion {
  routeType: RouteType
  reason: string
}

/**
 * Suggests the route type the participant has used least, preferring one they
 * haven't tried, then the one they walked longest ago. Offered as a nudge only.
 */
export function suggestRouteType(walks: Walk[]): RouteSuggestion {
  if (walks.length === 0) return { routeType: 'loop', reason: 'A loop is an easy way to start.' }

  const counts = new Map<RouteType, number>(ROUTE_TYPES.map((type) => [type, 0]))
  const lastWalked = new Map<RouteType, number>(ROUTE_TYPES.map((type) => [type, 0]))
  for (const walk of walks) {
    const type = walk.plan.routeType
    counts.set(type, (counts.get(type) ?? 0) + 1)
    lastWalked.set(type, Math.max(lastWalked.get(type) ?? 0, new Date(walk.date).getTime()))
  }

  const [routeType] = [...ROUTE_TYPES].sort(
    (a, b) =>
      (counts.get(a) ?? 0) - (counts.get(b) ?? 0) ||
      (lastWalked.get(a) ?? 0) - (lastWalked.get(b) ?? 0) ||
      ROUTE_TYPES.indexOf(a) - ROUTE_TYPES.indexOf(b),
  ) as [RouteType]

  return {
    routeType,
    reason: counts.get(routeType) === 0 ? "You haven't tried this one yet." : 'A change of pace from your usual walks.',
  }
}
