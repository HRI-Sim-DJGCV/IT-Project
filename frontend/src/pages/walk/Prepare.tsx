import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, getPreparation, prepareWalk } from '../../api'
import { loadPreparationAudio } from '../../api/audioCache'
import { Button, Card, ErrorText, Screen } from '../../components/ui'
import { useSession } from '../../context/SessionContext'
import type { WalkPreparation } from '../../types'

const POLL_MS = 2500

const STATUS_TEXT: Record<WalkPreparation['status'], string> = {
  pending: 'Starting…',
  generating_script: 'Writing your meditation for this walk…',
  generating_audio: 'Recording the guide’s voice…',
  ready: 'Ready',
  failed: 'Something went wrong',
}

/**
 * Between choosing a route and walking: the server writes a meditation script
 * for this exact walk and renders it to audio. The screen polls until it is
 * ready, downloads the audio, then moves on to the walk.
 */
export function Prepare() {
  const navigate = useNavigate()
  const { draft, updateDraft } = useSession()
  const [prep, setPrep] = useState<WalkPreparation | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [download, setDownload] = useState<{ done: number; total: number } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const preparationId = draft?.preparationId
  const startedRef = useRef(false)

  // Start (or resume) a preparation for the chosen route.
  useEffect(() => {
    if (!draft?.plan || !draft.route) {
      navigate('/walk/select', { replace: true })
      return
    }
    if (preparationId || startedRef.current) return
    startedRef.current = true
    prepareWalk(draft.plan, draft.route)
      .then((p) => {
        setPrep(p)
        updateDraft({ preparationId: p.id })
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not start preparing the walk.'))
      .finally(() => {
        startedRef.current = false
      })
  }, [draft?.plan, draft?.route, preparationId, navigate, updateDraft, attempt])

  // Poll until ready or failed, then fetch the audio and go.
  useEffect(() => {
    if (!preparationId) return
    let cancelled = false
    let timer: number | undefined

    const tick = async () => {
      try {
        const p = await getPreparation(preparationId)
        if (cancelled) return
        setPrep(p)
        if (p.status === 'ready' && p.script) {
          updateDraft({ script: p.script })
          await loadPreparationAudio(preparationId, p.script.segments, (done, total) => {
            if (!cancelled) setDownload({ done, total })
          })
          if (!cancelled) navigate('/walk/progress', { replace: true })
          return
        }
        if (p.status === 'failed') {
          setError(p.error ?? 'The meditation could not be generated.')
          return
        }
        timer = window.setTimeout(tick, POLL_MS)
      } catch (e: unknown) {
        if (cancelled) return
        // A preparation that no longer exists (server restarted, audio purged) is treated as failed.
        setError(e instanceof ApiError && e.status === 404 ? 'This preparation expired. Please try again.' : e instanceof Error ? e.message : 'Lost contact with the server.')
      }
    }
    void tick()
    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
    }
  }, [preparationId, navigate, updateDraft])

  function retry() {
    setError(null)
    setPrep(null)
    setDownload(null)
    updateDraft({ preparationId: undefined, script: undefined })
    setAttempt((a) => a + 1)
  }

  const status = prep?.status ?? 'pending'
  const progress = download ?? (status === 'generating_audio' ? prep?.progress : null)
  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : null

  return (
    <Screen
      title="Preparing your walk"
      back="/walk/select"
      footer={
        error ? (
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={() => navigate('/walk/select')}>
              Change route
            </Button>
            <Button onClick={retry}>Try again</Button>
          </div>
        ) : null
      }
    >
      <Card className="flex flex-col gap-3">
        {error ? (
          <ErrorText>{error}</ErrorText>
        ) : (
          <>
            <p className="font-semibold">{download ? 'Downloading audio…' : STATUS_TEXT[status]}</p>
            <p className="text-sm text-muted">
              Each walk gets its own meditation, written for your route, the weather and the time you have. This usually
              takes a few minutes. Keep this screen open.
            </p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
              <div
                className={`h-full bg-primary transition-[width] duration-700 ease-out ${pct === null ? 'animate-pulse' : ''}`}
                style={{ width: `${pct ?? (status === 'generating_script' ? 15 : 5)}%` }}
              />
            </div>
            {progress && progress.total > 0 ? (
              <p className="text-xs text-muted">
                {progress.done} / {progress.total} segments
              </p>
            ) : null}
          </>
        )}
      </Card>
      {draft?.route ? (
        <p className="text-center text-xs text-muted">
          {draft.route.name} · {draft.route.distanceKm} km · {draft.plan?.duration} min
        </p>
      ) : null}
    </Screen>
  )
}
