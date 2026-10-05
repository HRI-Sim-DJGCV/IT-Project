import { useNavigate } from 'react-router-dom'
import { Screen } from '../components/ui'
import { useSession } from '../context/SessionContext'
import { useHighContrast } from '../context/HighContrastContext'
import { Button, Card, CardContent, Stack, Typography } from '@mui/material'

export function Home() {
  const navigate = useNavigate()
  const { participant, startDraft, signOut } = useSession()
  const { highContrast } = useHighContrast()

  // button styling
  const sharedButtonSx = {
    height: 48,
    borderRadius: '9999px',
    textTransform: 'none',
    fontSize: '0.9375rem',
    fontWeight: 600,
    letterSpacing: '0.01em',
  }
  
  const outlinedButtonSx = {
    ...sharedButtonSx,
    bgcolor: highContrast ? '#000000' : 'transparent',
    color: highContrast ? '#FFFF00' : 'var(--color-primary, #1e2a44)',
    border: highContrast ? '2px solid #FFFF00' : '1px solid var(--color-line, #e2e4e9)',
    '&:hover': {
      bgcolor: highContrast ? '#111111' : 'rgba(30, 42, 68, 0.04)',
      border: highContrast ? '2px solid #FFFF00' : '1px solid var(--color-primary, #1e2a44)',
    },
  }

  function begin() {
    // save record
    startDraft()
    navigate('/walk/pre-survey')
  }

  // log out function
  function handleLogout() {
    signOut()
    navigate('/', { replace: true })
  }

  return (
    <Screen
      title="Walking Meditation"
      right={
        <Button
          variant="outlined"
          sx={outlinedButtonSx}
          onClick={handleLogout}
        >
          Log out
        </Button>
      }
    >
      <Stack spacing={3}>
        <Stack spacing={0.5}>
          <Typography component="h2" sx={{ fontWeight: 600 }} variant="h5">
            Welcome back
          </Typography>
          <Typography color="text.secondary" variant="body2">
            {participant?.displayName}
          </Typography>
        </Stack>

        <Card
          component="section"
          sx={{
            bgcolor: 'secondary.main',
            color: 'secondary.contrastText',
            borderRadius: 3,
          }}
        >
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="body2">
                Ready for a guided walk? It takes 15–45 minutes and starts
                with a short check-in.
              </Typography>

              <Button
                color="primary"
                fullWidth
                onClick={begin}
                variant="contained"
                sx={{
                  ...sharedButtonSx,
                  boxShadow: 'none',
                  bgcolor: highContrast ? '#000000' : 'var(--color-primary, #1e2a44)',
                  color: highContrast ? '#FFFF00' : '#ffffff',
                  border: highContrast ? '2px solid #FFFF00' : 'none',
                  '&:hover': {
                    bgcolor: highContrast ? '#111111' : 'var(--color-primary-hover, #2b3a5c)',
                    border: highContrast ? '2px solid #FFFF00' : 'none',
                    boxShadow: 'none',
                  },
                }}
              >
                Start walk
              </Button>
            </Stack>
          </CardContent>
        </Card>

        <Stack spacing={1}>
          <Button
            fullWidth
            onClick={() => navigate('/history')}
            variant="outlined"
            sx={outlinedButtonSx}
          >
            Activity history
          </Button>

          <Button
            fullWidth
            onClick={() => navigate('/account')}
            variant="outlined"
            sx={outlinedButtonSx}
          >
            Account details
          </Button>
        </Stack>
      </Stack>
    </Screen>
  )
}
