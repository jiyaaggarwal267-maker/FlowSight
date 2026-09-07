import { Suspense, lazy, useEffect } from "react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import PublicLayout from "./layouts/PublicLayout.jsx"
import AnalystLayout from "./layouts/AnalystLayout.jsx"
import AdminLayout from "./layouts/AdminLayout.jsx"
import CommandPalette from "./components/CommandPalette.jsx"
import Skeleton from "./components/Skeleton.jsx"
import { initTheme } from "./lib/runtime.js"

const Landing = lazy(() => import("./pages/public/Landing.jsx"))
const NetworkGraphPublic = lazy(() => import("./pages/public/NetworkGraphPublic.jsx"))
const Login = lazy(() => import("./pages/public/Login.jsx"))
const AnalystOverview = lazy(() => import("./pages/analyst/AnalystOverview.jsx"))
const NetworkExplorer = lazy(() => import("./pages/analyst/NetworkExplorer.jsx"))
const AlertsTriage = lazy(() => import("./pages/analyst/AlertsTriage.jsx"))
const InvestigationView = lazy(() => import("./pages/analyst/InvestigationView.jsx"))
const FlowTimeline = lazy(() => import("./pages/analyst/FlowTimeline.jsx"))
const EntityProfile = lazy(() => import("./pages/analyst/EntityProfile.jsx"))
const AiInvestigator = lazy(() => import("./pages/analyst/AiInvestigator.jsx"))
const InvestigationReports = lazy(() => import("./pages/analyst/InvestigationReports.jsx"))
const AdminOverview = lazy(() => import("./pages/admin/AdminOverview.jsx"))
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers.jsx"))
const AdminRules = lazy(() => import("./pages/admin/AdminRules.jsx"))
const AdminAuditLogs = lazy(() => import("./pages/admin/AdminAuditLogs.jsx"))
const AdminHealth = lazy(() => import("./pages/admin/AdminHealth.jsx"))
const AnalystSettings = lazy(() => import("./pages/analyst/Settings.jsx"))
const AdminSettings = lazy(() => import("./pages/admin/Settings.jsx"))

function PageLoading() {
  return (
    <div className="flex flex-col gap-space-base p-space-lg">
      <Skeleton className="h-6 w-64" />
      <Skeleton className="h-14 w-full" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-space-base">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
      <Skeleton className="h-56 w-full" />
    </div>
  )
}

function App() {
  useEffect(() => {
    initTheme()
  }, [])

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Landing />} />
            <Route path="/network-graph" element={<NetworkGraphPublic />} />
            <Route path="/login" element={<Login />} />
          </Route>
          <Route path="/analyst" element={<AnalystLayout />}>
            <Route index element={<AnalystOverview />} />
            <Route path="overview" element={<AnalystOverview />} />
            <Route path="network-explorer" element={<NetworkExplorer />} />
            <Route path="alerts" element={<AlertsTriage />} />
            <Route path="investigations/:id" element={<InvestigationView />} />
            <Route path="flow-timeline" element={<FlowTimeline />} />
            <Route path="entities/:id" element={<EntityProfile />} />
            <Route path="ai-investigator" element={<AiInvestigator />} />
            <Route path="reports" element={<InvestigationReports />} />
            <Route path="settings" element={<AnalystSettings />} />
          </Route>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminOverview />} />
            <Route path="overview" element={<AdminOverview />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="rules" element={<AdminRules />} />
            <Route path="audit-logs" element={<AdminAuditLogs />} />
            <Route path="health" element={<AdminHealth />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <CommandPalette />
      </Suspense>
    </BrowserRouter>
  )
}

export default App