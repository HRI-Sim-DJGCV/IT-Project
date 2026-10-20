import { describe, expect, it } from 'vitest'
import type { RouteType } from '../types'
import { suggestRouteType, summariseWeek } from './homeStats'

const walk = (date: string, routeType: RouteType = 'loop', actualMinutes = 20) => ({
  date: new Date(date).toISOString(),
  actualMinutes,
  plan: { routeType } as never,
})

// Wednesday 14 October 2026, local time.
const wednesday = new Date(2026, 9, 14, 12, 0)

describe('summariseWeek', () => {
  it('marks the days walked this week, Monday first, and totals the minutes', () => {
    const summary = summariseWeek(
      [
        walk('2026-10-12T09:00:00'), // Monday
        walk('2026-10-14T08:00:00', 'loop', 30), // Wednesday
        walk('2026-10-14T18:00:00', 'loop', 15), // Wednesday again
      ],
      wednesday,
    )
    expect(summary.days).toEqual([true, false, true, false, false, false, false])
    expect(summary.todayIndex).toBe(2)
    expect(summary.walkCount).toBe(3)
    expect(summary.minutes).toBe(65)
  })

  it('ignores walks from other weeks', () => {
    const summary = summariseWeek([walk('2026-10-11T23:30:00'), walk('2026-10-19T00:30:00')], wednesday)
    expect(summary.walkCount).toBe(0)
    expect(summary.days.every((d) => !d)).toBe(true)
  })

  it('treats Sunday as the last day of the week', () => {
    const sunday = new Date(2026, 9, 18, 10, 0)
    const summary = summariseWeek([walk('2026-10-18T08:00:00'), walk('2026-10-12T08:00:00')], sunday)
    expect(summary.days).toEqual([true, false, false, false, false, false, true])
    expect(summary.todayIndex).toBe(6)
  })
})

describe('suggestRouteType', () => {
  it('suggests a simple loop for someone with no walks', () => {
    expect(suggestRouteType([]).routeType).toBe('loop')
  })

  it('suggests a type they have never tried', () => {
    const suggestion = suggestRouteType([walk('2026-10-01T09:00:00', 'loop'), walk('2026-10-02T09:00:00', 'loop')])
    expect(suggestion.routeType).toBe('out_and_back')
    expect(suggestion.reason).toContain("haven't tried")
  })

  it('suggests the type walked longest ago once all have been tried equally', () => {
    const suggestion = suggestRouteType([
      walk('2026-10-01T09:00:00', 'loop'),
      walk('2026-10-02T09:00:00', 'out_and_back'),
      walk('2026-10-03T09:00:00', 'quiet_streets'),
      walk('2026-10-04T09:00:00', 'green_space'),
    ])
    expect(suggestion.routeType).toBe('loop')
    expect(suggestion.reason).toContain('change of pace')
  })

  it('prefers the least-used type over a more recent one', () => {
    const suggestion = suggestRouteType([
      walk('2026-10-01T09:00:00', 'loop'),
      walk('2026-10-02T09:00:00', 'loop'),
      walk('2026-10-03T09:00:00', 'out_and_back'),
      walk('2026-10-04T09:00:00', 'quiet_streets'),
      walk('2026-10-05T09:00:00', 'green_space'),
      walk('2026-10-06T09:00:00', 'green_space'),
    ])
    expect(suggestion.routeType).toBe('out_and_back')
  })
})
