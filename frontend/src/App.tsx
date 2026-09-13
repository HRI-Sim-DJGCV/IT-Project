import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { SessionProvider, useSession } from './context/SessionContext'
import { AccessCode } from './pages/AccessCode'
import { Account } from './pages/Account'
import { History } from './pages/History'
import { Home } from './pages/Home'
import { Landing } from './pages/Landing'
import { Login } from './pages/Login'
import { RequestAccessStub } from './pages/Stubs'
import { Done } from './pages/walk/Done'
import { Plan } from './pages/walk/Plan'
import { PostSurvey } from './pages/walk/PostSurvey'
import { PreSurvey } from './pages/walk/PreSurvey'
import { Prepare } from './pages/walk/Prepare'
import { Progress } from './pages/walk/Progress'
import { SelectRoute } from './pages/walk/SelectRoute'
import { AdminDashboard } from './pages/admin/AdminDashboard'
import { AdminParticipants } from './pages/admin/AdminParticipants'
import { AdminSettings } from './pages/admin/AdminSettings'

function Restoring() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] items-center justify-center bg-surface">
      <p className="text-sm text-muted">Loading…</p>
    </div>
  )
}

function RequireParticipant() {
  const { role, participant, restoring } = useSession()
  if (restoring) return <Restoring />
  if (role !== 'participant' || !participant) return <Navigate to="/login" replace />
  return <Outlet />
}

function RequireDraft() {
  const { draft } = useSession()
  if (!draft) return <Navigate to="/home" replace />
  return <Outlet />
}

function RequireAdmin() {
  const { role, restoring } = useSession()
  if (restoring) return <Restoring />
  if (!role || role === 'participant') return <Navigate to="/login" replace />
  return <Outlet />
}

export default function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/request-access" element={<RequestAccessStub />} />
          <Route path="/access-code" element={<AccessCode />} />

          <Route element={<RequireParticipant />}>
            <Route path="/home" element={<Home />} />
            <Route path="/history" element={<History />} />
            <Route path="/account" element={<Account />} />
            <Route path="/walk/done" element={<Done />} />
            <Route element={<RequireDraft />}>
              <Route path="/walk/pre-survey" element={<PreSurvey />} />
              <Route path="/walk/plan" element={<Plan />} />
              <Route path="/walk/select" element={<SelectRoute />} />
              <Route path="/walk/prepare" element={<Prepare />} />
              <Route path="/walk/progress" element={<Progress />} />
              <Route path="/walk/post-survey" element={<PostSurvey />} />
            </Route>
          </Route>

          <Route element={<RequireAdmin />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/participants" element={<AdminParticipants />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  )
}
