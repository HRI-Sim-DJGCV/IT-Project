import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'

{/*
This function creates a gradient background. 
Use light mode for now. Dark mode NOT implemented
*/}
function GradientBackground() {
  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        bgcolor: (theme) =>
          // remove ternary cond after dark mode implementation
          theme.palette.mode === 'light'
            ? '#EEF5FE'
            : theme.palette.primary.dark,
        zIndex: 0,
        pointerEvents: 'none',
      }}
    >
      {/* Layer 1 */}
      <Box
        sx={{
          position: 'absolute',
          top: '36%',
          left: '-25%',
          width: '150%',
          height: '80%',
          borderRadius: '50% 50% 0 0 / 22% 22% 0 0',
          bgcolor: (theme) =>
            theme.palette.mode === 'dark'
              ? alpha(theme.palette.primary.dark, 0.35)
              : '#DBECFC',
        }}
      />

      {/* Layer 2 */}
      <Box
        sx={{
          position: 'absolute',
          top: '49%',
          left: '-30%',
          width: '160%',
          height: '70%',
          borderRadius: '50% 50% 0 0 / 24% 24% 0 0',
          bgcolor: (theme) =>
            theme.palette.mode === 'dark'
              ? alpha(theme.palette.primary.main, 0.45)
              : '#C5DEFA',
        }}
      />

      {/* Layer 3 */}
      <Box
        sx={{
          position: 'absolute',
          top: '63%',
          left: '-20%',
          width: '140%',
          height: '60%',
          borderRadius: '50% 50% 0 0 / 26% 26% 0 0',
          bgcolor: (theme) =>
            theme.palette.mode === 'dark'
              ? alpha(theme.palette.primary.light, 0.4)
              : '#AFD1F6',
        }}
      />

      {/* Layer 4 */}
      <Box
        sx={{
          position: 'absolute',
          top: '78%',
          left: '-15%',
          width: '130%',
          height: '50%',
          borderRadius: '50% 50% 0 0 / 28% 28% 0 0',
          bgcolor: (theme) =>
            theme.palette.mode === 'dark'
              ? alpha(theme.palette.primary.light, 0.55)
              : '#91afd0',
        }}
      />
    </Box>
  )
}

export function Landing() {
  const navigate = useNavigate()

  return (
    <Box
      component="main"
      sx={{
        position: 'relative',
        mx: 'auto',
        display: 'flex',
        minHeight: '100dvh',
        width: '100%',
        maxWidth: 430,
        flexDirection: 'column',
        justifyContent: 'space-between',
        px: 3,
        py: 5,
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* Background */}
      <GradientBackground />

      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
        }}
      >
        {/* Logo */}
        <Box
          sx={{
            mb: 4,
            width: 100,
            height: 100,
            borderRadius: '28px',
            bgcolor: (theme) => alpha(theme.palette.common.white, 1),
            backdropFilter: 'blur(12px)',
            color: '#000000',
            border: (theme) =>
              theme.palette.mode === 'light'
                ? `1px solid ${alpha(theme.palette.text.primary, 0.15)}`
                : `1px solid ${alpha(theme.palette.common.white, 0.3)}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 600, letterSpacing: '0.01em' }}>
            Logo
          </Typography>
        </Box>

        {/* Headline */}
        <Typography
          variant="h1"
          sx={{
            fontSize: '2rem',
            fontWeight: 600,
            lineHeight: 1.25,
            letterSpacing: '-0.02em',
            color: (theme) =>
              theme.palette.mode === 'light'
                ? theme.palette.text.primary
                : theme.palette.common.white,
            mb: 1.5,
            textShadow: (theme) =>
              theme.palette.mode === 'light'
                ? 'none'
                : '0 2px 8px rgba(0, 0, 0, 0.15)',
          }}
        >
          Walking Meditation
        </Typography>

        {/* Subtitle */}
        <Typography
          variant="body1"
          sx={{
            fontSize: '1rem',
            lineHeight: 1.5,
            color: (theme) =>
              theme.palette.mode === 'light'
                ? theme.palette.text.secondary
                : alpha(theme.palette.common.white, 0.85),
            maxWidth: 290,
          }}
        >
          Guided walks to help you slow down and reset.
        </Typography>
      </Box>

      {/* Button container */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          width: '100%',
          pb: 2,
        }}
      >
        {/* Button */}
        <Button
          variant="contained"
          disableElevation
          onClick={() => navigate('/login')}
          sx={{
            height: 48,
            borderRadius: '9999px',
            textTransform: 'none',
            fontSize: '0.9375rem',
            fontWeight: 600,
            letterSpacing: '0.01em',
            bgcolor: (theme) => theme.palette.common.white,
            color: (theme) => theme.palette.primary.dark,
            '&:hover': {
              bgcolor: (theme) => alpha(theme.palette.common.white, 0.92),
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
            },
          }}
        >
          Log in
        </Button>

        {/* Button */}
        <Button
          variant="outlined"
          onClick={() => navigate('/request-access')}
          sx={{
            height: 48,
            borderRadius: '9999px',
            textTransform: 'none',
            fontSize: '0.9375rem',
            fontWeight: 500,
            letterSpacing: '0.01em',
            borderColor: (theme) => alpha(theme.palette.common.white, 0.5),
            color: (theme) => theme.palette.common.white,
            bgcolor: (theme) => alpha(theme.palette.common.white, 0.25),
            backdropFilter: 'blur(6px)',
            '&:hover': {
              borderColor: (theme) => theme.palette.common.white,
              bgcolor: (theme) => alpha(theme.palette.common.white, 0.10),
            },
          }}
        >
          Request access
        </Button>

        {/* Button */}
        <Button
          variant="text"
          onClick={() => navigate('/access-code')}
          sx={{
            height: 40,
            borderRadius: '9999px',
            textTransform: 'none',
            color: (theme) => theme.palette.common.white,
            fontWeight: 600,
            fontSize: '0.875rem',
            letterSpacing: '0.01em',
            mt: 0.5,
            '&:hover': {
              bgcolor: (theme) => alpha(theme.palette.common.white, 0.1),
            },
          }}
        >
          Received an access code?
        </Button>
      </Box>
    </Box>
  )
}