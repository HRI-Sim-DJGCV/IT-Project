import { useEffect, useRef, useState } from 'react'
import { type Fix, walkedMetres } from './walkDistance'

/** Without any usable fix after this long, give up on GPS so the walk can follow the timer instead. */
const NO_FIX_TIMEOUT_MS = 20_000
/** The participant counts as moving for this long after each accepted step. */
const MOVING_GRACE_MS = 8_000
/** Standing at the start (putting in headphones, settling in) shouldn't pause the opening of the script straight away. */
const START_GRACE_MS = 15_000

export type WalkTrackingStatus =
  | 'idle' // not started
  | 'waiting' // asked for location, no usable fix yet
  | 'tracking' // fixes are arriving
  | 'unavailable' // denied, unsupported, or no fix in time

/**
 * Distance actually walked, from the phone's location. While `enabled` it
 * watches the position and adds up real steps (jitter and bad fixes are
 * ignored). `moving` is true shortly after each step and goes false when the
 * participant stands still.
 */
export function useWalkDistance(enabled: boolean) {
  const [distanceM, setDistanceM] = useState(0)
  const [status, setStatus] = useState<WalkTrackingStatus>('idle')
  const [moving, setMoving] = useState(false)
  const anchorRef = useRef<Fix | null>(null)
  const lastStepAtRef = useRef(0)
  const supported = typeof navigator !== 'undefined' && 'geolocation' in navigator

  useEffect(() => {
    if (!enabled) return
    if (!supported) return
    // Treated as moving for the first START_GRACE_MS, then only after real steps.
    lastStepAtRef.current = Date.now() + (START_GRACE_MS - MOVING_GRACE_MS)
    let gotFix = false
    const noFixTimer = setTimeout(() => {
      if (!gotFix) setStatus('unavailable')
    }, NO_FIX_TIMEOUT_MS)

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const fix: Fix = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy,
          time: position.timestamp,
        }
        const anchor = anchorRef.current
        if (!anchor) {
          // The first fix only sets the starting point; poor ones are skipped until a good one arrives.
          if (fix.accuracy <= 30) {
            anchorRef.current = fix
            gotFix = true
            setStatus('tracking')
          }
          return
        }
        const metres = walkedMetres(anchor, fix)
        if (metres > 0) {
          anchorRef.current = fix
          lastStepAtRef.current = Date.now()
          setDistanceM((d) => d + metres)
        }
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) setStatus('unavailable')
      },
      { enableHighAccuracy: true, maximumAge: 2_000, timeout: 15_000 },
    )

    const movingTimer = setInterval(() => {
      setMoving(Date.now() - lastStepAtRef.current < MOVING_GRACE_MS)
    }, 1000)

    return () => {
      clearTimeout(noFixTimer)
      clearInterval(movingTimer)
      navigator.geolocation.clearWatch(watchId)
    }
  }, [enabled, supported])

  // Derived, not stored: started-but-no-fix-yet is 'waiting'; no geolocation at all is 'unavailable'.
  const effective: WalkTrackingStatus = !enabled ? 'idle' : !supported ? 'unavailable' : status === 'idle' ? 'waiting' : status
  return { distanceM, status: effective, moving }
}
