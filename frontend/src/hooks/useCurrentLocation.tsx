// Use the browser location once; fall back to UniMelb if unavailable.

import { useEffect, useState } from 'react'

export type CurrentLocation = [number, number]

const UNIMELB_LOCATION: CurrentLocation = [-37.7963, 144.9614]

export function useCurrentLocation() {
  const [currentLocation, setCurrentLocation] =
    useState<CurrentLocation>(UNIMELB_LOCATION)
  const [usingFallback, setUsingFallback] = useState(true)

  useEffect(() => {
    if (!navigator.geolocation) return

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation([
          position.coords.latitude,
          position.coords.longitude,
        ])
        setUsingFallback(false)
      },
      () => {
        setUsingFallback(true)
      },
      {
        enableHighAccuracy: true,
        maximumAge: 30_000,
        timeout: 10_000,
      },
    )
  }, [])

  return { currentLocation, usingFallback }
}