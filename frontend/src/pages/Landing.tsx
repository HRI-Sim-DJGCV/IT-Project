import { useNavigate } from 'react-router-dom'
import { Button, Screen } from '../components/ui'

export function Landing() {
  const navigate = useNavigate()
  return (
    <Screen>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-primary bg-card text-sm font-semibold text-primary">
          Logo
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Welcome to Walking Meditation</h1>
          <p className="mt-2 text-sm text-muted">Guided walks to help you slow down and reset.</p>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <Button onClick={() => navigate('/login')}>Log in</Button>
        <Button variant="secondary" onClick={() => navigate('/request-access')}>
          Request access
        </Button>
        <Button variant="ghost" onClick={() => navigate('/access-code')}>
          Access with code
        </Button>
      </div>
    </Screen>
  )
}
