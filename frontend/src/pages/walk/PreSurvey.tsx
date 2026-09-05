import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SurveyForm, isSurveyComplete } from '../../components/SurveyForm'
import { Button, Screen } from '../../components/ui'
import { useSession } from '../../context/SessionContext'
import type { SurveyResponse } from '../../types'

export function PreSurvey() {
  const navigate = useNavigate()
  const { draft, updateDraft } = useSession()
  const [value, setValue] = useState<Partial<SurveyResponse>>(draft?.preSurvey ?? {})
  const done = isSurveyComplete(value)

  return (
    <Screen
      title="Before your walk"
      back="/home"
      footer={
        <Button
          disabled={!done}
          onClick={() => {
            if (done) {
              updateDraft({ preSurvey: value })
              navigate('/walk/plan')
            }
          }}
        >
          Walk setup
        </Button>
      }
    >
      <p className="text-sm text-muted">How are you feeling right now? Answer honestly — there are no wrong answers.</p>
      <SurveyForm value={value} onChange={setValue} />
    </Screen>
  )
}
