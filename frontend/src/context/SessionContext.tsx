import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  Participant,
  Role,
  RouteOption,
  SurveyResponse,
  WalkPlan,
} from '../types'

/** Everything gathered during one walk flow, built up screen by screen. */
export interface WalkDraft {
  id: string
  startedAt: string
  preSurvey?: SurveyResponse
  plan?: WalkPlan
  route?: RouteOption
  actualMinutes?: number
}

interface SessionState {
  role: Role | null
  participant: Participant | null
  draft: WalkDraft | null
}

interface SessionContextValue extends SessionState {
  signIn: (role: Role, participant: Participant | null) => void
  signOut: () => void
  startDraft: () => WalkDraft
  updateDraft: (patch: Partial<WalkDraft>) => void
  clearDraft: () => void
}

const STORAGE_KEY = 'wm.session'

function load(): SessionState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as SessionState
  } catch {
    /* ignore */
  }
  return { role: null, participant: null, draft: null }
}

function persist(state: SessionState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>(load)

  const update = useCallback((patch: Partial<SessionState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch }
      persist(next)
      return next
    })
  }, [])

  const signIn = useCallback(
    (role: Role, participant: Participant | null) =>
      update({ role, participant, draft: null }),
    [update],
  )
  const signOut = useCallback(
    () => update({ role: null, participant: null, draft: null }),
    [update],
  )

  const startDraft = useCallback(() => {
    const draft: WalkDraft = {
      id: `w-${Date.now()}`,
      startedAt: new Date().toISOString(),
    }
    update({ draft })
    return draft
  }, [update])

  const updateDraft = useCallback(
    (patch: Partial<WalkDraft>) =>
      setState((prev) => {
        if (!prev.draft) return prev
        const next = { ...prev, draft: { ...prev.draft, ...patch } }
        persist(next)
        return next
      }),
    [],
  )
  const clearDraft = useCallback(() => update({ draft: null }), [update])

  const value = useMemo<SessionContextValue>(
    () => ({ ...state, signIn, signOut, startDraft, updateDraft, clearDraft }),
    [state, signIn, signOut, startDraft, updateDraft, clearDraft],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>')
  return ctx
}
