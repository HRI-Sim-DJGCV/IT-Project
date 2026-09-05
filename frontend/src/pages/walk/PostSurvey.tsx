import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { saveWalk } from '../../api'
import { SurveyForm, isSurveyComplete } from '../../components/SurveyForm'
import { Button, Screen } from '../../components/ui'
import { useSession } from '../../context/SessionContext'
import type { SurveyResponse, WalkRecord } from '../../types'

export function PostSurvey() {
  const navigate = useNavigate()
  const { draft, participant } = useSession()
  const [value, setValue] = useState<Partial<SurveyResponse>>({})
  const [busy, setBusy] = useState(false)
  const done = isSurveyComplete(value)

  async function submit() {
    if (!done || !draft?.plan || !draft.route || !draft.preSurvey || !participant) return
    setBusy(true)
    const record: WalkRecord = {
      id: draft.id,
      participantId: participant.id,
      date: draft.startedAt,
      plan: draft.plan,
      route: draft.route,
      preSurvey: draft.preSurvey,
      postSurvey: value,
      actualMinutes: draft.actualMinutes ?? draft.plan.duration,
      completed: true,
    }
    await saveWalk(record)
    // The Done page clears the draft on mount. Clearing it here would trip
    // the RequireDraft guard on this route and bounce us to /home first.
    navigate('/walk/done', { replace: true, state: record })
  }

  return (
    <Screen
      title="After your walk"
      footer={
        <Button disabled={!done || busy} onClick={submit}>
          {busy ? 'Saving…' : 'Submit'}
        </Button>
      }
    >
      <p className="text-sm text-muted">How are you feeling right now, after your walk?</p>
      <SurveyForm value={value} onChange={setValue} />
    </Screen>
  )
}
