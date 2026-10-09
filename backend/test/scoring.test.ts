import { describe, expect, it } from 'vitest'
import { calmScore, SCORING_VERSION, walkScores } from '../../shared/scoring'
import { SURVEY_ITEMS, scaleLabel } from '../../shared/survey'
import type { SurveyResponse } from '../../shared/types'

const calmest: SurveyResponse = { calm: 4, at_ease: 4, tense: 1, worried: 1 }
const tensest: SurveyResponse = { calm: 1, at_ease: 1, tense: 4, worried: 4 }

describe('calmScore', () => {
  it('ranges from 4 (most tense) to 16 (calmest)', () => {
    expect(calmScore(tensest)).toBe(4)
    expect(calmScore(calmest)).toBe(16)
  })

  it('reverse-scores the negative items', () => {
    // Only "tense" changes: 1 -> 4 lowers the score by 3.
    expect(calmScore({ ...calmest, tense: 4 })).toBe(13)
  })

  it('treats a missing item as 0', () => {
    // calm 4 + at_ease 4 + (5-0) + (5-0)
    expect(calmScore({ calm: 4, at_ease: 4 })).toBe(18)
  })

  it('covers every survey item exactly once', () => {
    const middle = Object.fromEntries(SURVEY_ITEMS.map((i) => [i.key, 2])) as SurveyResponse
    // 2 positive items at 2 + 2 negative items at (5-2)
    expect(calmScore(middle)).toBe(2 + 2 + 3 + 3)
  })
})

describe('walkScores', () => {
  it('returns the delta when the post survey exists', () => {
    expect(walkScores(tensest, calmest)).toEqual({
      scoringVersion: SCORING_VERSION,
      pre: { calm: 4 },
      post: { calm: 16 },
      delta: { calm: 12 },
    })
  })

  it('leaves post and delta null when the walk was not completed', () => {
    expect(walkScores(calmest, null)).toEqual({
      scoringVersion: SCORING_VERSION,
      pre: { calm: 16 },
      post: null,
      delta: null,
    })
  })
})

describe('scaleLabel', () => {
  it('maps scores to their label and unknown values to a dash', () => {
    expect(scaleLabel(1)).toBe('Not at all')
    expect(scaleLabel(4)).toBe('Very much')
    expect(scaleLabel(undefined)).toBe('–')
  })
})
