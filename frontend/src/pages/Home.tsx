import { useNavigate } from 'react-router-dom'
import { Button, Card, Screen } from '../components/ui'
import { useSession } from '../context/SessionContext'

export function Home() {
  const navigate = useNavigate()
  const { participant, startDraft, signOut } = useSession()

  function begin() {
    startDraft()
    navigate('/walk/pre-survey')
  }

  return (
    <Screen
      title="Walking Meditation"
      right={
        <button type="button" onClick={() => { signOut(); navigate('/', { replace: true }) }} className="text-sm text-muted">
          Log out
        </button>
      }
    >
      <div>
        <h2 className="text-2xl font-semibold">Welcome back</h2>
        <p className="text-sm text-muted">{participant?.displayName}</p>
      </div>

      <Card className="flex flex-col gap-3 bg-accent/40">
        <p className="text-sm">Ready for a guided walk? It takes 15–45 minutes and starts with a short check-in.</p>
        <Button onClick={begin}>Start walk</Button>
      </Card>

      <div className="flex flex-col gap-2">
        <Button variant="secondary" onClick={() => navigate('/history')}>
          Activity history
        </Button>
        <Button variant="secondary" onClick={() => navigate('/account')}>
          Account details
        </Button>
      </div>
    </Screen>
  )
}
