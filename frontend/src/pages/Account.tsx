import { Card, Screen, SectionLabel } from '../components/ui'
import { useSession } from '../context/SessionContext'

export function Account() {
  const { participant } = useSession()
  const rows: Array<[string, string]> = [
    ['Participant ID', participant?.id ?? '—'],
    ['Condition', participant?.condition ?? '—'],
    ['Joined', participant ? new Date(participant.joinedAt).toLocaleDateString() : '—'],
  ]
  return (
    <Screen title="Account details" back="/home">
      <Card>
        <SectionLabel>Your details</SectionLabel>
        <dl className="mt-3 divide-y divide-line">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between py-3">
              <dt className="text-sm text-muted">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <p className="text-xs text-muted">
        Your data is stored anonymously under your participant ID for the stress regulation trial.
      </p>
    </Screen>
  )
}
