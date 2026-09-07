import type { RouteType, SurveyItem, SurveyScore, WalkDuration } from './types'

/**
 * The fixed mood check-in. Kept in code (not the database) per the API spec;
 * bump SURVEY_VERSION if the items ever change so stored walks stay
 * interpretable.
 */
export const SURVEY_VERSION = 1

export const SURVEY_ITEMS: SurveyItem[] = [
  { key: 'calm', statement: 'I feel calm' },
  { key: 'tense', statement: 'I feel tense' },
  { key: 'at_ease', statement: 'I feel at ease' },
  { key: 'worried', statement: 'I feel worried' },
]

export const SURVEY_SCALE: Array<{ value: SurveyScore; label: string }> = [
  { value: 1, label: 'Not at all' },
  { value: 2, label: 'Somewhat' },
  { value: 3, label: 'Moderately' },
  { value: 4, label: 'Very much' },
]

export const DURATIONS: WalkDuration[] = [15, 30, 45]

export const ROUTE_TYPES: RouteType[] = ['loop', 'out_and_back', 'quiet_streets', 'green_space']

export function scaleLabel(score: SurveyScore | undefined | null): string {
  return SURVEY_SCALE.find((s) => s.value === score)?.label ?? '–'
}
