import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCachedAudio, loadPreparationAudio } from '../../api/audioCache'
import { RouteMap } from '../../components/RouteMap'
import { Button, Card, ErrorText, Screen } from '../../components/ui'
import { useSession } from '../../context/SessionContext'
import { useScriptAudio } from '../../hooks/useScriptAudio'
import { useWalkDistance } from '../../hooks/useWalkDistance'

function fmt(sec: number) {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function Progress() {
  const navigate = useNavigate()
  const { draft, updateDraft } = useSession()
  const script = draft?.script
  const segments = useMemo(() => script?.segments ?? [], [script])
  const preparationId = draft?.preparationId

  const [urls, setUrls] = useState<Map<number, string> | null>(() => (preparationId ? getCachedAudio(preparationId) : null))
  const [audioError, setAudioError] = useState<string | null>(null)
  const audio = useScriptAudio(urls)

  const totalSec = (draft?.plan?.duration ?? 15) * 60
  // Seconds of wall-clock time spent walking; recorded as the walk's real duration.
  const [activeSec, setActiveSec] = useState(0)
  const [phase, setPhase] = useState<'ready' | 'running' | 'paused'>('ready')
  const firedRef = useRef<Set<number>>(new Set())
  const autoPausedRef = useRef(false)

  // The guide follows the participant's feet, not the clock: progress is distance walked.
  // If location is unavailable (denied, desktop, no signal) it falls back to the timer.
  const routeMetres = (draft?.route?.distanceKm ?? 0) * 1000
  const tracking = useWalkDistance(phase !== 'ready')
  const followGps = tracking.status !== 'unavailable' && routeMetres > 0
  const elapsed = followGps ? Math.min(totalSec, (tracking.distanceM / routeMetres) * totalSec) : activeSec
  // Standing still: hold the guide until the participant moves again. Not held while still finding the location.
  const holding = phase === 'running' && followGps && tracking.status === 'tracking' && !tracking.moving

  // Guard: the walk needs a route and a generated script.
  useEffect(() => {
    if (!draft?.route) navigate('/walk/select', { replace: true })
    else if (!draft.script || !preparationId) navigate('/walk/prepare', { replace: true })
  }, [draft, preparationId, navigate])

  // After a reload the in-memory audio is gone: fetch it again before allowing the walk to begin.
  useEffect(() => {
    if (urls || !preparationId || segments.length === 0) return
    let cancelled = false
    loadPreparationAudio(preparationId, segments)
      .then((u) => {
        if (!cancelled) setUrls(u)
      })
      .catch((e: unknown) => {
        if (!cancelled) setAudioError(e instanceof Error ? e.message : 'Could not load the audio.')
      })
    return () => {
      cancelled = true
    }
  }, [urls, preparationId, segments])

  // Ticker
  useEffect(() => {
    if (phase !== 'running') return
    const id = setInterval(() => setActiveSec((e) => e + 1), 1000)
    return () => clearInterval(id)
  }, [phase])

  // Queue script segments as their time arrives
  useEffect(() => {
    if (phase !== 'running') return
    const due = segments.filter((s) => s.atSecond <= elapsed && !firedRef.current.has(s.atSecond))
    if (due.length) {
      due.forEach((s) => firedRef.current.add(s.atSecond))
      audio.enqueue(due)
    }
    if (elapsed >= totalSec) finish()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, phase, segments])

  // Pause the audio while the participant is stationary; resume when they walk on.
  // Their own Stop/Resume button is separate and is never overridden here.
  useEffect(() => {
    if (phase !== 'running') return
    if (holding && !autoPausedRef.current) {
      autoPausedRef.current = true
      audio.pause()
    } else if (!holding && autoPausedRef.current) {
      autoPausedRef.current = false
      audio.resume()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holding, phase])

  function start() {
    // The first segments are due at 0: play them inside this click so mobile browsers allow audio.
    const first = segments.filter((s) => s.atSecond <= 0)
    first.forEach((s) => firedRef.current.add(s.atSecond))
    audio.start(first)
    setPhase('running')
  }

  function togglePause() {
    autoPausedRef.current = false
    if (phase === 'running') {
      audio.pause()
      setPhase('paused')
    } else {
      audio.resume()
      setPhase('running')
    }
  }

  function finish() {
    audio.stop()
    updateDraft({ actualMinutes: Math.max(1, Math.round(activeSec / 60)) })
    navigate('/walk/post-survey', { replace: true })
  }

  const remaining = Math.max(0, totalSec - elapsed)
  const progress = Math.min(elapsed / totalSec, 1)
  const canStart = urls !== null && !audioError

  return (
    <Screen
      title={phase === 'ready' ? 'Ready to begin' : 'Meditation in progress'}
      right={
        <button type="button" onClick={() => audio.setMuted(!audio.muted)} aria-label={audio.muted ? 'Unmute' : 'Mute'} className="text-sm text-muted">
          {audio.muted ? 'Unmute' : 'Mute'}
        </button>
      }
      footer={
        phase === 'ready' ? (
          <Button onClick={start} disabled={!canStart}>
            {canStart ? 'Begin walk' : audioError ? 'Audio unavailable' : 'Loading audio…'}
          </Button>
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
      <RouteMap route={draft?.route} progress={phase === 'ready' ? 0 : progress} className="h-56" />

      <div className="text-center">
        <p className="text-4xl font-semibold tabular-nums">{fmt(remaining)}</p>
        <p className="text-sm text-muted">remaining · {draft?.route?.distanceKm} km</p>
        {phase !== 'ready' && tracking.status === 'unavailable' ? (
          <p className="mt-1 text-xs text-muted">Location isn't available, so your guide is following the timer.</p>
        ) : null}
        {phase === 'running' && followGps && tracking.status === 'waiting' ? (
          <p className="mt-1 text-xs text-muted">Finding your location…</p>
        ) : null}
        {holding && tracking.status === 'tracking' ? (
          <p className="mt-1 text-xs text-muted">Your guide will continue when you start walking again.</p>
        ) : null}
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-line">
          <div className="h-full bg-primary transition-[width] duration-1000 ease-linear" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>

      <Card className="min-h-28">
        {audioError ? (
          <>
            <ErrorText>{audioError}</ErrorText>
            <Button variant="secondary" className="mt-3" onClick={() => navigate('/walk/prepare', { replace: true })}>
              Prepare again
            </Button>
          </>
        ) : phase === 'ready' ? (
          <p className="text-sm text-muted">
            Put in your headphones or turn up your volume. Your guide will speak to you as you walk. Tap <b>Begin walk</b>{' '}
            when you're ready.
          </p>
        ) : audio.current ? (
          <>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
              {phase === 'paused' ? 'Paused' : audio.speaking ? 'Now speaking' : 'Now'} · {audio.current.title}
            </p>
            <p className="text-[15px] leading-relaxed">{audio.current.text}</p>
          </>
        ) : (
          <p className="text-sm text-muted">Starting…</p>
        )}
      </Card>
    </Screen>
  )
}
