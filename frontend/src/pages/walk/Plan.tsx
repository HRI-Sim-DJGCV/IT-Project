import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { GooglePlaceAutocomplete } from '../../components/GooglePlaceAutocomplete'
import { RouteMap } from '../../components/RouteMap'
import { Button, Chips, Field, Screen } from '../../components/ui'
import { useSession } from '../../context/SessionContext'
import { useCurrentLocation } from '../../hooks/useCurrentLocation'
import { DURATIONS, ROUTE_TYPES } from '../../mock/data'
import type { RouteType, WalkDuration } from '../../types'

type StartMode = 'address' | 'current'
type Coordinates = { lat: number; lon: number }

export function Plan() {
  const navigate = useNavigate()
  const { draft, updateDraft } = useSession()
  const { currentLocation, usingFallback } = useCurrentLocation()

  const [startMode, setStartMode] = useState<StartMode>('address')
  const [start, setStart] = useState(draft?.plan?.startLocation ?? '')
  const [startCoordinates, setStartCoordinates] = useState<
    Coordinates | undefined
  >(draft?.plan?.startCoordinates)
  const [end, setEnd] = useState(draft?.plan?.endLocation ?? '')
  const [endCoordinates, setEndCoordinates] = useState<
    Coordinates | undefined
  >(draft?.plan?.endCoordinates)
  const [sameAsStart, setSameAsStart] = useState(
    !draft?.plan || draft.plan.endLocation === draft.plan.startLocation,
  )
  const [duration, setDuration] = useState<WalkDuration | null>(
    draft?.plan?.duration ?? null,
  )
  const [routeType, setRouteType] = useState<RouteType | null>(
    draft?.plan?.routeType ?? null,
  )

  const currentCoordinates: Coordinates = {
    lat: currentLocation[0],
    lon: currentLocation[1],
  }
  const selectedStartCoordinates =
    startMode === 'current' ? currentCoordinates : startCoordinates
  const startLocation =
    startMode === 'current' ? 'Current location' : start.trim()
  const endLocation = sameAsStart ? startLocation : end.trim()
  const selectedEndCoordinates = sameAsStart
    ? selectedStartCoordinates
    : endCoordinates

  const valid = Boolean(
    (startMode === 'current' ? !usingFallback : startCoordinates) &&
      (sameAsStart || endCoordinates) &&
      startLocation &&
      endLocation &&
      duration &&
      routeType,
  )

  const autocompleteBias = usingFallback ? undefined : currentLocation

  return (
    <Screen
      title="Plan your walk"
      back="/walk/pre-survey"
      footer={
        <Button
          disabled={!valid}
          onClick={() => {
            if (duration && routeType && selectedStartCoordinates) {
              updateDraft({
                plan: {
                  startLocation,
                  startCoordinates: selectedStartCoordinates,
                  endLocation,
                  endCoordinates: selectedEndCoordinates,
                  duration,
                  routeType,
                },
                route: undefined,
              })

              navigate('/walk/select')
            }
          }}
        >
          Generate route
        </Button>
      }
    >
      <div className="flex flex-col gap-1.5">
        <RouteMap
          currentLocation={currentLocation}
          showCurrentLocationMarker={!usingFallback}
          className="h-40"
        />

        <p className="text-xs text-muted">
          {usingFallback
            ? 'Showing University of Melbourne because your location is unavailable.'
            : 'Showing your current location.'}
        </p>
      </div>

      <Field label="Start">
        <select
          value={startMode}
          onChange={(event) => {
            const mode = event.target.value as StartMode
            setStartMode(mode)

            if (mode === 'current') {
              setSameAsStart(false)
            }
          }}
          className="w-full rounded-xl border border-line bg-card px-4 py-3"
        >
          <option value="address">Enter an address</option>
          <option value="current" disabled={usingFallback}>
            {usingFallback
              ? 'Current location unavailable'
              : 'Use my current location'}
          </option>
        </select>
      </Field>

      {startMode === 'address' ? (
        <GooglePlaceAutocomplete
          value={start}
          placeholder="Search for a starting place"
          locationBias={autocompleteBias}
          onInputChange={(value) => {
            setStart(value)
            setStartCoordinates(undefined)
          }}
          onPlaceSelect={(place) => {
            setStart(place.name)
            setStartCoordinates(place.coordinates)
          }}
        />
      ) : (
        <p className="text-sm text-muted">
          Your current coordinates will be used as the starting point.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={sameAsStart}
            onChange={(event) => setSameAsStart(event.target.checked)}
            className="h-5 w-5 accent-primary"
          />
          End where I started
        </label>

        {!sameAsStart ? (
          <Field label="End">
            <GooglePlaceAutocomplete
              value={end}
              placeholder="Search for a destination"
              locationBias={autocompleteBias}
              onInputChange={(value) => {
                setEnd(value)
                setEndCoordinates(undefined)
              }}
              onPlaceSelect={(place) => {
                setEnd(place.name)
                setEndCoordinates(place.coordinates)
              }}
            />
          </Field>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Duration</span>
        <Chips
          options={DURATIONS.map((item) => ({
            value: item,
            label: `${item} min`,
          }))}
          value={duration}
          onChange={setDuration}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Type of route</span>
        <Chips
          options={ROUTE_TYPES}
          value={routeType}
          onChange={setRouteType}
          columns={2}
        />
      </div>
    </Screen>
  )
}
