import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Screen } from '../../components/ui'
import { useSession } from '../../context/SessionContext'

const TABS = [
  { label: 'Dashboard', path: '/admin' },
  { label: 'Participants', path: '/admin/participants' },
  { label: 'Settings', path: '/admin/settings' },
]

/** Shell for every admin screen: title, log-out, and the section tabs. */
export function AdminLayout({ title, children }: { title: string; children: ReactNode }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { signOut } = useSession()

  return (
    <Screen
      title={title}
      right={
        <button
          type="button"
          onClick={() => {
            signOut()
            navigate('/', { replace: true })
          }}
          className="text-sm text-muted"
        >
          Log out
        </button>
      }
    >
      <nav
        aria-label="Admin sections"
        className="grid grid-cols-3 overflow-hidden rounded-lg border border-primary text-sm font-medium"
      >
        {TABS.map((tab, i) => {
          const active = pathname === tab.path
          return (
            <button
              key={tab.path}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => navigate(tab.path)}
              className={`py-2 text-center transition ${i === 1 ? 'border-x border-primary' : ''} ${
                active ? 'bg-accent/60 font-semibold text-primary' : 'bg-card text-ink'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </nav>
      {children}
    </Screen>
  )
}
