import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  AppBar,
  Box,
  Button as MuiButton,
  Card as MuiCard,
  IconButton,
  Paper,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material'

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

interface ScreenProps {
  title?: string
  back?: boolean | string
  children: ReactNode
  footer?: ReactNode
  right?: ReactNode
}

export function Screen({ title, back, children, footer, right }: ScreenProps) {
  const navigate = useNavigate()

  return (
    <Box
      sx={{
        bgcolor: 'background.default',
        display: 'flex',
        flexDirection: 'column',
        marginInline: 'auto',
        maxWidth: 430,
        minHeight: '100dvh',
        width: '100%',
      }}
    >
      {(title || back || right) && (
        <AppBar
          color="transparent"
          component="header"
          elevation={0}
          position="sticky"
          sx={{
            backdropFilter: 'blur(8px)',
            bgcolor: 'rgba(245, 245, 247, 0.95)',
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Toolbar
            disableGutters
            sx={{
              gap: 1,
              minHeight: 'auto',
              paddingBottom: 1.5,
              paddingInline: 2,
              paddingTop: 'max(env(safe-area-inset-top), var(--safe-top, 12px))',
            }}
          >
            {back ? (
              <IconButton
                aria-label="Back"
                color="primary"
                onClick={() =>
                  typeof back === 'string' ? navigate(back) : navigate(-1)
                }
                sx={{ marginLeft: -1 }}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </IconButton>
            ) : null}

            <Typography
              component="h1"
              noWrap
              sx={{ flex: 1, fontWeight: 600, minWidth: 0 }}
              variant="h6"
            >
              {title}
            </Typography>

            {right}
          </Toolbar>
        </AppBar>
      )}

      <Box
        component="main"
        sx={{
          display: 'flex',
          flex: 1,
          flexDirection: 'column',
          gap: 2.5,
          px: 2,
          py: 2.5,
        }}
      >
        {children}
      </Box>

      {footer ? (
        <Paper
          component="footer"
          elevation={0}
          square
          sx={{
            backdropFilter: 'blur(8px)',
            bgcolor: 'rgba(245, 245, 247, 0.95)',
            borderTop: 1,
            borderColor: 'divider',
            paddingBottom: 'max(env(safe-area-inset-bottom), 16px)',
            paddingInline: 2,
            paddingTop: 1.5,
            position: 'sticky',
            bottom: 0,
          }}
        >
          {footer}
        </Paper>
      ) : (
        <Box sx={{ height: 'env(safe-area-inset-bottom)' }} />
      )}
    </Box>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <MuiCard variant="outlined" className={className} sx={{ borderRadius: 3, p: 2, borderColor: 'divider', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
      {children}
    </MuiCard>
  )
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 600, display: 'block' }}>
      {children}
    </Typography>
  )
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  full?: boolean
}

export function Button({ variant = 'primary', full = true, className = '', children, ...rest }: ButtonProps) {
  const muiVariant = variant === 'ghost' ? 'text' : variant === 'secondary' ? 'outlined' : 'contained'
  const color = variant === 'danger' ? 'error' : 'primary'

  return (
    <MuiButton
      variant={muiVariant}
      color={color}
      fullWidth={full}
      className={className}
      disableElevation
      sx={{ height: 48, borderRadius: 3 }}
      onClick={rest.onClick}
      disabled={rest.disabled}
      type={rest.type as any}
    >
      {children}
    </MuiButton>
  )
}

interface FieldProps {
  label: string
  hint?: string
  children: ReactNode
}

export function Field({ label, hint, children }: FieldProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Typography variant="body2" sx={{ fontWeight: 500 }}>{label}</Typography>
      {children}
      {hint && <Typography variant="caption" color="text.secondary">{hint}</Typography>}
    </Box>
  )
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  (props, ref) => {
    return (
      <TextField
        {...(props as any)}
        inputRef={ref}
        variant="outlined"
        fullWidth
        InputProps={{ sx: { borderRadius: 3, backgroundColor: 'background.paper' } }}
      />
    )
  }
)

// log in drop down bug dennis WIP
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ children, className = '', ...props }, ref) => {
    return (
      <div className="relative w-full">
        <select
          ref={ref}
          {...props}
          className={`w-full appearance-none rounded-xl border border-line bg-white px-4 py-3.5 pr-10 text-ink shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 ${className}`}
        >
          {children}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    )
  }
)

interface ChipsProps<T extends string | number> {
  options: Array<{ value: T; label: string }>
  value: T | null
  onChange: (v: T) => void
  columns?: 2 | 3 | 4
}

export function Chips<T extends string | number>({ options, value, onChange, columns = 3 }: ChipsProps<T>) {
  const cols = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' }[columns]
  return (
    <div className={`grid ${cols} gap-2`} role="radiogroup">
      {options.map((o) => {
        const selected = o.value === value
        return (
          <MuiButton
            key={String(o.value)}
            variant={selected ? 'contained' : 'outlined'}
            color="primary"
            onClick={() => onChange(o.value)}
            disableElevation
            sx={{ borderRadius: 3, height: 44, textTransform: 'none', fontWeight: 500 }}
          >
            {o.label}
          </MuiButton>
        )
      })}
    </div>
  )
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <Alert severity="error" sx={{ borderRadius: 3 }}>
      {children}
    </Alert>
  )
}