import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Tiny wrapper around the browser SpeechSynthesis API.
 * Mobile Safari/Chrome require speech to be triggered by a user gesture at
 * least once, so `unlock()` should be called from the button that starts
 * the walk.
 */
export function useSpeech() {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const [speaking, setSpeaking] = useState(false)
  const [muted, setMuted] = useState(false)
  const mutedRef = useRef(false)

  useEffect(() => {
    mutedRef.current = muted
    if (muted && supported) window.speechSynthesis.cancel()
  }, [muted, supported])

  const unlock = useCallback(() => {
    if (!supported) return
    const u = new SpeechSynthesisUtterance(' ')
    u.volume = 0
    window.speechSynthesis.speak(u)
  }, [supported])

  const speak = useCallback(
    (text: string) => {
      if (!supported || mutedRef.current) return
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.rate = 0.9
      u.pitch = 1
      u.lang = 'en-AU'
      u.onstart = () => setSpeaking(true)
      u.onend = () => setSpeaking(false)
      u.onerror = () => setSpeaking(false)
      window.speechSynthesis.speak(u)
    },
    [supported],
  )

  const stop = useCallback(() => {
    if (!supported) return
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [supported])

  useEffect(() => stop, [stop])

  return { supported, speaking, muted, setMuted, speak, stop, unlock }
}
