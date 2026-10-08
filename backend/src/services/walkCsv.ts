import { walkScores } from '../../../shared/scoring'
import { SURVEY_ITEMS } from '../../../shared/survey'
import type { WalkRecordDoc } from '../models/WalkRecord'

const DEFAULT_HEADERS = [
  'participantId', 'condition', '_id', 'clientId', 'date', 'createdAt',
  'completed', 'actualMinutes', 'surveyVersion', 'preparationId',
  'plan.startLocation', 'plan.endLocation', 'plan.duration', 'plan.routeType',
  'route.id', 'route.name', 'route.description', 'route.distanceKm', 'route.estimatedMinutes',
  'route.path', 'route.mapPath',
  ...SURVEY_ITEMS.map((item) => `preSurvey.${item.key}`),
  ...SURVEY_ITEMS.map((item) => `postSurvey.${item.key}`),
  'scores.pre.calm', 'scores.post.calm', 'scores.delta.calm', 'scores.scoringVersion',
]

/** Objects become named columns; arrays stay intact as JSON cells. */
function flatten(value: unknown, prefix: string, row: Record<string, unknown>) {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const entries = Object.entries(value)
    if (entries.length > 0) {
      for (const [key, item] of entries) flatten(item, prefix ? `${prefix}.${key}` : key, row)
      return
    }
  }
  row[prefix] = value !== null && typeof value === 'object' ? JSON.stringify(value) : value
}

function quoteCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value)
  // Keep user-entered text from being evaluated as a spreadsheet formula.
  if (typeof value === 'string' && /^\s*[=+\-@]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

/** Every stored walk field, plus derived scores; one row per saved walk. */
export function buildDetailedWalkCsv(walks: WalkRecordDoc[]): string {
  const rows = walks.map((walk) => {
    // Normalize MongoDB IDs and dates before flattening their values.
    const rawJson = JSON.stringify(walk)
    const row: Record<string, unknown> = Object.create(null)
    flatten(JSON.parse(rawJson), '', row)
    if (walk.preSurvey) flatten(walkScores(walk.preSurvey, walk.postSurvey ?? null), 'scores', row)
    // Preserves exact types, nulls, and original text alongside readable columns.
    row.walk_record_json = rawJson
    return row
  })
  const headers = new Set(DEFAULT_HEADERS)
  const extraHeaders = new Set(rows.flatMap((row) => Object.keys(row)))
  extraHeaders.delete('walk_record_json')
  for (const header of [...extraHeaders].sort()) headers.add(header)
  headers.add('walk_record_json')
  const columns = [...headers]
  const lines = [columns.map(quoteCell).join(','), ...rows.map((row) => columns.map((key) => quoteCell(row[key])).join(','))]
  // UTF-8 BOM lets Excel recognize Unicode locations and meditation text.
  return '\uFEFF' + lines.join('\r\n') + '\r\n'
}
