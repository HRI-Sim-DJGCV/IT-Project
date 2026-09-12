import { ErrorText } from '../../components/ui'
import type { AdminParticipantItem } from '../../types'

interface Props {
  participants: AdminParticipantItem[]
  loading: boolean
  error: string | null
  emptyText?: string
}

function formatDate(iso: string | null): string {
  if (!iso) return '–'
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

/** Participant rows shared by the Dashboard and Participants screens. */
export function AdminParticipantList({ participants, loading, error, emptyText = 'No participants yet.' }: Props) {
  if (error) return <ErrorText>{error}</ErrorText>

  return (
    <div className="flex flex-col divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
      {loading ? (
        <p className="p-3.5 text-sm text-muted" aria-live="polite">
          Loading…
        </p>
      ) : participants.length === 0 ? (
        <p className="p-3.5 text-sm text-muted">{emptyText}</p>
      ) : (
        participants.map((p) => {
          const s = p.latestScores
          return (
            <div key={p.id} className={`p-3.5 ${p.active ? '' : 'opacity-60'}`}>
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-bold text-ink">
                  {p.id}
                  {p.active ? '' : ' (inactive)'}
                </p>
                <p className="text-xs text-muted">Condition {p.condition}</p>
              </div>
              <p className="mt-0.5 text-xs text-muted">
                Status: <span className="font-medium text-ink">{p.status}</span> · Walks: {p.walkCount} · Last:{' '}
                {formatDate(p.lastWalkAt)}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {s ? (
                  <>
                    Latest calm score: {s.pre.calm} → {s.post?.calm ?? '–'}
                    {s.delta ? ` (${s.delta.calm > 0 ? '+' : ''}${s.delta.calm})` : ''}
                  </>
                ) : (
                  'No walks yet'
                )}
              </p>
            </div>
          )
        })
      )}
    </div>
  )
}
