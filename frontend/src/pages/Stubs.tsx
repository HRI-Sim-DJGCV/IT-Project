import { Card, Screen } from '../components/ui'

/** Placeholder screen for a flow that is out of scope for this iteration. */
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
