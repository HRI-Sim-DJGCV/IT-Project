import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Button as MuiButton,
  Card as MuiCard,
  Typography,
  TextField,
  Alert,
  IconButton
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
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-surface">
      {(title || back || right) && (
        <header
          className="sticky top-0 z-10 flex items-center gap-2 border-b border-line bg-surface/95 px-4 backdrop-blur"
          style={{ paddingTop: 'max(env(safe-area-inset-top), var(--safe-top, 12px))', paddingBottom: 12 }}
        >
          {back ? (
            <IconButton
              aria-label="Back"
              onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
              sx={{ ml: -1, color: 'primary.main' }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </IconButton>
          ) : null}
          <Typography variant="h6" className="flex-1 truncate text-ink" sx={{ fontWeight: 600 }}>
            {title}
          </Typography>
          {right}
        </header>
      )}
      <main className="flex flex-1 flex-col gap-5 px-4 py-5">{children}</main>
      {footer ? (
        <footer
          className="sticky bottom-0 border-t border-line bg-surface/95 px-4 pt-3 backdrop-blur"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}
        >
          {footer}
        </footer>
      ) : (
        <div style={{ height: 'env(safe-area-inset-bottom)' }} />
      )}
    </div>
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