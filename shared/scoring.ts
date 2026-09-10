import { SURVEY_ITEMS } from './survey'
import type { SurveyResponse, WalkScores } from './types'

/**
 * The one definition of the derived "calm score". Used by the API for every
 * WalkRecord it returns, by the stats endpoint and by the CSV export, so all
 * three always agree. Scores are computed on read and never stored.
 *
 * scoringVersion 1: sum of the positive items (calm, at_ease) plus the
 * reverse-scored negative items (5 - score for tense, worried). Range 4-16,
 * higher = calmer. Reference for the research protocol: TBD (see spec section 7).
 */
export const SCORING_VERSION = 1

const POSITIVE_ITEMS = new Set(['calm', 'at_ease'])

export function calmScore(survey: SurveyResponse): number {
  return SURVEY_ITEMS.reduce((acc, item) => {
    const v = survey[item.key] ?? 0
    return acc + (POSITIVE_ITEMS.has(item.key) ? v : 5 - v)
  }, 0)
}

export function walkScores(pre: SurveyResponse, post: SurveyResponse | null): WalkScores {
  const preCalm = calmScore(pre)
  const postCalm = post ? calmScore(post) : null
  return {
    scoringVersion: SCORING_VERSION,
    pre: { calm: preCalm },
    post: postCalm === null ? null : { calm: postCalm },
    delta: postCalm === null ? null : { calm: postCalm - preCalm },
  }
}
