import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button, Card, Screen } from '../../components/ui'
import { useSession } from '../../context/SessionContext'
import type { WalkRecord } from '../../types'

export function Done() {
  const navigate = useNavigate()
  const { clearDraft } = useSession()
  const record = useLocation().state as WalkRecord | null

  // The walk is saved by now; drop the in-progress draft so a back-swipe
  // can't re-enter the flow.
  useEffect(() => clearDraft(), [clearDraft])

  return (
    <Screen footer={<Button onClick={() => navigate('/home', { replace: true })}>Back to home</Button>}>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-3xl">✓</div>
        <h1 className="text-2xl font-semibold">Walk complete</h1>
        <p className="text-sm text-muted">Thanks — your responses have been saved.</p>
        {record ? (
          <Card className="w-full text-left">
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <span className="text-muted">Distance</span>
              <span className="text-right font-medium">{record.route.distanceKm} km</span>
              <span className="text-muted">Time</span>
              <span className="text-right font-medium">{record.actualMinutes} min</span>
              <span className="text-muted">Route</span>
              <span className="text-right font-medium">{record.route.name}</span>
            </div>
          </Card>
        ) : null}
      </div>
    </Screen>
  )
}
