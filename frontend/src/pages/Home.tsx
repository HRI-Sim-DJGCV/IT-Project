import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROUTE_TYPE_LABELS } from '@shared/survey'
import { getWalkHistory } from '../api'
import { Screen } from '../components/ui'
import { useSession } from '../context/SessionContext'
import { useHighContrast } from '../context/HighContrastContext'
import { Box, Button, Card, CardContent, Stack, Typography } from '@mui/material'
import type { RouteType, WalkRecord } from '../types'
import { suggestRouteType, summariseWeek } from './homeStats'

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export function Home() {
  const navigate = useNavigate()
  const { participant, startDraft, updateDraft, signOut } = useSession()
  const { highContrast } = useHighContrast()

  // The week strip and suggestion always show. While history loads (or if it can't load) they use an empty history.
  const [walks, setWalks] = useState<WalkRecord[] | null>(null)
  useEffect(() => {
    let cancelled = false
    getWalkHistory()
      .then((history) => {
        if (!cancelled) setWalks(history)
      })
      .catch(() => {
        if (!cancelled) setWalks([])
      })
    return () => {
      cancelled = true
    }
  }, [])
  const week = useMemo(() => summariseWeek(walks ?? []), [walks])
  const suggestion = useMemo(() => suggestRouteType(walks ?? []), [walks])
  const accent = highContrast ? '#FFFF00' : 'var(--color-primary, #1e2a44)'
  const line = highContrast ? '#FFFF00' : 'var(--color-line, #e2e4e9)'

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

  function begin(suggestedRouteType?: RouteType) {
    // save record
    startDraft()
    if (suggestedRouteType) updateDraft({ suggestedRouteType })
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
                onClick={() => begin()}
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

        <Card component="section" aria-label="This week" variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent>
            <Stack spacing={1.5}>
              <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                <Typography component="h3" variant="subtitle2" sx={{ fontWeight: 600 }}>
                  This week
                </Typography>
                <Stack direction="row" aria-label="Key" sx={{ alignItems: 'center', gap: 1.5 }}>
                  {[
                    { filled: true, label: 'Walked' },
                    { filled: false, label: 'No walk yet' },
                  ].map(({ filled, label }) => (
                    <Stack key={label} direction="row" sx={{ alignItems: 'center', gap: 0.5 }}>
                      <Box
                        aria-hidden
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          bgcolor: filled ? accent : 'transparent',
                          border: `2px solid ${filled ? accent : line}`,
                        }}
                      />
                      <Typography color="text.secondary" variant="caption">
                        {label}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Stack>
              <Stack direction="row" role="list" sx={{ justifyContent: 'space-between' }}>
                {DAY_LETTERS.map((letter, index) => {
                  const walked = week.days[index]
                  const today = index === week.todayIndex
                  return (
                    <Stack
                      key={DAY_NAMES[index]}
                      role="listitem"
                      spacing={0.5}
                      sx={{ alignItems: 'center' }}
                      aria-label={`${DAY_NAMES[index]}${today ? ' (today)' : ''}: ${walked ? 'walked' : 'no walk'}`}
                    >
                      <Box
                        aria-hidden
                        sx={{
                          width: 30,
                          height: 30,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: walked ? accent : 'transparent',
                          border: `2px solid ${walked ? accent : line}`,
                          color: highContrast ? '#000000' : '#ffffff',
                          fontSize: 15,
                          fontWeight: 700,
                        }}
                      >
                        {walked ? '✓' : ''}
                      </Box>
                      <Typography
                        aria-hidden
                        variant="caption"
                        color={today ? 'text.primary' : 'text.secondary'}
                        sx={{ fontWeight: today ? 700 : 400, textDecoration: today ? 'underline' : 'none' }}
                      >
                        {letter}
                      </Typography>
                    </Stack>
                  )
                })}
              </Stack>
              <Typography color="text.secondary" variant="body2">
                {walks === null
                  ? 'Loading your week…'
                  : week.walkCount === 0
                  ? 'No walks yet this week. Start one whenever you feel like it.'
                  : `${week.walkCount} ${week.walkCount === 1 ? 'walk' : 'walks'} · ${week.minutes} min this week`}
              </Typography>
            </Stack>
          </CardContent>
        </Card>

        <Card component="section" aria-label="Walk suggestion" variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent>
            <Stack spacing={1.5}>
              <Typography component="h3" variant="subtitle2" sx={{ fontWeight: 600 }}>
                Try something different
              </Typography>
              <Stack spacing={0.25}>
                <Typography component="p" variant="h6">
                  {ROUTE_TYPE_LABELS[suggestion.routeType]}
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  {suggestion.reason}
                </Typography>
              </Stack>
              <Button fullWidth onClick={() => begin(suggestion.routeType)} variant="outlined" sx={outlinedButtonSx}>
                Start a {ROUTE_TYPE_LABELS[suggestion.routeType].toLowerCase()} walk
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
