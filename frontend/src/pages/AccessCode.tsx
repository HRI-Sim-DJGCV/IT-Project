import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { redeemAccessCode } from '../api'
import { Button, ErrorText, Field, Screen, TextInput } from '../components/ui'
import { useSession } from '../context/SessionContext'

/**
 * A participant's first login. The research team gives them their ID and a
 * single-use access code; redeeming it here sets their password.
 */
export function AccessCode() {
  const navigate = useNavigate()
  const { signIn } = useSession()
  const [userId, setUserId] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mismatch = confirm.length > 0 && confirm !== password
  const tooShort = password.length > 0 && password.length < 8

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (mismatch || tooShort) return
    setBusy(true)
    setError(null)
    try {
      const res = await redeemAccessCode(userId, code, password)
      signIn(res)
      navigate('/home', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not redeem the code.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen title="Access with code" back="/">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-muted">
          Enter the participant ID and the one-time access code the research team gave you, then choose a password for
          future logins.
        </p>
        <Field label="Participant ID">
          <TextInput
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            autoComplete="username"
            autoCapitalize="characters"
            placeholder="e.g. AAA001"
            required
          />
        </Field>
        <Field label="Access code">
          <TextInput
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            autoCapitalize="characters"
            autoComplete="one-time-code"
            placeholder="e.g. A1B2-C3D4"
            required
          />
        </Field>
        <Field label="New password" hint="At least 8 characters">
          <TextInput
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </Field>
        <Field label="Confirm password">
          <TextInput
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />
        </Field>
        <ErrorText>{error ?? (mismatch ? 'Passwords do not match.' : tooShort ? 'Password must be at least 8 characters.' : null)}</ErrorText>
        <Button type="submit" disabled={busy || mismatch || tooShort}>
          {busy ? 'Setting up…' : 'Set password and log in'}
        </Button>
      </form>
    </Screen>
  )
}
