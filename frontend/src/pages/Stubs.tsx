import { Card, Screen } from '../components/ui'

/** Placeholder screens for flows that are out of scope for this iteration. */

export function RequestAccessStub() {
  return (
    <Screen title="Request access" back="/">
      <Card>
        <p className="text-sm text-muted">
          Access requests will be handled by the research team. This screen is a placeholder.
        </p>
      </Card>
    </Screen>
  )
}

export function AccessCodeStub() {
  return (
    <Screen title="Access with code" back="/">
      <Card>
        <p className="text-sm text-muted">
          Access codes are issued by the research team when they add a participant. Redeeming a code here to set
          a password will be supported once the backend exists.
        </p>
      </Card>
    </Screen>
  )
}
