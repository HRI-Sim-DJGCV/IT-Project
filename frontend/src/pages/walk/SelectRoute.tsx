import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { generateRoutes } from '../../api'
import { MapPlaceholder } from '../../components/MapPlaceholder'
import { Button, Screen } from '../../components/ui'
import { useSession } from '../../context/SessionContext'
import type { RouteOption } from '../../types'

export function SelectRoute() {
  const navigate = useNavigate()
  const { draft, updateDraft } = useSession()
  const [routes, setRoutes] = useState<RouteOption[] | null>(null)
  const [selected, setSelected] = useState<RouteOption | null>(draft?.route ?? null)

  useEffect(() => {
    if (!draft?.plan) {
      navigate('/walk/plan', { replace: true })
      return
    }
    generateRoutes(draft.plan.duration).then(setRoutes)
  }, [draft?.plan, navigate])

  return (
    <Screen
      title="Choose route"
      back="/walk/plan"
      footer={
        <Button
          disabled={!selected}
          onClick={() => {
            if (selected) {
              updateDraft({ route: selected })
              navigate('/walk/progress')
            }
          }}
        >
          Start meditation
        </Button>
      }
    >
      <MapPlaceholder route={selected} className="h-44" />

      {routes === null ? (
        <p className="text-center text-sm text-muted">Generating routes…</p>
      ) : (
        <ul className="flex flex-col gap-2" role="radiogroup">
          {routes.map((r) => {
            const on = selected?.id === r.id
            return (
              <li key={r.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setSelected(r)}
                  className={`w-full rounded-2xl border p-4 text-left transition active:scale-[0.99] ${
                    on ? 'border-primary bg-accent/50 ring-2 ring-accent' : 'border-line bg-card'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{r.name}</span>
                    <span className="text-sm text-muted">
                      {r.distanceKm} km · ~{r.estimatedMinutes} min
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted">{r.description}</p>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Screen>
  )
}
