import React, { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './features/auth/AuthContext'
import Login from './pages/Login'
import AppLayout from './layouts/AppLayout'
import LoadingCard from './components/ui/LoadingCard'
import type { AppRole } from './features/auth/auth.types'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Employees = lazy(() => import('./pages/Employees'))
const Projects = lazy(() => import('./pages/Projects'))
const ProjectDetails = lazy(() => import('./pages/ProjectDetails'))
const WorkItems = lazy(() => import('./pages/WorkItems'))
const WorkItemDetails = lazy(() => import('./pages/WorkItemDetails'))
const Notifications = lazy(() => import('./pages/Notifications'))
const Conversations = lazy(() => import('./pages/Conversations'))
const Sprints = lazy(() => import('./pages/Sprints'))
const SprintDetails = lazy(() => import('./pages/SprintDetails'))
const WorkTypes = lazy(() => import('./pages/WorkTypes'))
const DailyResultsReport = lazy(() => import('./pages/DailyResultsReport'))
const DailyWork = lazy(() => import('./pages/DailyWork'))
const MyDay = lazy(() => import('./pages/MyDay'))
const TeamToday = lazy(() => import('./pages/TeamToday'))
const EmployeeWorkDetail = lazy(() => import('./pages/EmployeeWorkDetail'))
const EmployeeTargetHistory = lazy(() => import('./pages/EmployeeTargetHistory'))
const CompanyCommandCenter = lazy(() => import('./pages/CompanyCommandCenter'))
const EmployeePerformance = lazy(() => import('./pages/EmployeePerformance'))
const OrganizationSettings = lazy(() => import('./pages/OrganizationSettings'))
const ManagerDashboard = lazy(() => import('./pages/manager/ManagerDashboard'))
const EmployeeDashboard = lazy(() => import('./pages/employee/EmployeeDashboard'))
const MyWorkload = lazy(() => import('./pages/employee/MyWorkload'))
const CompanyOperations = lazy(() => import('./pages/CompanyOperations'))
const CompanyTargetAnalytics = lazy(() => import('./pages/CompanyTargetAnalytics'))
const DailyExecutionBoard = lazy(() => import('./pages/DailyExecutionBoard'))
const SetDailyTarget = lazy(() => import('./pages/SetDailyTarget'))
const ProjectSetDailyTarget = lazy(() => import('./pages/ProjectSetDailyTarget'))
const WorkDistribution = lazy(() => import('./pages/WorkDistribution'))
const AdminWorkboard = lazy(() => import('./pages/AdminWorkboard'))
const Reports = lazy(() => import('./pages/Reports'))
const Settings = lazy(() => import('./pages/Settings'))

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { accessToken, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">
        Loading workspace...
      </div>
    )
  }

  if (!accessToken) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function RoleRoute({ roles, children }: { roles: AppRole[]; children: React.ReactNode }) {
  const { profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">
        Loading workspace...
      </div>
    )
  }

  if (profile && !roles.includes(profile.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Unhandled UI Error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xl max-w-md w-full text-center space-y-4">
            <h2 className="text-xl font-bold text-rose-700">Something went wrong</h2>
            <p className="text-xs text-slate-500">
              {this.state.error?.message || 'An unexpected error occurred while loading this view.'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.href = '/dashboard'
              }}
              className="px-5 py-2.5 bg-[#801424] hover:bg-[#9f1239] text-white font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
            <LoadingCard message="Loading workspace..." />
          </div>
        }
      >
        <Routes>
          <Route
            path="/login"
            element={<Login />}
          />

          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route
              path="/dashboard"
              element={<Dashboard />}
            />

            <Route
              path="/work-overview"
              element={<Dashboard />}
            />

            <Route
              path="/manager-dashboard"
              element={
                <RoleRoute roles={['SUPER_ADMIN', 'ADMIN', 'MANAGER']}>
                  <ManagerDashboard />
                </RoleRoute>
              }
            />

            <Route
              path="/manager/dashboard"
              element={
                <RoleRoute roles={['SUPER_ADMIN', 'ADMIN', 'MANAGER']}>
                  <ManagerDashboard />
                </RoleRoute>
              }
            />

            <Route
              path="/employee-dashboard"
              element={
                <RoleRoute roles={['EMPLOYEE']}>
                  <EmployeeDashboard />
                </RoleRoute>
              }
            />

            <Route
              path="/employee/dashboard"
              element={
                <RoleRoute roles={['EMPLOYEE']}>
                  <EmployeeDashboard />
                </RoleRoute>
              }
            />

            <Route
              path="/my-workload"
              element={<MyWorkload />}
            />

            <Route
              path="/employees"
              element={
                <RoleRoute roles={['SUPER_ADMIN', 'ADMIN', 'MANAGER']}>
                  <Employees />
                </RoleRoute>
              }
            />

            <Route
              path="/projects"
              element={<Projects />}
            />

            <Route
              path="/projects/:projectId/set-target"
              element={
                <RoleRoute roles={['SUPER_ADMIN', 'ADMIN', 'MANAGER']}>
                  <ProjectSetDailyTarget />
                </RoleRoute>
              }
            />

            <Route
              path="/projects/:projectId"
              element={<ProjectDetails />}
            />

            <Route
              path="/work"
              element={<WorkItems />}
            />

            <Route
              path="/work-items/:id"
              element={<WorkItemDetails />}
            />

            <Route
              path="/work/:id"
              element={<WorkItemDetails />}
            />

            <Route
              path="/notifications"
              element={<Notifications />}
            />

            <Route
              path="/conversations"
              element={<Conversations />}
            />

            <Route
              path="/sprints"
              element={<Sprints />}
            />

            <Route
              path="/sprints/:sprintId"
              element={<SprintDetails />}
            />

            <Route
              path="/work-types"
              element={
                <RoleRoute roles={['SUPER_ADMIN', 'ADMIN', 'MANAGER']}>
                  <WorkTypes />
                </RoleRoute>
              }
            />

            <Route
              path="/reports"
              element={<Reports />}
            />

            <Route
              path="/daily-results"
              element={<DailyResultsReport />}
            />

            <Route
              path="/daily-work"
              element={<DailyWork />}
            />

            <Route
              path="/my-day"
              element={<MyDay />}
            />

            <Route
              path="/admin-workboard"
              element={
                <RoleRoute roles={['SUPER_ADMIN', 'ADMIN', 'MANAGER']}>
                  <AdminWorkboard />
                </RoleRoute>
              }
            />

            <Route
              path="/work-distribution"
              element={
                <RoleRoute roles={['SUPER_ADMIN', 'ADMIN', 'MANAGER']}>
                  <WorkDistribution />
                </RoleRoute>
              }
            />

            <Route
              path="/set-daily-target"
              element={
                <RoleRoute roles={['SUPER_ADMIN', 'ADMIN', 'MANAGER']}>
                  <SetDailyTarget />
                </RoleRoute>
              }
            />

            <Route
              path="/team-today"
              element={<TeamToday />}
            />

            <Route
              path="/employees/:employeeId/work"
              element={<EmployeeWorkDetail />}
            />

            <Route
              path="/employees/:employeeId/target-history"
              element={<EmployeeTargetHistory />}
            />

            <Route
              path="/my-target-history"
              element={<EmployeeTargetHistory />}
            />

            <Route
              path="/company-command-center"
              element={<CompanyCommandCenter />}
            />

            <Route
              path="/company-operations"
              element={<CompanyOperations />}
            />

            <Route
              path="/company-analytics"
              element={
                <RoleRoute roles={['SUPER_ADMIN', 'ADMIN', 'MANAGER']}>
                  <CompanyTargetAnalytics />
                </RoleRoute>
              }
            />

            <Route
              path="/target-analytics"
              element={
                <RoleRoute roles={['SUPER_ADMIN', 'ADMIN', 'MANAGER']}>
                  <CompanyTargetAnalytics />
                </RoleRoute>
              }
            />

            <Route
              path="/execution-board"
              element={<DailyExecutionBoard />}
            />

            <Route
              path="/employee-performance"
              element={<EmployeePerformance />}
            />

            <Route
              path="/organization-settings"
              element={<OrganizationSettings />}
            />

            <Route
              path="/settings"
              element={<Settings />}
            />

            <Route
              path="/"
              element={<Navigate to="/dashboard" replace />}
            />
          </Route>

          <Route
            path="*"
            element={<Navigate to="/dashboard" replace />}
          />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}
