import { useCallback, useEffect, useRef, useState } from 'react'
import type { ScriptSegment } from '../types'

/**
 * Plays the pre-generated audio for script segments through one <audio>
 * element. Segments are queued so they never overlap: if the next one comes
 * due while the guide is still speaking, it starts as soon as the current clip
 * ends. Mobile browsers only let audio start from a user gesture, so `start()`
 * must be called from the button that begins the walk.
 */
export function useScriptAudio(urls: Map<number, string> | null) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const queueRef = useRef<ScriptSegment[]>([])
  const [current, setCurrent] = useState<ScriptSegment | null>(null)
  const [speaking, setSpeaking] = useState(false)
  const [muted, setMutedState] = useState(false)
  const pausedRef = useRef(false)

  const playNext = useCallback(() => {
    // Named so it can recurse past segments that have no audio without capturing the outer binding.
    const step = (): void => {
      const audio = audioRef.current
      if (!audio || pausedRef.current) return
      const next = queueRef.current.shift()
      if (!next) {
        setSpeaking(false)
        return
      }
      setCurrent(next)
      const url = next.audioIndex !== null ? urls?.get(next.audioIndex) : undefined
      if (!url) {
        // No audio for this segment: show the text and move on.
        setSpeaking(false)
        step()
        return
      }
      audio.src = url
      audio.play().then(
        () => setSpeaking(true),
        () => {
          setSpeaking(false)
          step()
        },
      )
    }
    step()
  }, [urls])

  useEffect(() => {
    const audio = new Audio()
    audio.preload = 'auto'
    audioRef.current = audio
    return () => {
      audio.pause()
      audio.src = ''
      audioRef.current = null
    }
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onEnded = () => {
      setSpeaking(false)
      playNext()
    }
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onEnded)
    return () => {
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onEnded)
    }
  }, [playNext])

  /** Queue segments that have come due. Starts playback if nothing is playing. */
  const enqueue = useCallback(
    (segments: ScriptSegment[]) => {
      if (segments.length === 0) return
      queueRef.current.push(...segments)
      if (!speaking && !pausedRef.current) playNext()
    },
    [playNext, speaking],
  )

  /** Call from the Begin button: unlocks audio on mobile and plays anything already queued. */
  const start = useCallback(
    (first: ScriptSegment[]) => {
      pausedRef.current = false
      queueRef.current.push(...first)
      playNext()
    },
    [playNext],
  )

  const pause = useCallback(() => {
    pausedRef.current = true
    audioRef.current?.pause()
    setSpeaking(false)
  }, [])

  const resume = useCallback(() => {
    pausedRef.current = false
    const audio = audioRef.current
    if (audio && audio.src && !audio.ended && audio.currentTime > 0) {
      audio.play().then(
        () => setSpeaking(true),
        () => playNext(),
      )
    } else {
      playNext()
    }
  }, [playNext])

  const stop = useCallback(() => {
    pausedRef.current = true
    queueRef.current = []
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
    }
    setSpeaking(false)
  }, [])

  const setMuted = useCallback((m: boolean) => {
    setMutedState(m)
    if (audioRef.current) audioRef.current.muted = m
  }, [])

  return { current, speaking, muted, setMuted, start, enqueue, pause, resume, stop }
}
