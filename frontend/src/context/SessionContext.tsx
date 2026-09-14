import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { getMe } from '../api'
import { setAuthToken, setUnauthorizedHandler } from '../api/http'
import type { GeneratedScript, Participant, Role, RouteOption, SurveyResponse, WalkPlan } from '../types'

/** Everything gathered during one walk flow, built up screen by screen. */
export interface WalkDraft {
  id: string
  startedAt: string
  preSurvey?: SurveyResponse
  plan?: WalkPlan
  route?: RouteOption
  /** Set once the server has started generating this walk's script and audio */
  preparationId?: string
  /** The generated script, copied here when the preparation is ready */
  script?: GeneratedScript
  actualMinutes?: number
}

interface SessionState {
  token: string | null
  expiresAt: string | null
  role: Role | null
  participant: Participant | null
  draft: WalkDraft | null
}

interface SessionContextValue extends SessionState {
  /** True while a stored token is being checked against the server on first load */
  restoring: boolean
  signIn: (auth: { token: string; expiresAt: string; role: Role; participant: Participant | null }) => void
  signOut: () => void
  startDraft: () => WalkDraft
  updateDraft: (patch: Partial<WalkDraft>) => void
  clearDraft: () => void
}

const STORAGE_KEY = 'wm.session'
const EMPTY: SessionState = { token: null, expiresAt: null, role: null, participant: null, draft: null }

function load(): SessionState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = { ...EMPTY, ...(JSON.parse(raw) as Partial<SessionState>) }
      // An expired token is as good as none.
      if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() <= Date.now()) return EMPTY
      return parsed
    }
  } catch {
    /* ignore */
  }
  return EMPTY
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
  const [state, setState] = useState<SessionState>(() => {
    const s = load()
    setAuthToken(s.token)
    return s
  })
  const [restoring, setRestoring] = useState(() => state.token !== null)

  const update = useCallback((patch: Partial<SessionState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch }
      persist(next)
      setAuthToken(next.token)
      return next
    })
  }, [])

  const signIn = useCallback<SessionContextValue['signIn']>(
    ({ token, expiresAt, role, participant }) => update({ token, expiresAt, role, participant, draft: null }),
    [update],
  )
  const signOut = useCallback(() => update(EMPTY), [update])

  // The API layer calls this when a token is rejected, so every screen drops back to login.
  useEffect(() => {
    setUnauthorizedHandler(signOut)
    return () => setUnauthorizedHandler(null)
  }, [signOut])

  // On first load with a stored token, confirm it is still valid (and pick up a changed condition).
  useEffect(() => {
    if (!restoring) return
    let cancelled = false
    getMe()
      .then((me) => {
        if (!cancelled) update({ role: me.role, participant: me.participant })
      })
      .catch(() => {
        if (!cancelled) signOut()
      })
      .finally(() => {
        if (!cancelled) setRestoring(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startDraft = useCallback(() => {
    const draft: WalkDraft = { id: `w-${Date.now()}`, startedAt: new Date().toISOString() }
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
    () => ({ ...state, restoring, signIn, signOut, startDraft, updateDraft, clearDraft }),
    [state, restoring, signIn, signOut, startDraft, updateDraft, clearDraft],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>')
  return ctx
}
