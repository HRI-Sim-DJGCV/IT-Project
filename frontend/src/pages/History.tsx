import { useEffect, useState } from 'react'
import { getWalkHistory } from '../api'
import { Card, Screen } from '../components/ui'
import { useSession } from '../context/SessionContext'
import { ROUTE_TYPES, SURVEY_ITEMS } from '../mock/data'
import type { SurveyResponse, WalkRecord } from '../types'

function calmScore(s: SurveyResponse | null): number | null {
  if (!s) return null
  // Higher = calmer. Reverse-score the negative items.
  const positive = ['calm', 'at_ease']
  const total = SURVEY_ITEMS.reduce((acc, item) => {
    const v = s[item.key] ?? 0
    return acc + (positive.includes(item.key) ? v : 5 - v)
  }, 0)
  return total
}

export function History() {
  const { participant } = useSession()
  const [walks, setWalks] = useState<WalkRecord[] | null>(null)

  useEffect(() => {
    if (participant) getWalkHistory(participant.id).then(setWalks)
  }, [participant])

  return (
    <Screen title="Activity history" back="/home">
      {walks === null ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : walks.length === 0 ? (
        <p className="text-sm text-muted">No walks yet. Your completed walks will appear here.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {walks.map((w) => {
            const pre = calmScore(w.preSurvey)
            const post = calmScore(w.postSurvey)
            const delta = pre !== null && post !== null ? post - pre : null
            const type = ROUTE_TYPES.find((t) => t.value === w.plan.routeType)?.label
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
