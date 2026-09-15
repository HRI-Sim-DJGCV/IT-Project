import { useHighContrast } from '../context/HighContrastContext'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import { WaveBackground } from '../components/WaveBackground'
import logo from '../../asset/logo.png'

export function Landing() {
  const navigate = useNavigate()
  const { highContrast, toggleHighContrast } = useHighContrast()

  const glassButtonStyle = {
    height: 48,
    borderRadius: '9999px',
    textTransform: 'none',
    fontSize: '0.9375rem',
    fontWeight: 600,
    letterSpacing: '0.01em',
    border: highContrast
      ? '2px solid #FFFF00'
      : (theme: any) => `1px solid ${alpha(theme.palette.common.white, 0.5)}`,
    color: highContrast ? '#FFFF00' : (theme: any) => theme.palette.common.white,
    bgcolor: highContrast
      ? '#000000'
      : (theme: any) => alpha(theme.palette.common.white, 0.25),
    backdropFilter: highContrast ? 'none' : 'blur(6px)',
    '&:hover': {
      border: highContrast ? '2px solid #FFFF00' : '1px solid #FFFFFF',
      bgcolor: highContrast
        ? '#111111'
        : (theme: any) => alpha(theme.palette.common.white, 0.1),
    },
  }

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
        bgcolor: highContrast ? '#000000' : 'transparent',
        transition: 'background-color 0.2s ease',
      }}
    >
      {/* Component background - hidden during high contrast */}
      {!highContrast && <WaveBackground />}

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
            borderRadius: '50%',
            bgcolor: highContrast
              ? '#000000'
              : (theme) => alpha(theme.palette.common.white, 1),
            backdropFilter: highContrast ? 'none' : 'blur(12px)',
            border: highContrast
              ? '2px solid #FFFF00'
              : (theme) =>
                  theme.palette.mode === 'light'
                    ? `1px solid ${alpha(theme.palette.text.primary, 0.15)}`
                    : `1px solid ${alpha(theme.palette.common.white, 0.3)}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: highContrast ? 'none' : '0 8px 32px rgba(0, 0, 0, 0.15)',
            overflow: 'hidden',
          }}
        >
          <Box
            component="img"
            src={logo}
            alt="Walking Meditation Logo"
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        </Box>

        {/* Headline */}
        <Typography
          variant="h1"
          sx={{
            fontSize: '2rem',
            fontWeight: 600,
            lineHeight: 1.25,
            letterSpacing: '-0.02em',
            color: highContrast
              ? '#FFFF00'
              : (theme) =>
                  theme.palette.mode === 'light'
                    ? theme.palette.text.primary
                    : theme.palette.common.white,
            mb: 1.5,
            textShadow: highContrast ? 'none' : undefined,
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
            color: highContrast
              ? '#FFFF00'
              : (theme) =>
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

        {/* Log in Button */}
        <Button
          variant="outlined"
          onClick={() => navigate('/login')}
          sx={glassButtonStyle}
        >
          Log in
        </Button>

        {/* Request Access Button */}
        <Button
          variant="outlined"
          onClick={() => navigate('/request-access')}
          sx={glassButtonStyle}
        >
          Request an access code
        </Button>

        {/* Access Code Button */}
        <Button
          variant="outlined"
          onClick={() => navigate('/access-code')}
          sx={glassButtonStyle}
        >
          Have an access code
        </Button>

        {/* High Contrast Mode Toggle */}
        <Button
          variant="outlined"
          onClick={toggleHighContrast}
          sx={glassButtonStyle}
        >
          {highContrast ? 'Disable High Contrast' : 'Enable High Contrast'}
        </Button>
      </Box>
    </Box>
  )
}