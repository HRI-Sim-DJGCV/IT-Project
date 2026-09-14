import { useEffect, useRef, useState } from 'react'

export interface PlaceSelection {
  name: string
  coordinates: {
    lat: number
    lon: number
  }
}

interface GooglePlaceAutocompleteProps {
  value: string
  placeholder: string
  locationBias?: [latitude: number, longitude: number]
  onInputChange: (value: string) => void
  onPlaceSelect: (place: PlaceSelection) => void
}

let googleMapsPromise: Promise<void> | null = null

function loadGoogleMaps(): Promise<void> {
  if (typeof window.google?.maps?.importLibrary === 'function') {
    return Promise.resolve()
  }

  if (googleMapsPromise) return googleMapsPromise

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

  if (!apiKey) {
    return Promise.reject(
      new Error('VITE_GOOGLE_MAPS_API_KEY is missing from frontend/.env.'),
    )
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    // With loading=async the script's own onload fires before the API is
    // initialised, so readiness must come from the callback parameter.
    const callbackName = '__googleMapsReady'
    const global = window as unknown as Record<string, unknown>
    global[callbackName] = () => {
      delete global[callbackName]
      resolve()
    }
    const script = document.createElement('script')
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}` +
      `&libraries=places&v=weekly&loading=async&callback=${callbackName}`
    script.async = true
    script.onerror = () => reject(new Error('Google Maps could not be loaded.'))
    document.head.appendChild(script)
  })

  return googleMapsPromise
}

export function GooglePlaceAutocomplete({
  value,
  placeholder,
  locationBias,
  onInputChange,
  onPlaceSelect,
}: GooglePlaceAutocompleteProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const autocompleteRef =
    useRef<google.maps.places.PlaceAutocompleteElement | null>(null)
  const onInputChangeRef = useRef(onInputChange)
  const onPlaceSelectRef = useRef(onPlaceSelect)
  const [error, setError] = useState('')
  const biasLatitude = locationBias?.[0]
  const biasLongitude = locationBias?.[1]

  useEffect(() => {
    onInputChangeRef.current = onInputChange
    onPlaceSelectRef.current = onPlaceSelect
  }, [onInputChange, onPlaceSelect])

  useEffect(() => {
    let cancelled = false
    let autocomplete: google.maps.places.PlaceAutocompleteElement | null = null

    const initialise = async () => {
      try {
        await loadGoogleMaps()

        const { PlaceAutocompleteElement } =
          (await google.maps.importLibrary('places')) as google.maps.PlacesLibrary

        if (cancelled || !containerRef.current) return

        autocomplete = new PlaceAutocompleteElement({
          includedRegionCodes: ['au'],
          placeholder,
          requestedLanguage: 'en',
          requestedRegion: 'au',
          value,
        })

        if (
          typeof biasLatitude === 'number' &&
          typeof biasLongitude === 'number'
        ) {
          autocomplete.locationBias = {
            radius: 25_000,
            center: {
              lat: biasLatitude,
              lng: biasLongitude,
            },
          }
        }

        autocomplete.style.width = '100%'
        autocomplete.style.setProperty('--gmpx-font-family-base', 'inherit')

        const handleInput = () => {
          if (autocomplete) {
            onInputChangeRef.current(autocomplete.value)
          }
        }

        const handleSelection = async (rawEvent: Event) => {
          const event =
            rawEvent as google.maps.places.PlacePredictionSelectEvent
          const place = event.placePrediction.toPlace()

          await place.fetchFields({
            fields: ['displayName', 'formattedAddress', 'location'],
          })

          const latitude = place.location?.lat()
          const longitude = place.location?.lng()

          if (
            typeof latitude !== 'number' ||
            typeof longitude !== 'number'
          ) {
            setError('That place did not provide valid coordinates.')
            return
          }

          const name =
            place.formattedAddress ??
            place.displayName ??
            autocomplete?.value ??
            ''

          if (autocomplete) autocomplete.value = name
          setError('')
          onPlaceSelectRef.current({
            name,
            coordinates: {
              lat: latitude,
              lon: longitude,
            },
          })
        }

        const handleGoogleError = () => {
          setError('Google Places could not load suggestions. Check the API key.')
        }

        autocomplete.addEventListener('input', handleInput)
        autocomplete.addEventListener('gmp-select', handleSelection)
        autocomplete.addEventListener('gmp-error', handleGoogleError)
        autocompleteRef.current = autocomplete
        containerRef.current.replaceChildren(autocomplete)

        return () => {
          autocomplete?.removeEventListener('input', handleInput)
          autocomplete?.removeEventListener('gmp-select', handleSelection)
          autocomplete?.removeEventListener('gmp-error', handleGoogleError)
        }
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : 'Google Places could not be loaded.',
        )
      }
    }

    let removeListeners: (() => void) | undefined
    void initialise().then((cleanup) => {
      removeListeners = cleanup
    })

    return () => {
      cancelled = true
      removeListeners?.()
      autocompleteRef.current = null
      containerRef.current?.replaceChildren()
    }
  }, [biasLatitude, biasLongitude, placeholder])

  useEffect(() => {
    if (autocompleteRef.current && autocompleteRef.current.value !== value) {
      autocompleteRef.current.value = value
    }
  }, [value])

  return (
    <div className="flex flex-col gap-1.5">
      <div ref={containerRef} className="w-full" />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
