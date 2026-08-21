import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Users, FolderKanban, CheckSquare, Clock } from 'lucide-react'
import { useAuth } from '../features/auth/AuthContext'
import { getEmployees } from '../features/employees/employee.service'
import { getProjects } from '../features/projects/project.service'
import { getWorkItems } from '../features/work-items/work-item.service'

export default function Dashboard() {
  const { profile, accessToken } = useAuth()

  // Step 59: Redirect MANAGER to /manager/dashboard
  if (profile?.role === 'MANAGER') {
    return <Navigate to="/manager/dashboard" replace />
  }

  const [totalEmployees, setTotalEmployees] = useState<number | string>('...')
  const [activeProjects, setActiveProjects] = useState<number | string>('...')
  const [tasksCompleted, setTasksCompleted] = useState<number | string>('...')
  const [pendingReviews, setPendingReviews] = useState<number | string>('...')

  useEffect(() => {
    async function loadStats() {
      if (!accessToken) return
      try {
        const [emps, projs, work] = await Promise.all([
          getEmployees(accessToken).catch(() => []),
          getProjects(accessToken).catch(() => []),
          getWorkItems(accessToken).catch(() => []),
        ])

        setTotalEmployees(emps.length)
        setActiveProjects(projs.length)
        setTasksCompleted(work.filter((w) => w.status === 'DONE').length)
        setPendingReviews(work.filter((w) => w.status === 'IN_REVIEW' || w.status === 'IN_PROGRESS').length)
      } catch {
        setTotalEmployees(1)
        setActiveProjects(0)
        setTasksCompleted(0)
        setPendingReviews(0)
      }
    }
    loadStats()
  }, [accessToken])

  const stats = [
    { title: 'Total Employees', value: String(totalEmployees), icon: Users, bg: 'bg-slate-100', iconColor: 'text-slate-800' },
    { title: 'Active Projects', value: String(activeProjects), icon: FolderKanban, bg: 'bg-blue-50/80', iconColor: 'text-blue-600' },
    { title: 'Tasks Completed', value: String(tasksCompleted), icon: CheckSquare, bg: 'bg-emerald-50/80', iconColor: 'text-emerald-600' },
    { title: 'Pending Reviews', value: String(pendingReviews), icon: Clock, bg: 'bg-amber-50/80', iconColor: 'text-amber-600' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-slate-500 font-medium">Welcome back</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 tracking-tight">
          {profile?.first_name} {profile?.last_name}
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Here's what's happening in your workspace.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map(({ title, value, icon: Icon, bg, iconColor }) => (
          <div
            key={title}
            className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex items-center justify-between hover:border-slate-300 transition-colors"
          >
            <div>
              <p className="text-xs font-semibold text-slate-500">{title}</p>
              <p className="mt-2 text-2xl font-bold text-slate-900 tracking-tight">{value}</p>
            </div>
            <div className={`w-10 h-10 rounded-xl ${bg} ${iconColor} border border-slate-200/60 flex items-center justify-center shrink-0`}>
              <Icon size={18} />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
        <h2 className="text-base font-bold text-slate-900 tracking-tight">Work Overview</h2>
        <p className="mt-1 text-xs text-slate-500">
          Your work, projects, deadlines and team activity will appear here.
        </p>
      </div>
    </div>
  )
}
