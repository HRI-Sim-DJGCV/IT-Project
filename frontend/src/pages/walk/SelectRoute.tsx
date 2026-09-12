import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { generateRoutes } from '../../api'
import { RouteMap } from '../../components/RouteMap'
import { Button, Screen } from '../../components/ui'
import { useSession } from '../../context/SessionContext'
import type { RouteOption } from '../../types'

export function SelectRoute() {
  const navigate = useNavigate()
  const { draft, updateDraft } = useSession()
  const [routes, setRoutes] = useState<RouteOption[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<RouteOption | null>(
    draft?.route ?? null,
  )

  useEffect(() => {
    if (!draft?.plan) {
      navigate('/walk/plan', { replace: true })
      return
    }

    let cancelled = false
    void generateRoutes(draft.plan)
      .then((generatedRoutes) => {
        if (!cancelled) setRoutes(generatedRoutes)
      })
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : 'Could not generate a route.',
          )
        }
      })

    return () => {
      cancelled = true
    }
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
      <RouteMap route={selected} className="h-44" />

      {error ? (
        <p className="text-center text-sm text-red-600">{error}</p>
      ) : routes === null ? (
        <p className="text-center text-sm text-muted">
          Generating routes…
        </p>
      ) : (
        <ul className="flex flex-col gap-2" role="radiogroup">
          {routes.map((route) => {
            const selectedRoute = selected?.id === route.id

            return (
              <li key={route.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selectedRoute}
                  onClick={() => setSelected(route)}
                  className={`w-full rounded-2xl border p-4 text-left transition active:scale-[0.99] ${
                    selectedRoute
                      ? 'border-primary bg-accent/50 ring-2 ring-accent'
                      : 'border-line bg-card'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{route.name}</span>
                    <span className="text-sm text-muted">
                      {route.distanceKm} km · ~{route.estimatedMinutes} min
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {route.description}
                  </p>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Screen>
  )
}