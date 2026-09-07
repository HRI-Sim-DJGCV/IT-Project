import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RouteMap } from '../../components/RouteMap'
import { Button, Chips, Field, Screen, TextInput } from '../../components/ui'
import { useSession } from '../../context/SessionContext'
import { useCurrentLocation } from '../../hooks/useCurrentLocation'
import { DURATIONS, ROUTE_TYPES } from '../../mock/data'
import type { RouteType, WalkDuration } from '../../types'

type StartMode = 'address' | 'current'

export function Plan() {
  const navigate = useNavigate()
  const { draft, updateDraft } = useSession()
  const { currentLocation, usingFallback } = useCurrentLocation()

  const [startMode, setStartMode] = useState<StartMode>('address')
  const [start, setStart] = useState(draft?.plan?.startLocation ?? '')
  const [end, setEnd] = useState(draft?.plan?.endLocation ?? '')
  const [sameAsStart, setSameAsStart] = useState(
    !draft?.plan || draft.plan.endLocation === draft.plan.startLocation,
  )
  const [duration, setDuration] = useState<WalkDuration | null>(
    draft?.plan?.duration ?? null,
  )
  const [routeType, setRouteType] = useState<RouteType | null>(
    draft?.plan?.routeType ?? null,
  )

  const startLocation =
    startMode === 'current' ? 'Current location' : start.trim()
  const endLocation = sameAsStart ? startLocation : end.trim()

  const valid = Boolean(
    (startMode === 'address' ? startLocation : !usingFallback) &&
      endLocation &&
      duration &&
      routeType,
  )

  return (
    <Screen
      title="Plan your walk"
      back="/walk/pre-survey"
      footer={
        <Button
          disabled={!valid}
          onClick={() => {
            if (duration && routeType) {
              updateDraft({
                plan: {
                  startLocation,
                  startCoordinates:
                    startMode === 'current'
                      ? {
                          lat: currentLocation[0],
                          lon: currentLocation[1],
                        }
                      : undefined,
                  endLocation,
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
        <TextInput
          value={start}
          onChange={(event) => setStart(event.target.value)}
          placeholder="e.g. University of Melbourne"
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
            <TextInput
              value={end}
              onChange={(event) => setEnd(event.target.value)}
              placeholder="e.g. Work"
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