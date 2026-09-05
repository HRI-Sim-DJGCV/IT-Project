import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { useNavigate } from 'react-router-dom'

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

/** Phone-sized page shell with safe-area padding and optional sticky footer. */
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
            <button
              type="button"
              aria-label="Back"
              onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
              className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-primary active:bg-line"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          ) : null}
          <h1 className="flex-1 truncate text-lg font-semibold">{title}</h1>
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
    <div className={`rounded-2xl border border-line bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${className}`}>
      {children}
    </div>
  )
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-wide text-muted">{children}</p>
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  full?: boolean
}

export function Button({ variant = 'primary', full = true, className = '', ...rest }: ButtonProps) {
  const base =
    'inline-flex h-12 items-center justify-center rounded-xl px-5 text-base font-semibold transition active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100'
  const styles = {
    primary: 'bg-primary text-white active:bg-primary-hover',
    secondary: 'border border-primary bg-card text-primary active:bg-accent',
    ghost: 'bg-transparent text-primary underline-offset-4 active:underline',
    danger: 'bg-red-600 text-white active:bg-red-700',
  }[variant]
  return <button type="button" {...rest} className={`${base} ${styles} ${full ? 'w-full' : ''} ${className}`} />
}

interface FieldProps {
  label: string
  hint?: string
  children: ReactNode
}

export function Field({ label, hint, children }: FieldProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </label>
  )
}

const inputClass =
  'h-12 w-full rounded-xl border border-line bg-card px-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-accent'

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ''}`} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputClass} appearance-none ${props.className ?? ''}`} />
}

interface ChipsProps<T extends string | number> {
  options: Array<{ value: T; label: string }>
  value: T | null
  onChange: (v: T) => void
  columns?: 2 | 3 | 4
}

/** Single-select pill group — better for thumbs than a native select. */
export function Chips<T extends string | number>({ options, value, onChange, columns = 3 }: ChipsProps<T>) {
  const cols = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' }[columns]
  return (
    <div className={`grid ${cols} gap-2`} role="radiogroup">
      {options.map((o) => {
        const selected = o.value === value
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={`h-11 rounded-xl border px-2 text-sm font-medium transition active:scale-[0.97] ${
              selected ? 'border-primary bg-primary text-white' : 'border-line bg-card text-ink'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
      {children}
    </p>
  )
}
