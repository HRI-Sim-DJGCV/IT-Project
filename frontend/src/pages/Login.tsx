import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../api'
import { Button, ErrorText, Field, Screen, Select, TextInput } from '../components/ui'
import { useSession } from '../context/SessionContext'
import type { Role } from '../types'

const ROLES: Array<{ value: Role; label: string }> = [
  { value: 'participant', label: 'Participant' },
  { value: 'medical_professional', label: 'Medical professional' },
  { value: 'researcher', label: 'Research admin' },
]

export function Login() {
  const navigate = useNavigate()
  const { signIn } = useSession()
  const [role, setRole] = useState<Role | ''>('')
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!role) return
    setBusy(true)
    setError(null)
    try {
      const res = await login(role, userId, password)
      signIn(res.role, res.participant)
      navigate(res.role === 'participant' ? '/home' : '/admin', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen title="Log in" back="/">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field label="Log in as">
          <Select value={role} onChange={(e) => setRole(e.target.value as Role)} required>
            <option value="" disabled>
              Select role
            </option>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>

        {role ? (
          <>
            <Field label="User ID">
              <TextInput
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                autoComplete="username"
                autoCapitalize="characters"
                placeholder={role === 'participant' ? 'demo' : 'admin'}
                required
              />
            </Field>
            <Field label="Password">
              <TextInput
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </Field>
            <ErrorText>{error}</ErrorText>
            <Button type="submit" disabled={busy}>
              {busy ? 'Logging in…' : 'Log in'}
            </Button>
            <p className="text-center text-xs text-muted">
              {role === 'participant'
                ? 'Demo: user ID “demo”, password “demo”'
                : role === 'researcher'
                  ? 'Demo: user ID “admin”, password “admin”'
                  : 'Demo: user ID “doctor”, password “doctor”'}
            </p>
          </>
        ) : null}
      </form>
    </Screen>
  )
}
