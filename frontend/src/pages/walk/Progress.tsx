import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getScript } from '../../api'
import { MapPlaceholder } from '../../components/MapPlaceholder'
import { Button, Card, Screen } from '../../components/ui'
import { useSession } from '../../context/SessionContext'
import { useSpeech } from '../../hooks/useSpeech'
import type { ScriptSegment } from '../../types'

function fmt(sec: number) {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function Progress() {
  const navigate = useNavigate()
  const { draft, updateDraft } = useSession()
  const speech = useSpeech()

  const totalSec = (draft?.plan?.duration ?? 15) * 60
  const [script, setScript] = useState<ScriptSegment[]>([])
  const [elapsed, setElapsed] = useState(0)
  const [phase, setPhase] = useState<'ready' | 'running' | 'paused'>('ready')
  const [current, setCurrent] = useState<ScriptSegment | null>(null)
  const spokenRef = useRef<Set<number>>(new Set())

  useEffect(() => {
    if (!draft?.route) {
      navigate('/walk/select', { replace: true })
      return
    }
    getScript(draft.plan?.duration ?? 15).then(setScript)
  }, [draft, navigate])

  // Ticker
  useEffect(() => {
    if (phase !== 'running') return
    const id = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(id)
  }, [phase])

  // Fire script segments as their time arrives
  useEffect(() => {
    if (phase !== 'running') return
    const due = script.filter((s) => s.atSecond <= elapsed && !spokenRef.current.has(s.atSecond))
    if (due.length) {
      const seg = due[due.length - 1]
      due.forEach((s) => spokenRef.current.add(s.atSecond))
      setCurrent(seg)
      speech.speak(seg.text)
    }
    if (elapsed >= totalSec) finish()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, phase, script])

  function start() {
    speech.unlock()
    setPhase('running')
  }

  function togglePause() {
    if (phase === 'running') {
      speech.stop()
      setPhase('paused')
    } else {
      setPhase('running')
    }
  }

  function finish() {
    speech.stop()
    updateDraft({ actualMinutes: Math.max(1, Math.round(elapsed / 60)) })
    navigate('/walk/post-survey', { replace: true })
  }

  const remaining = Math.max(0, totalSec - elapsed)
  const progress = Math.min(elapsed / totalSec, 1)

  return (
    <Screen
      title={phase === 'ready' ? 'Ready to begin' : 'Meditation in progress'}
      right={
        speech.supported ? (
          <button
            type="button"
            onClick={() => speech.setMuted(!speech.muted)}
            aria-label={speech.muted ? 'Unmute' : 'Mute'}
            className="text-sm text-muted"
          >
            {speech.muted ? 'Unmute' : 'Mute'}
          </button>
        ) : null
      }
      footer={
        phase === 'ready' ? (
          <Button onClick={start}>Begin walk</Button>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={togglePause}>
              {phase === 'paused' ? 'Resume' : 'Stop'}
            </Button>
            <Button onClick={finish}>End</Button>
          </div>
        )
      }
    >
      <MapPlaceholder route={draft?.route} progress={phase === 'ready' ? 0 : progress} className="h-56" />

      <div className="text-center">
        <p className="text-4xl font-semibold tabular-nums">{fmt(remaining)}</p>
        <p className="text-sm text-muted">remaining · {draft?.route?.distanceKm} km</p>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-line">
          <div className="h-full bg-primary transition-[width] duration-1000 ease-linear" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>

      <Card className="min-h-28">
        {phase === 'ready' ? (
          <p className="text-sm text-muted">
            Put in your headphones or turn up your volume. The guide will speak to you as you walk. Tap <b>Begin walk</b> when you're ready.
            {!speech.supported ? ' (Speech is not supported on this browser — the script will be shown as text.)' : ''}
          </p>
        ) : current ? (
          <>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
              {phase === 'paused' ? 'Paused' : speech.speaking ? 'Now speaking' : 'Now'} · {current.title}
            </p>
            <p className="text-[15px] leading-relaxed">{current.text}</p>
          </>
        ) : (
          <p className="text-sm text-muted">Starting…</p>
        )}
      </Card>
    </Screen>
  )
}
