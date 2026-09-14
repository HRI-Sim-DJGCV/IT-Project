import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { generateRoutes } from '../../api'
import { RouteMap } from '../../components/RouteMap'
import { Button, ErrorText, Screen } from '../../components/ui'
import { useSession } from '../../context/SessionContext'
import type { RouteOption } from '../../types'

export function SelectRoute() {
  const navigate = useNavigate()
  const { draft, updateDraft } = useSession()
  const [routes, setRoutes] = useState<RouteOption[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<RouteOption | null>(draft?.route ?? null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!draft?.plan) {
      navigate('/walk/plan', { replace: true })
      return
    }
    let cancelled = false
    generateRoutes(draft.plan)
      .then((generated) => {
        if (cancelled) return
        setRoutes(generated)
        // Keep a previously chosen route selected if it is still offered.
        setSelected((prev) => generated.find((r) => r.id === prev?.id) ?? prev)
      })
      .catch((requestError: unknown) => {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : 'Could not generate a route.')
      })
    return () => {
      cancelled = true
    }
  }, [draft?.plan, navigate, attempt])

  function retry() {
    setRoutes(null)
    setError(null)
    setAttempt((a) => a + 1)
  }

  return (
    <Screen
      title="Choose route"
      back="/walk/plan"
      footer={
        <Button
          disabled={!selected}
          onClick={() => {
            if (!selected) return
            const sameRoute = draft?.route?.id === selected.id
            updateDraft({
              route: selected,
              // Changing route means a new script; keep an existing preparation only for the same route.
              preparationId: sameRoute ? draft?.preparationId : undefined,
              script: sameRoute ? draft?.script : undefined,
            })
            navigate('/walk/prepare')
          }}
        >
          Prepare meditation
        </Button>
      }
    >
      <RouteMap route={selected} className="h-44" />

      {error ? (
        <>
          <ErrorText>{error}</ErrorText>
          <Button variant="secondary" onClick={retry}>
            Try again
          </Button>
        </>
      ) : routes === null ? (
        <p className="text-center text-sm text-muted">Finding routes…</p>
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
                    selectedRoute ? 'border-primary bg-accent/50 ring-2 ring-accent' : 'border-line bg-card'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{route.name}</span>
                    <span className="text-sm text-muted">
                      {route.distanceKm} km · ~{route.estimatedMinutes} min
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted">{route.description}</p>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Screen>
  )
}
