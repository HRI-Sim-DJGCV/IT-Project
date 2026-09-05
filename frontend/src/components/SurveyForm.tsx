import { SURVEY_ITEMS, SURVEY_SCALE } from '../mock/data'
import type { SurveyResponse, SurveyScore } from '../types'
import { Card } from './ui'

interface Props {
  value: Partial<SurveyResponse>
  onChange: (next: Partial<SurveyResponse>) => void
}

export function isSurveyComplete(v: Partial<SurveyResponse>): v is SurveyResponse {
  return SURVEY_ITEMS.every((i) => v[i.key] !== undefined)
}

export function SurveyForm({ value, onChange }: Props) {
  return (
    <div className="flex flex-col gap-3">
      {SURVEY_ITEMS.map((item) => (
        <Card key={item.key}>
          <p className="mb-3 font-medium">{item.statement}</p>
          <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label={item.statement}>
            {SURVEY_SCALE.map((s) => {
              const selected = value[item.key] === s.value
              return (
                <button
                  key={s.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onChange({ ...value, [item.key]: s.value as SurveyScore })}
                  className={`flex h-14 flex-col items-center justify-center whitespace-nowrap rounded-xl border px-0 text-[11px] leading-tight transition active:scale-[0.97] ${
                    selected ? 'border-primary bg-primary text-white' : 'border-line bg-surface text-ink'
                  }`}
                >
                  <span className="text-base font-semibold">{s.value}</span>
                  <span>{s.label}</span>
                </button>
              )
            })}
          </div>
        </Card>
      ))}
    </div>
  )
}
