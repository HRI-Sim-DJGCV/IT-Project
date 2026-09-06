import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { saveAdminConditions } from '../../api'
import { Button, ErrorText, Field, TextInput } from '../../components/ui'
import type { ConditionSetting } from '../../types'
import { AdminLayout } from './AdminLayout'
import { useAdminData } from './useAdminData'

/** First unused letter A–Z; falls back to a numbered id if all are taken. */
function nextConditionId(existing: ConditionSetting[]): string {
  const taken = new Set(existing.map((c) => c.id))
  for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(65 + i)
    if (!taken.has(letter)) return letter
  }
  return `C${existing.length + 1}`
}

export function AdminSettings() {
  const navigate = useNavigate()
  const { conditions, loading, error } = useAdminData()

  // Local edits, only written back on Save. Null means "no edits yet", so the
  // screen shows the loaded conditions until the user changes something.
  const [edits, setEdits] = useState<ConditionSetting[] | null>(null)
  const draft = edits ?? conditions
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newVoice, setNewVoice] = useState('')
  const [newAge, setNewAge] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  function update(id: string, patch: Partial<ConditionSetting>) {
    setEdits(draft.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  function addCondition() {
    const age = Number(newAge)
    if (!newVoice.trim() || !Number.isFinite(age) || age <= 0) return
    const id = nextConditionId(draft)
    setEdits([...draft, { id, name: `Condition ${id}`, voice: newVoice.trim(), age }])
    setNewVoice('')
    setNewAge('')
  }

  async function save() {
    setSaving(true)
    setSaveError(null)
    try {
      await saveAdminConditions(draft)
      navigate('/admin')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save.')
    } finally {
      setSaving(false)
    }
  }

  const canAdd = newVoice.trim() !== '' && Number(newAge) > 0

  return (
    <AdminLayout title="Settings">
      <h2 className="text-lg font-bold text-ink">Conditions</h2>
      <p className="-mt-3 text-sm text-muted">
        Each condition has its own script voice. Changes apply to new walks only.
      </p>

      {error ? <ErrorText>{error}</ErrorText> : null}
      {loading ? <p className="text-sm text-muted">Loading…</p> : null}

      <div className="flex flex-col gap-4">
        {draft.map((cond) => {
          const editing = editingId === cond.id
          return (
            <div key={cond.id} className="overflow-hidden rounded-xl border border-line bg-card">
              <div className="bg-accent/40 px-4 py-2 text-sm font-bold text-ink">{cond.name}</div>
              <div className="flex flex-col gap-3 p-3">
                {editing ? (
                  <>
                    <Field label="Voice">
                      <TextInput value={cond.voice} onChange={(e) => update(cond.id, { voice: e.target.value })} />
                    </Field>
                    <Field label="Age">
                      <TextInput
                        type="number"
                        min={1}
                        inputMode="numeric"
                        value={cond.age}
                        onChange={(e) => update(cond.id, { age: Number(e.target.value) })}
                      />
                    </Field>
                    <Button variant="secondary" onClick={() => setEditingId(null)}>
                      Done
                    </Button>
                  </>
                ) : (
                  <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{cond.voice} voice</p>
                      <p className="text-sm text-muted">Age: {cond.age}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingId(cond.id)}
                      className="px-2 py-1 text-sm font-bold text-primary"
                      aria-label={`Edit ${cond.name}`}
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}

        <div className="overflow-hidden rounded-xl border border-line bg-card">
          <div className="border-b border-line px-4 py-2 text-sm font-medium text-muted">Add condition</div>
          <div className="flex flex-col gap-3 p-3">
            <Field label="Voice">
              <TextInput
                placeholder="e.g. Neutral"
                value={newVoice}
                onChange={(e) => setNewVoice(e.target.value)}
              />
            </Field>
            <Field label="Age">
              <TextInput
                type="number"
                min={1}
                inputMode="numeric"
                placeholder="e.g. 30"
                value={newAge}
                onChange={(e) => setNewAge(e.target.value)}
              />
            </Field>
            <Button variant="secondary" onClick={addCondition} disabled={!canAdd}>
              Add condition {nextConditionId(draft)}
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-2.5 pt-4">
        <ErrorText>{saveError}</ErrorText>
        <Button variant="secondary" onClick={() => navigate('/admin')} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={save} disabled={saving || loading || !!error}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </AdminLayout>
  )
}
