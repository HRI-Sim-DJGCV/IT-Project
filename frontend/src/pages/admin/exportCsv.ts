import { SURVEY_ITEMS } from '../../mock/data'
import type { WalkRecord } from '../../types'

/** RFC 4180 quoting: wrap in double quotes and double any inner quotes. */
export function csvQuote(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value)
  return `"${s.replace(/"/g, '""')}"`
}

/**
 * One row per walk with every raw survey answer, matching the shape the
 * backend's `GET /admin/export.csv` will return. Scores are deliberately not
 * included: they are derived, and the backend owns the rule.
 */
export function walksToCsv(walks: Array<WalkRecord & { condition: string }>): string {
  const headers = [
    'participant_id',
    'condition',
    'walk_id',
    'date',
    'planned_minutes',
    'route_type',
    'route_name',
    'distance_km',
    'actual_minutes',
    'completed',
    ...SURVEY_ITEMS.map((i) => `pre_${i.key}`),
    ...SURVEY_ITEMS.map((i) => `post_${i.key}`),
  ]
  const rows = walks.map((w) => [
    w.participantId,
    w.condition,
    w.id,
    w.date,
    w.plan.duration,
    w.plan.routeType,
    w.route.name,
    w.route.distanceKm,
    w.actualMinutes,
    w.completed,
    ...SURVEY_ITEMS.map((i) => w.preSurvey[i.key] ?? ''),
    ...SURVEY_ITEMS.map((i) => w.postSurvey?.[i.key] ?? ''),
  ])
  return [headers, ...rows].map((r) => r.map(csvQuote).join(',')).join('\r\n') + '\r\n'
}

/** Triggers a browser download of `csv` as `filename`. */
export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
