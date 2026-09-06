import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAdminWalks } from '../../api'
import { Button, ErrorText } from '../../components/ui'
import { AdminAddParticipantModal } from './AdminAddParticipantModal'
import { AdminLayout } from './AdminLayout'
import { AdminParticipantList } from './AdminParticipantList'
import { downloadCsv, walksToCsv } from './exportCsv'
import { useAdminData } from './useAdminData'

const RECENT_COUNT = 3

export function AdminDashboard() {
  const navigate = useNavigate()
  const { conditions, participants, loading, error, addParticipant } = useAdminData()
  const [showAddModal, setShowAddModal] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  async function exportCsv() {
    setExporting(true)
    setExportError(null)
    try {
      const walks = await getAdminWalks()
      const stamp = new Date().toISOString().slice(0, 10)
      downloadCsv(`walking_meditation_walks_${stamp}.csv`, walksToCsv(walks))
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <AdminLayout title="Admin Dashboard">
      <section className="flex flex-col gap-2">
        <h2 className="text-base font-bold text-ink">Stress regulation trial</h2>
        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {conditions.map((c) => (
              <div key={c.id} className="rounded-xl border border-line bg-card p-3">
                <p className="font-bold text-ink">{c.name}</p>
                <p className="mt-1 text-xs text-muted">Voice: {c.voice}</p>
                <p className="text-xs text-muted">
                  Participants: {participants.filter((p) => p.condition === c.id).length}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-bold text-ink">Recent participants</h2>
          {participants.length > RECENT_COUNT ? (
            <button type="button" onClick={() => navigate('/admin/participants')} className="text-xs text-primary">
              View all ({participants.length})
            </button>
          ) : null}
        </div>
        <AdminParticipantList
          participants={participants.slice(0, RECENT_COUNT)}
          loading={loading}
          error={error}
        />
      </section>

      <div className="mt-auto flex flex-col gap-2.5 pt-4">
        <ErrorText>{exportError}</ErrorText>
        <Button variant="secondary" onClick={exportCsv} disabled={exporting}>
          {exporting ? 'Preparing…' : 'Export CSV (one row per walk)'}
        </Button>
        <Button onClick={() => setShowAddModal(true)} disabled={loading || !!error}>
          Add participant
        </Button>
      </div>

      {showAddModal ? (
        <AdminAddParticipantModal
          conditions={conditions}
          onClose={() => setShowAddModal(false)}
          onAdded={addParticipant}
        />
      ) : null}
    </AdminLayout>
  )
}
