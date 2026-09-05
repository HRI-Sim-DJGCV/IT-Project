import { useState, useEffect } from 'react'
import { Screen, Button } from '../../components/ui'
import { useSession } from '../../context/SessionContext'
import { useNavigate } from 'react-router-dom'
import type { AdminParticipantItem, ConditionSetting } from '../../types'
import { AdminAddParticipantModal } from './AdminAddParticipantModal'
import { getAdminConditions, getAdminParticipantsFeed } from '../../api'

export function AdminDashboard() {
  const navigate = useNavigate()
  const { signOut } = useSession()
  const [activeTab, setActiveTab] = useState<'dashboard' | 'participants' | 'settings'>('dashboard')
  
  const [conditions, setConditions] = useState<ConditionSetting[]>([])
  const [participants, setParticipants] = useState<AdminParticipantItem[]>([])
  const [showAddModal, setShowAddModal] = useState(false)

  useEffect(() => {
    async function loadData() {
      const [condData, partData] = await Promise.all([
        getAdminConditions(),
        getAdminParticipantsFeed()
      ])
      setConditions(condData)
      setParticipants(partData)
    }
    loadData()
  }, [])

  const handleExportCSV = () => {
    const headers = ['Participant ID', 'Condition', 'Status', 'Setup', 'Stress Start', 'Stress End']
    const rows = participants.map((p) => [
      p.id,
      p.condition,
      p.status,
      p.setup,
      p.stressStart ?? '-',
      p.stressEnd ?? '-',
    ])
    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', 'walking_meditation_trial_data.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleParticipantAdded = (newP: AdminParticipantItem) => {
    setParticipants((prev) => [newP, ...prev])
  }

  return (
    <Screen
      title="Admin Dashboard"
      right={
        <button
          type="button"
          onClick={() => {
            signOut()
            navigate('/', { replace: true })
          }}
          className="text-xs text-muted"
        >
          Log out
        </button>
      }
    >
      <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-primary text-sm font-medium">
        <button
          type="button"
          onClick={() => setActiveTab('dashboard')}
          className={`py-2 text-center transition ${
            activeTab === 'dashboard' ? 'bg-accent/60 font-semibold text-primary' : 'bg-card text-ink'
          }`}
        >
          Dashboard
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('participants')}
          className={`border-x border-primary py-2 text-center transition ${
            activeTab === 'participants' ? 'bg-accent/60 font-semibold text-primary' : 'bg-card text-ink'
          }`}
        >
          Participants
        </button>
        <button
          type="button"
          onClick={() => navigate('/admin/settings')}
          className={`py-2 text-center transition ${
            activeTab === 'settings' ? 'bg-accent/60 font-semibold text-primary' : 'bg-card text-ink'
          }`}
        >
          Settings
        </button>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-bold text-ink">Stress regulation trial</h2>
        <div className="grid grid-cols-2 gap-3">
          {conditions.map((c) => (
            <div key={c.id} className="rounded-xl border border-line bg-card p-3 shadow-xs">
              <p className="font-bold text-ink">{c.name}</p>
              <p className="text-xs text-muted mt-1">Voice: {c.voice.replace(' Voice', '')}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-bold text-ink">Recent Participants</h2>
        <div className="flex flex-col divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
          {participants.length === 0 ? (
             <div className="p-3.5 text-sm text-muted">Loading...</div>
          ) : (
            participants.map((p) => (
              <div key={p.id} className="p-3.5">
                <p className="font-bold text-ink text-sm">ID: {p.id}</p>
                <p className="text-xs text-muted mt-0.5">
                  Status: <span className="font-medium text-ink">{p.status}</span> | Setup: {p.setup}
                </p>
                <p className="text-xs text-muted mt-0.5">
                  Stress Start: {p.stressStart} | End: {p.stressEnd}
                </p>
              </div>
            ))
          )}
        </div>
      </section>

      <div className="mt-auto flex flex-col gap-2.5 pt-4">
        <Button variant="secondary" onClick={handleExportCSV}>
          Export CSV
        </Button>
        <Button onClick={() => setShowAddModal(true)}>Add participant</Button>
      </div>

      {showAddModal && (
        <AdminAddParticipantModal
          conditions={conditions}
          onClose={() => setShowAddModal(false)}
          onAdd={handleParticipantAdded}
        />
      )}
    </Screen>
  )
}