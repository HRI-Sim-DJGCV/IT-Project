import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DURATIONS, ROUTE_TYPES, ROUTE_TYPE_LABELS } from '@shared/survey'
import { GooglePlaceAutocomplete } from '../../components/GooglePlaceAutocomplete'
import { RouteMap } from '../../components/RouteMap'
import { Button, Chips, Field, Screen } from '../../components/ui'
import { useSession } from '../../context/SessionContext'
import { useCurrentLocation } from '../../hooks/useCurrentLocation'
import type { RouteType, WalkDuration } from '../../types'

type StartMode = 'address' | 'current'
type Coordinates = { lat: number; lon: number }

export function Plan() {
  const navigate = useNavigate()
  const { draft, updateDraft } = useSession()
  const { currentLocation, usingFallback } = useCurrentLocation()
  const initialRouteType = draft?.plan?.routeType ?? null

  const [startMode, setStartMode] = useState<StartMode>(
    draft?.plan?.startLocation === 'Current location' ? 'current' : 'address',
  )
  const [start, setStart] = useState(
    draft?.plan?.startLocation === 'Current location' ? '' : (draft?.plan?.startLocation ?? ''),
  )
  const [startCoordinates, setStartCoordinates] = useState<Coordinates | undefined>(
    draft?.plan?.startCoordinates,
  )
  const [end, setEnd] = useState(draft?.plan?.endLocation ?? '')
  const [endCoordinates, setEndCoordinates] = useState<Coordinates | undefined>(
    draft?.plan?.endCoordinates,
  )
  const [sameAsStart, setSameAsStart] = useState(
    initialRouteType === 'loop'
      ? true
      : initialRouteType === 'out_and_back'
        ? false
        : !draft?.plan || draft.plan.endLocation === draft.plan.startLocation,
  )
  const [duration, setDuration] = useState<WalkDuration | null>(
    draft?.plan?.duration ?? null,
  )
  const [routeType, setRouteType] = useState<RouteType | null>(initialRouteType)

  const currentCoordinates: Coordinates = {
    lat: currentLocation[0],
    lon: currentLocation[1],
  }
  const selectedStartCoordinates =
    startMode === 'current' ? currentCoordinates : startCoordinates
  const returnsToStart = routeType === 'loop' ||
    (routeType !== 'out_and_back' && sameAsStart)
  const startLocation =
    startMode === 'current' ? 'Current location' : start.trim()
  const endLocation = returnsToStart ? startLocation : end.trim()
  const selectedEndCoordinates = returnsToStart
    ? selectedStartCoordinates
    : endCoordinates
  const needsSelectedEnd = routeType === 'out_and_back' || !returnsToStart

  const valid = Boolean(
    routeType &&
      duration &&
      startLocation &&
      (startMode === 'current' ? !usingFallback : startCoordinates) &&
      (!needsSelectedEnd || (endLocation && endCoordinates)),
  )

  const autocompleteBias = usingFallback ? undefined : currentLocation

  const changeRouteType = (nextRouteType: RouteType) => {
    setRouteType(nextRouteType)

    if (nextRouteType === 'loop') {
      // A loop always ends at its start. Remove stale destination data so it
      // cannot accidentally be sent to the backend.
      setSameAsStart(true)
      setEnd('')
      setEndCoordinates(undefined)
    } else if (nextRouteType === 'out_and_back') {
      // Out-and-back always needs a participant-selected turnaround point.
      setSameAsStart(false)
    }
  }

  return (
    <Screen
      title="Plan your walk"
      back="/walk/pre-survey"
      footer={
        <Button
          disabled={!valid}
          onClick={() => {
            if (
              duration &&
              routeType &&
              selectedStartCoordinates &&
              selectedEndCoordinates
            ) {
              updateDraft({
                plan: {
                  startLocation,
                  startCoordinates: selectedStartCoordinates,
                  endLocation,
                  endCoordinates: selectedEndCoordinates,
                  duration,
                  routeType,
                },
                // A new plan invalidates any route and generated script.
                route: undefined,
                preparationId: undefined,
                script: undefined,
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
          onChange={(event) => setStartMode(event.target.value as StartMode)}
          className="w-full rounded-xl border border-line bg-card px-4 py-3"
        >
          <option value="address">Enter an address</option>
          <option value="current" disabled={usingFallback}>
            {usingFallback ? 'Current location unavailable' : 'Use my current location'}
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
        <p className="text-sm text-muted">Your current coordinates will be used as the starting point.</p>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Type of route</span>
        <Chips
          options={ROUTE_TYPES.map((value) => ({ value, label: ROUTE_TYPE_LABELS[value] }))}
          value={routeType}
          onChange={changeRouteType}
          columns={2}
        />
      </div>

      {routeType === 'loop' ? (
        <p className="rounded-xl border border-line bg-card px-4 py-3 text-sm text-muted">
          A loop returns to your starting point, so no end address is needed.
        </p>
      ) : routeType === 'out_and_back' ? (
        <Field label="Turnaround point">
          <GooglePlaceAutocomplete
            value={end}
            placeholder="Where should the walk turn around?"
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
          <p className="mt-1 text-xs text-muted">
            The route will go to this place and follow the same path back.
          </p>
        </Field>
      ) : routeType ? (
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
      ) : (
        <p className="text-sm text-muted">
          Select a route type to choose how the walk should end.
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Duration</span>
        <Chips options={DURATIONS.map((item) => ({ value: item, label: `${item} min` }))} value={duration} onChange={setDuration} />
      </div>
    </Screen>
  )
}
