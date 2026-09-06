import { useState } from 'react'
import { Button } from '../../components/ui'
import { AdminAddParticipantModal } from './AdminAddParticipantModal'
import { AdminLayout } from './AdminLayout'
import { AdminParticipantList } from './AdminParticipantList'
import { useAdminData } from './useAdminData'

export function AdminParticipants() {
  const { conditions, participants, loading, error, addParticipant } = useAdminData()
  const [showAddModal, setShowAddModal] = useState(false)

  return (
    <AdminLayout title="Participants">
      <section className="flex flex-col gap-2">
        <h2 className="text-base font-bold text-ink">
          All participants{loading ? '' : ` (${participants.length})`}
        </h2>
        <AdminParticipantList participants={participants} loading={loading} error={error} />
      </section>

      <div className="mt-auto pt-4">
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
