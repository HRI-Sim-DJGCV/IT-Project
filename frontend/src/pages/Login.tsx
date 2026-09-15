import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { login, ApiError } from '../api'
import { useSession } from '../context/SessionContext'
import type { Role } from '../types'

// Roles maintained as previous
const ROLES: { value: Role; label: string }[] = [
  { value: 'participant', label: 'Participant' },
  { value: 'medical_professional', label: 'Medical Professional' },
  { value: 'researcher', label: 'Researcher' },
]

export function Login() {
  const navigate = useNavigate()
  const { signIn } = useSession()

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
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Server error.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
        bgcolor: 'var(--color-surface, #f5f5f7)',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 420,
          p: { xs: 3, sm: 4 },
          borderRadius: '24px',
          border: '1px solid var(--color-line, #e2e4e9)',
          bgcolor: 'var(--color-card, #ffffff)',
        }}
      >
        <Box sx={{ mb: 3, textAlign: 'center' }}>
          <Typography
            variant="h5"
            sx={{ fontWeight: 700, color: 'var(--color-ink, #16181d)', mb: 0.5 }}
          >
            Welcome
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--color-muted, #6b7280)' }}>
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
              sx={{
                '& .MuiOutlinedInput-root': { borderRadius: '12px' },
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
              sx={{
                '& .MuiOutlinedInput-root': { borderRadius: '12px' },
              }}
            />

            <TextField
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              fullWidth
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword((prev) => !prev)}
                        edge="end"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
              sx={{
                '& .MuiOutlinedInput-root': { borderRadius: '12px' },
              }}
            />

            {error && (
              <Alert
                severity="error"
                sx={{
                  borderRadius: '12px',
                  bgcolor: '#840000',
                  color: '#ffffff',
                  '& .MuiAlert-icon': { color: '#ffffff' },
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
                borderRadius: '9999px',
                py: 1.5,
                textTransform: 'none',
                fontSize: '1rem',
                fontWeight: 600,
                boxShadow: 'none',
                bgcolor: 'var(--color-primary, #1e2a44)',
                '&:hover': {
                  bgcolor: 'var(--color-primary-hover, #2b3a5c)',
                  boxShadow: 'none',
                },
              }}
            >
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>

            {role === 'participant' && (
              <Button
                variant="text"
                onClick={() => navigate('/access-code')}
                sx={{
                  borderRadius: '9999px',
                  textTransform: 'none',
                  color: 'var(--color-primary, #1e2a44)',
                  fontWeight: 600,
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
            bgcolor: 'var(--color-surface, #f5f5f7)',
            border: '1px dashed var(--color-line, #e2e4e9)',
          }}
        >
          <Typography variant="caption" sx={{ display: 'block', fontWeight: 600, color: '#4b5563', mb: 0.5 }}>
            Dev. test accounts:
          </Typography>
          <Typography variant="caption" sx={{ display: 'block', color: '#6b7280' }}>
            • Participant: <code>demo</code> / <code>demo</code>
          </Typography>
          <Typography variant="caption" sx={{ display: 'block', color: '#6b7280' }}>
            • Researcher: <code>doctor</code> / <code>doctor</code>
          </Typography>
          <Typography variant="caption" sx={{ display: 'block', color: '#6b7280' }}>
            • Researcher: <code>admin</code> / <code>admin</code>
          </Typography>
        </Box>
      </Paper>
    </Box>
  )
}