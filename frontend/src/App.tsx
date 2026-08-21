import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './features/auth/AuthContext'
import Login from './pages/Login'
import AppLayout from './layouts/AppLayout'
import Dashboard from './pages/Dashboard'
import Employees from './pages/Employees'
import Projects from './pages/Projects'
import ProjectDetails from './pages/ProjectDetails'
import WorkItems from './pages/WorkItems'
import WorkItemDetails from './pages/WorkItemDetails'
import Notifications from './pages/Notifications'
import Conversations from './pages/Conversations'
import ManagerDashboard from './pages/manager/ManagerDashboard'
import EmployeeDashboard from './pages/employee/EmployeeDashboard'

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

export default function App() {
  return (
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
          path="/manager/dashboard"
          element={<ManagerDashboard />}
        />

        <Route
          path="/employee/dashboard"
          element={<EmployeeDashboard />}
        />

        <Route
          path="/employees"
          element={<Employees />}
        />

        <Route
          path="/projects"
          element={<Projects />}
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
          path="/notifications"
          element={<Notifications />}
        />

        <Route
          path="/conversations"
          element={<Conversations />}
        />

        <Route
          path="/sprints"
          element={
            <div className="p-4">
              Sprints — coming next
            </div>
          }
        />
      </Route>

      <Route
        path="*"
        element={
          <Navigate
            to="/dashboard"
            replace
          />
        }
      />
    </Routes>
  )
}
