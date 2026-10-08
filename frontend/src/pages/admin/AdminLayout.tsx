import type { ReactNode } from 'react'
import { Box, Button, Tab, Tabs } from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'
import { Screen } from '../../components/ui'
import { useSession } from '../../context/SessionContext'

const TABS = [
  { label: 'Dashboard', path: '/admin' },
  { label: 'Participants', path: '/admin/participants' },
  { label: 'Analytics', path: '/admin/analytics' },
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
        <Button
          variant="text"
          onClick={() => {
            signOut()
            navigate('/', { replace: true })
          }}
          sx={{ flexShrink: 0 }}
        >
          Log out
        </Button>
      }
    >
      <Box component="nav" aria-label="Admin sections" sx={{ minWidth: 0, borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={TABS.some((tab) => tab.path === pathname) ? pathname : false}
          onChange={(_, path: string) => navigate(path)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          aria-label="Admin sections"
          sx={{ '& .MuiTabs-scrollButtons': { width: 28 } }}
        >
          {TABS.map((tab) => (
            <Tab
              key={tab.path}
              value={tab.path}
              label={tab.label}
              aria-current={pathname === tab.path ? 'page' : undefined}
              sx={{ minWidth: 0, px: 1.5, minHeight: 48 }}
            />
          ))}
        </Tabs>
      </Box>
      {children}
    </Screen>
  )
}
