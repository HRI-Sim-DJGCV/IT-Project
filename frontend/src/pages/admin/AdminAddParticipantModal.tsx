import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { createAdminParticipant } from '../../api'
import { Button, Chips, ErrorText } from '../../components/ui'
import type { AdminParticipantItem, ConditionSetting, CreateParticipantResult } from '../../types'

interface Props {
  conditions: ConditionSetting[]
  onClose: () => void
  /** Called once the participant exists on the server (mock), before the code is shown. */
  onAdded: (participant: AdminParticipantItem) => void
}

/**
 * Creates a participant. The server assigns the AAA### id and returns the
 * single-use access code once, so the admin only chooses the condition.
 */
export function AdminAddParticipantModal({ conditions, onClose, onAdded }: Props) {
  const titleId = useId()
  const conditionLabelId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const [condition, setCondition] = useState<string | null>(conditions[0]?.id ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CreateParticipantResult | null>(null)

  useEffect(() => {
    panelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!condition) return
    setBusy(true)
    setError(null)
    try {
      const res = await createAdminParticipant(condition)
      onAdded(res.participant)
      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create participant.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-xl outline-none"
      >
        {!result ? (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <h2 id={titleId} className="text-xl font-bold text-ink">
              Add participant
            </h2>
            <p className="text-sm text-muted">
              A participant ID will be assigned automatically and a single-use access code generated.
            </p>

            <div className="flex flex-col gap-1.5" role="group" aria-labelledby={conditionLabelId}>
              <span id={conditionLabelId} className="text-sm font-medium">
                Assign condition
              </span>
              {conditions.length === 0 ? (
                <p className="text-sm text-muted">Add a condition in Settings first.</p>
              ) : (
                <Chips
                  options={conditions.map((c) => ({ value: c.id, label: c.name }))}
                  value={condition}
                  onChange={setCondition}
                  columns={conditions.length >= 3 ? 3 : 2}
                />
              )}
            </div>

            <ErrorText>{error}</ErrorText>

            <div className="flex flex-col gap-2 pt-2">
              <Button variant="secondary" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !condition}>
                {busy ? 'Creating…' : 'Add & generate access code'}
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <div
              aria-hidden="true"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-xl font-bold text-green-700"
            >
              ✓
            </div>
            <h2 id={titleId} className="text-lg font-bold text-ink">
              Participant created
            </h2>
            <p className="text-sm text-muted">
              Share this single-use code with participant <b>{result.participant.id}</b>. It will not be shown again.
            </p>
            <p className="w-full rounded-xl border border-line bg-surface py-3 text-center font-mono text-lg font-bold tracking-widest text-primary">
              {result.accessCode}
            </p>
            <Button onClick={onClose} className="mt-2">
              Done
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
