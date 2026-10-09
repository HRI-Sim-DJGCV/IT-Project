import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SURVEY_ITEMS, SURVEY_SCALE } from '@shared/survey'
import { isSurveyComplete, SurveyForm } from './SurveyForm'

describe('SurveyForm', () => {
  it('renders one radio group per survey item with the four scale options', () => {
    render(<SurveyForm value={{}} onChange={() => {}} />)
    for (const item of SURVEY_ITEMS) {
      const group = screen.getByRole('radiogroup', { name: item.statement })
      expect(group).toBeInTheDocument()
      expect(group.querySelectorAll('[role="radio"]')).toHaveLength(SURVEY_SCALE.length)
    }
  })

  it('reports the chosen score for the item that was tapped', async () => {
    const onChange = vi.fn()
    render(<SurveyForm value={{ calm: 2 }} onChange={onChange} />)
    const tense = screen.getByRole('radiogroup', { name: 'I feel tense' })
    await userEvent.click(tense.querySelectorAll('[role="radio"]')[3]!)
    expect(onChange).toHaveBeenCalledWith({ calm: 2, tense: 4 })
  })

  it('marks the current answer as checked', () => {
    render(<SurveyForm value={{ calm: 3 }} onChange={() => {}} />)
    const calm = screen.getByRole('radiogroup', { name: 'I feel calm' })
    const radios = Array.from(calm.querySelectorAll('[role="radio"]'))
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'false', 'true', 'false'])
  })
})

describe('isSurveyComplete', () => {
  it('is true only when every item has an answer', () => {
    expect(isSurveyComplete({})).toBe(false)
    expect(isSurveyComplete({ calm: 1, tense: 1, at_ease: 1 })).toBe(false)
    expect(isSurveyComplete({ calm: 1, tense: 1, at_ease: 1, worried: 1 })).toBe(true)
  })
})
