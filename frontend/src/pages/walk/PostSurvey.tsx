import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { saveWalk } from '../../api'
import { releasePreparationAudio } from '../../api/audioCache'
import { SurveyForm, isSurveyComplete } from '../../components/SurveyForm'
import { Button, ErrorText, Screen } from '../../components/ui'
import { useSession } from '../../context/SessionContext'
import type { SurveyResponse } from '../../types'

export function PostSurvey() {
  const navigate = useNavigate()
  const { draft } = useSession()
  const [value, setValue] = useState<Partial<SurveyResponse>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const done = isSurveyComplete(value)

  async function submit() {
    if (!done || !draft?.plan || !draft.route || !draft.preSurvey || !draft.preparationId) return
    setBusy(true)
    setError(null)
    try {
      const record = await saveWalk({
        clientId: draft.id,
        date: draft.startedAt,
        plan: draft.plan,
        route: draft.route,
        preSurvey: draft.preSurvey,
        postSurvey: value,
        actualMinutes: draft.actualMinutes ?? draft.plan.duration,
        preparationId: draft.preparationId,
      })
      releasePreparationAudio(draft.preparationId)
      // The Done page clears the draft on mount. Clearing it here would trip
      // the RequireDraft guard on this route and bounce us to /home first.
      navigate('/walk/done', { replace: true, state: record })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your walk. Please try again.')
    } finally {
      setBusy(false)
    }
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
      <ErrorText>{error}</ErrorText>
    </Screen>
  )
}
