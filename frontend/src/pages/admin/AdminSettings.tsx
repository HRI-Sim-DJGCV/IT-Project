import { useState, useEffect } from 'react'
import { Screen, Button } from '../../components/ui'
import { useNavigate } from 'react-router-dom'
import type { ConditionSetting } from '../../types'
import { getAdminConditions } from '../../api'

export function AdminSettings() {
  const navigate = useNavigate()
  const [conditions, setConditions] = useState<ConditionSetting[]>([])
  const [newVoice, setNewVoice] = useState('')
  const [newAge, setNewAge] = useState<number | ''>('')

  useEffect(() => {
    getAdminConditions().then(setConditions)
  }, [])

  const handleAddCondition = () => {
    if (!newVoice || !newAge) return
    const nextLetter = String.fromCharCode(65 + conditions.length) 
    setConditions((prev) => [
      ...prev,
      {
        id: nextLetter,
        name: `Condition ${nextLetter}`,
        voice: newVoice,
        age: Number(newAge),
      },
    ])
    setNewVoice('')
    setNewAge('')
  }

  return (
    <Screen title="Admin Dashboard">
      <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-primary text-sm font-medium">
        <button
          type="button"
          onClick={() => navigate('/admin')}
          className="bg-card py-2 text-center text-ink transition"
        >
          Dashboard
        </button>
        <button
          type="button"
          onClick={() => navigate('/admin')}
          className="border-x border-primary bg-card py-2 text-center text-ink transition"
        >
          Participants
        </button>
        <button type="button" className="bg-accent/60 py-2 text-center font-semibold text-primary">
          Settings
        </button>
      </div>

      <h2 className="text-lg font-bold text-ink">Setup Settings</h2>

      <div className="flex flex-col gap-4">
        {conditions.map((cond) => (
          <div key={cond.id} className="overflow-hidden rounded-xl border border-line bg-card">
            <div className="bg-accent/40 px-4 py-2 text-sm font-bold text-ink">{cond.name}</div>
            <div className="p-3">
              <div className="rounded-lg border border-line divide-y divide-line">
                <div className="px-3 py-2 text-sm font-medium">{cond.voice}</div>
                <div className="flex items-center justify-between px-3 py-1.5">
                  <span className="text-sm text-muted">Age: {cond.age}</span>
                  <button type="button" className="text-sm font-bold text-primary px-2 py-1">
                    Edit
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}

        <div className="overflow-hidden rounded-xl border border-line bg-card">
          <div className="border-b border-line px-4 py-2 text-sm font-medium text-muted">
            Add condition...
          </div>
          <div className="p-3">
            <div className="rounded-lg border border-line overflow-hidden">
              <input
                type="text"
                placeholder="Voice (e.g. Neutral Voice)"
                value={newVoice}
                onChange={(e) => setNewVoice(e.target.value)}
                className="w-full border-b border-line px-3 py-2 text-sm outline-none"
              />
              <div className="flex items-center">
                <input
                  type="number"
                  placeholder="Age"
                  value={newAge}
                  onChange={(e) => setNewAge(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddCondition}
                  className="bg-primary px-5 py-2.5 text-sm font-semibold text-white active:bg-primary-hover"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-2.5 pt-4">
        <Button variant="secondary" onClick={() => navigate('/admin')}>
          Cancel
        </Button>
        <Button onClick={() => navigate('/admin')}>Save changes</Button>
      </div>
    </Screen>
  )
}