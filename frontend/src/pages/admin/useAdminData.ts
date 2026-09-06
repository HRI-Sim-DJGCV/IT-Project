import { useCallback, useEffect, useState } from 'react'
import { getAdminConditions, getAdminParticipants } from '../../api'
import type { AdminParticipantItem, ConditionSetting } from '../../types'

/** Loads conditions and the participant list once per screen, with loading and error state. */
export function useAdminData() {
  const [conditions, setConditions] = useState<ConditionSetting[]>([])
  const [participants, setParticipants] = useState<AdminParticipantItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    Promise.all([getAdminConditions(), getAdminParticipants()])
      .then(([c, p]) => {
        if (cancelled) return
        setConditions(c)
        setParticipants(p)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load data.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const reload = useCallback(() => {
    setLoading(true)
    setError(null)
    setReloadKey((k) => k + 1)
  }, [])

  /** Optimistically prepend a participant returned by `createAdminParticipant`. */
  const addParticipant = useCallback(
    (p: AdminParticipantItem) => setParticipants((prev) => [p, ...prev.filter((x) => x.id !== p.id)]),
    [],
  )

  return { conditions, participants, loading, error, reload, addParticipant }
}
