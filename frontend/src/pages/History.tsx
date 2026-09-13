import { useEffect, useState } from 'react'
import { ROUTE_TYPE_LABELS } from '@shared/survey'
import { getWalkHistory } from '../api'
import { Card, ErrorText, Screen } from '../components/ui'
import type { WalkRecord } from '../types'

export function History() {
  const [walks, setWalks] = useState<WalkRecord[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getWalkHistory()
      .then((w) => {
        if (!cancelled) setWalks(w)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load your history.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Screen title="Activity history" back="/home">
      {error ? (
        <ErrorText>{error}</ErrorText>
      ) : walks === null ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : walks.length === 0 ? (
        <p className="text-sm text-muted">No walks yet. Your completed walks will appear here.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {walks.map((w) => {
            // Scores are computed by the server from the raw answers; the app only displays them.
            const pre = w.scores?.pre.calm ?? null
            const post = w.scores?.post?.calm ?? null
            const delta = w.scores?.delta?.calm ?? null
            const type = ROUTE_TYPE_LABELS[w.plan.routeType]
            return (
              <li key={w.id}>
                <Card>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">
                        {new Date(w.date).toLocaleDateString(undefined, {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                        })}
                      </p>
                      <p className="text-sm text-muted">
                        {w.route.distanceKm} km · {w.actualMinutes} min · {type}
                        {w.route.park ? ` · via ${w.route.park.name}` : ''}
                      </p>
                    </div>
                    {delta !== null ? (
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          delta > 0 ? 'bg-green-100 text-green-800' : delta < 0 ? 'bg-red-100 text-red-800' : 'bg-line text-muted'
                        }`}
                      >
                        {delta > 0 ? `+${delta}` : delta} calm
                      </span>
                    ) : (
                      <span className="rounded-full bg-line px-2.5 py-1 text-xs text-muted">Incomplete</span>
                    )}
                  </div>
                  {pre !== null && post !== null ? (
                    <p className="mt-2 text-xs text-muted">
                      Calm score {pre} → {post} (out of 16)
                    </p>
                  ) : null}
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </Screen>
  )
}
