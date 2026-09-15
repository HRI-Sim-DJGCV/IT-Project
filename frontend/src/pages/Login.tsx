import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
// material design import
import {
  Box,
  Button,
  TextField,
  MenuItem,
  Typography,
  InputAdornment,
  IconButton,
  Alert,
  Paper,
} from '@mui/material'
import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'
import ArrowBackIosNew from '@mui/icons-material/ArrowBackIosNew'
import { login, ApiError } from '../api'
import { useSession } from '../context/SessionContext'
import { useHighContrast } from '../context/HighContrastContext'
import type { Role } from '../types'

const ROLES: { value: Role; label: string }[] = [
  { value: 'participant', label: 'Participant' },
  { value: 'medical_professional', label: 'Medical Professional' },
  { value: 'researcher', label: 'Researcher' },
]

// for testing purpose only to be deleted
const DEV_ACCOUNTS = [
  { role: 'Participant', user: 'demo', pass: 'demo' },
  { role: 'Researcher', user: 'doctor', pass: 'doctor' },
  { role: 'Admin', user: 'admin', pass: 'admin' },
]

export function Login() {
  const navigate = useNavigate()
  const { signIn } = useSession()
  const { highContrast } = useHighContrast()

  const [role, setRole] = useState<Role>('participant')
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!userId.trim() || !password) {
      setError('Have you entered your User ID and password?')
      return
    }

    setBusy(true)
    setError(null)

    try {
      const res = await login(role, userId.trim(), password)
      signIn(res)
      navigate(res.role === 'participant' ? '/' : '/admin')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Server error.')
    } finally {
      setBusy(false)
    }
  }

  // High contrast theme overrides
  const hcColor = highContrast ? '#FFFF00' : undefined
  const hcBg = highContrast ? '#000000' : undefined
  const hcBorder = highContrast ? '2px solid #FFFF00' : undefined

  const inputSx = {
    '& .MuiOutlinedInput-root': {
      borderRadius: '12px',
      color: hcColor ?? 'inherit',
      '& fieldset': { borderColor: hcColor, borderWidth: highContrast ? 2 : 1 },
      '&:hover fieldset': { borderColor: hcColor },
      '&.Mui-focused fieldset': { borderColor: hcColor, borderWidth: 2 },
    },
    '& .MuiInputLabel-root': {
      color: hcColor,
      '&.Mui-focused': { color: hcColor },
    },
    '& .MuiSelect-icon': { color: hcColor },
  }

  // Unified button styling
  const sharedButtonSx = {
    height: 48,
    borderRadius: '9999px',
    textTransform: 'none',
    fontSize: '0.9375rem',
    fontWeight: 600,
    letterSpacing: '0.01em',
  }

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
        bgcolor: hcBg ?? 'var(--color-surface, #f5f5f7)',
        transition: 'background-color 0.2s ease',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 420,
          p: { xs: 3, sm: 4 },
          borderRadius: '24px',
          border: hcBorder ?? '1px solid var(--color-line, #e2e4e9)',
          bgcolor: hcBg ?? 'var(--color-card, #ffffff)',
        }}
      >
        <Box sx={{ mb: 3, position: 'relative', textAlign: 'center' }}>
          {/* Back button */}
          <IconButton
            onClick={() => navigate(-1)}
            aria-label="Back"
            size="small"
            sx={{
              position: 'absolute',
              left: 0,
              top: 2,
              color: hcColor ?? 'var(--color-ink, #16181d)',
              border: hcBorder ?? 'none',
              bgcolor: hcBg ?? 'transparent',
              '&:hover': {
                bgcolor: highContrast ? '#111111' : 'rgba(0, 0, 0, 0.05)',
                border: hcBorder ?? 'none',
              },
            }}
          >
            <ArrowBackIosNew fontSize="small" />
          </IconButton>

          <Typography
            variant="h5"
            sx={{ fontWeight: 700, color: hcColor ?? 'var(--color-ink, #16181d)', mb: 0.5 }}
          >
            Welcome
          </Typography>
          <Typography variant="body2" sx={{ color: hcColor ?? 'var(--color-muted, #6b7280)' }}>
            Please sign in to your meditation profile
          </Typography>
        </Box>

        <form onSubmit={handleSubmit}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <TextField
              select
              label="Select Role"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              fullWidth
              sx={inputSx}
              slotProps={{
                select: {
                  MenuProps: {
                    slotProps: {
                      paper: {
                        sx: {
                          bgcolor: hcBg,
                          border: hcBorder,
                          '& .MuiMenuItem-root': {
                            color: hcColor,
                            '&:hover': { bgcolor: highContrast ? '#111111' : undefined },
                            '&.Mui-selected': { bgcolor: highContrast ? '#222222' : undefined },
                          },
                        },
                      },
                    },
                  },
                },
              }}
            >
              {ROLES.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="User ID"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              autoComplete="username"
              fullWidth
              autoFocus
              sx={inputSx}
            />

            <TextField
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              fullWidth
              sx={inputSx}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword((prev) => !prev)}
                        edge="end"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        sx={{ color: hcColor ?? 'inherit' }}
                      >
                        {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />

            {error && (
              <Alert
                severity="error"
                sx={{
                  borderRadius: '12px',
                  bgcolor: hcBg ?? '#840000',
                  color: hcColor ?? '#ffffff',
                  border: hcBorder ?? 'none',
                  '& .MuiAlert-icon': { color: hcColor ?? '#ffffff' },
                }}
              >
                {error}
              </Alert>
            )}

            <Button
              type="submit"
              variant="contained"
              disabled={busy}
              fullWidth
              sx={{
                ...sharedButtonSx,
                boxShadow: 'none',
                bgcolor: hcBg ?? 'var(--color-primary, #1e2a44)',
                color: hcColor ?? '#ffffff',
                border: hcBorder ?? 'none',
                '&:hover': {
                  bgcolor: highContrast ? '#111111' : 'var(--color-primary-hover, #2b3a5c)',
                  border: hcBorder ?? 'none',
                  boxShadow: 'none',
                },
                '&.Mui-disabled': {
                  color: highContrast ? '#666600' : undefined,
                  borderColor: highContrast ? '#666600' : undefined,
                },
              }}
            >
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>

            {role === 'participant' && (
              <Button
                variant="outlined"
                fullWidth
                onClick={() => navigate('/access-code')}
                sx={{
                  ...sharedButtonSx,
                  bgcolor: hcBg ?? 'transparent',
                  color: hcColor ?? 'var(--color-primary, #1e2a44)',
                  border: hcBorder ?? '1px solid var(--color-line, #e2e4e9)',
                  '&:hover': {
                    bgcolor: highContrast ? '#111111' : 'rgba(30, 42, 68, 0.04)',
                    border: hcBorder ?? '1px solid var(--color-primary, #1e2a44)',
                  },
                }}
              >
                Received an access code?
              </Button>
            )}
          </Box>
        </form>

        <Box
          sx={{
            mt: 3.5,
            p: 2,
            borderRadius: '16px',
            bgcolor: hcBg ?? 'var(--color-surface, #f5f5f7)',
            border: highContrast ? '2px dashed #FFFF00' : '1px dashed var(--color-line, #e2e4e9)',
          }}
        >
          <Typography
            variant="caption"
            sx={{ display: 'block', fontWeight: 600, color: hcColor ?? '#4b5563', mb: 0.5 }}
          >
            Dev. test accounts:
          </Typography>

          {DEV_ACCOUNTS.map(({ role, user, pass }) => (
            <Typography
              key={user}
              variant="caption"
              sx={{
                display: 'block',
                color: hcColor ?? '#6b7280',
                '& code': {
                  color: hcColor ?? 'inherit',
                  bgcolor: highContrast ? '#1a1a00' : undefined,
                  px: 0.5,
                  borderRadius: '4px',
                },
              }}
            >
              • {role}: <code>{user}</code> / <code>{pass}</code>
            </Typography>
          ))}
        </Box>
      </Paper>
    </Box>
  )
}