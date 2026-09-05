import { useState } from 'react'
import { Button, TextInput } from '../../components/ui'
import type { AdminParticipantItem, ConditionSetting } from '../../types'

interface Props {
  conditions: ConditionSetting[]
  onClose: () => void
  onAdd: (participant: AdminParticipantItem) => void
}

export function AdminAddParticipantModal({ conditions, onClose, onAdd }: Props) {
  const [participantId, setParticipantId] = useState('')
  const [selectedCondition, setSelectedCondition] = useState<string>(conditions[0]?.id ?? 'A')
  const [healthNotes, setHealthNotes] = useState('')
  const [generatedCode, setGeneratedCode] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!participantId.trim()) return

    const code = `${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`

    const newParticipant: AdminParticipantItem = {
      id: participantId.trim(),
      condition: selectedCondition,
      status: 'Not started',
      setup: 1,
      stressStart: '-',
      stressEnd: '-',
      healthNotes,
      accessCode: code,
    }

    onAdd(newParticipant)
    setGeneratedCode(code)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-xl">
        {!generatedCode ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <h2 className="text-xl font-bold text-ink">Add participant</h2>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-ink">Participant ID</label>
              <TextInput
                placeholder="e.g. AAA004"
                value={participantId}
                onChange={(e) => setParticipantId(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-ink">Assign condition</label>
              <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-line">
                {['A', 'B', 'C'].map((cond, idx) => (
                  <button
                    key={cond}
                    type="button"
                    onClick={() => setSelectedCondition(cond)}
                    className={`py-2 text-sm font-semibold transition ${
                      selectedCondition === cond
                        ? 'bg-accent/70 text-primary'
                        : 'bg-surface text-muted hover:bg-line'
                    } ${idx !== 0 ? 'border-l border-line' : ''}`}
                  >
                    {cond}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-ink">Health notes</label>
              <textarea
                rows={4}
                className="w-full rounded-xl border border-line bg-card p-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-accent"
                value={healthNotes}
                onChange={(e) => setHealthNotes(e.target.value)}
                placeholder="Enter clinical notes or study contraindications..."
              />
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">Add & generate access code</Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center py-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700 text-xl font-bold">
              ✓
            </div>
            <h3 className="text-lg font-bold text-ink">Participant Created</h3>
            <p className="text-xs text-muted">
              Share this single-use code with participant <b>{participantId}</b>:
            </p>
            <div className="w-full rounded-xl bg-surface py-3 text-center text-lg font-mono font-bold tracking-widest text-primary border border-line">
              {generatedCode}
            </div>
            <Button onClick={onClose} className="mt-2">
              Done
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}