import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPlaceholder } from '../../components/MapPlaceholder'
import { Button, Chips, Field, Screen, TextInput } from '../../components/ui'
import { useSession } from '../../context/SessionContext'
import { DURATIONS, ROUTE_TYPES } from '../../mock/data'
import type { RouteType, WalkDuration } from '../../types'

export function Plan() {
  const navigate = useNavigate()
  const { draft, updateDraft } = useSession()
  const [start, setStart] = useState(draft?.plan?.startLocation ?? '')
  const [end, setEnd] = useState(draft?.plan?.endLocation ?? '')
  const [sameAsStart, setSameAsStart] = useState(!draft?.plan || draft.plan.endLocation === draft.plan.startLocation)
  const [duration, setDuration] = useState<WalkDuration | null>(draft?.plan?.duration ?? null)
  const [routeType, setRouteType] = useState<RouteType | null>(draft?.plan?.routeType ?? null)

  const endLocation = sameAsStart ? start : end
  const valid = start.trim() && endLocation.trim() && duration && routeType

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
                plan: { startLocation: start.trim(), endLocation: endLocation.trim(), duration, routeType },
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
      <MapPlaceholder className="h-40" />

      <Field label="Start">
        <TextInput value={start} onChange={(e) => setStart(e.target.value)} placeholder="e.g. Home" />
      </Field>

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={sameAsStart}
            onChange={(e) => setSameAsStart(e.target.checked)}
            className="h-5 w-5 accent-primary"
          />
          End where I started
        </label>
        {!sameAsStart ? (
          <Field label="End">
            <TextInput value={end} onChange={(e) => setEnd(e.target.value)} placeholder="e.g. Work" />
          </Field>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Duration</span>
        <Chips options={DURATIONS.map((d) => ({ value: d, label: `${d} min` }))} value={duration} onChange={setDuration} />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Type of route</span>
        <Chips options={ROUTE_TYPES} value={routeType} onChange={setRouteType} columns={2} />
      </div>
    </Screen>
  )
}
