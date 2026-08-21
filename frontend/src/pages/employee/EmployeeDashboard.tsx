import { useEffect, useState } from 'react'
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  CheckSquare,
  AlertCircle,
  Calendar,
} from 'lucide-react'
import { useAuth } from '../../features/auth/AuthContext'
import { getEmployeeDashboard } from '../../features/dashboard/employee-dashboard.service'

function WorkRow({ item }: { item: any }) {
  return (
    <div className="p-5 hover:bg-slate-50/80 transition-colors duration-200 flex flex-wrap items-center justify-between gap-4">
      <div className="space-y-1.5 flex-1 min-w-60">
        <div className="flex items-center gap-2">
          {item.projects && (
            <span className="font-mono text-[11px] font-extrabold px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100">
              {item.projects.project_key}
            </span>
          )}
          <span
            className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-md uppercase tracking-wider ${
              item.priority === 'URGENT'
                ? 'bg-rose-50 text-rose-700 border border-rose-200/80'
                : item.priority === 'HIGH'
                ? 'bg-amber-50 text-amber-700 border border-amber-200/80'
                : 'bg-slate-100 text-slate-600 border border-slate-200/80'
            }`}
          >
            {item.priority}
          </span>
        </div>

        <h3 className="font-bold text-slate-900 text-base tracking-tight">{item.title}</h3>
        {item.description && (
          <p className="text-xs text-slate-500 line-clamp-1">{item.description}</p>
        )}

        {item.deadline && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
            <Calendar size={13} className="text-blue-500" />
            <span>Deadline: {new Date(item.deadline).toLocaleDateString()}</span>
          </div>
        )}
      </div>

      <div>
        <span
          className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold shadow-2xs ${
            item.status === 'DONE'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
              : item.status === 'IN_PROGRESS'
              ? 'bg-amber-50 text-amber-700 border border-amber-200/80'
              : item.status === 'BLOCKED'
              ? 'bg-rose-50 text-rose-700 border border-rose-200/80'
              : 'bg-slate-100 text-slate-700 border border-slate-200/80'
          }`}
        >
          {item.status.replace('_', ' ')}
        </span>
      </div>
    </div>
  )
}

export default function EmployeeDashboard() {
  const { accessToken, profile } = useAuth()
  const [dashboard, setDashboard] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      if (!accessToken) return
      setLoading(true)
      setError('')
      try {
        const data = await getEmployeeDashboard(accessToken)
        setDashboard(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load dashboard.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [accessToken])

  if (loading) {
    return <div className="p-12 text-center text-slate-400 text-xs font-semibold">Loading Employee Dashboard...</div>
  }

  if (error) {
    return (
      <div className="p-6 rounded-2xl bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-3">
        <AlertCircle size={20} />
        <span className="text-sm font-semibold">{error}</span>
      </div>
    )
  }

  const stats = [
    { title: 'In Progress', value: dashboard?.stats?.active || 0, icon: Clock, bg: 'bg-blue-50/80', iconColor: 'text-blue-600', border: 'border-blue-100' },
    { title: 'Due Today', value: dashboard?.stats?.dueSoon || 0, icon: Clock, bg: 'bg-amber-50/80', iconColor: 'text-amber-600', border: 'border-amber-100' },
    { title: 'Overdue', value: dashboard?.stats?.overdue || 0, icon: AlertTriangle, bg: 'bg-rose-50/80', iconColor: 'text-rose-600', border: 'border-rose-100' },
    { title: 'Total Assigned', value: dashboard?.stats?.total || 0, icon: CheckSquare, bg: 'bg-slate-50', iconColor: 'text-slate-700', border: 'border-slate-200' },
  ]

  return (
    <div className="space-y-6">
      {/* Greeting Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Good afternoon, {profile?.first_name || 'there'}
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · Employee
          </p>
        </div>
      </div>

      {/* Metric Cards matching image */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map(({ title, value, icon: Icon, bg, iconColor, border }) => (
          <div
            key={title}
            className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between hover:border-slate-300 transition-colors"
          >
            <div>
              <p className="text-xs font-semibold text-slate-500">{title}</p>
              <p className="mt-2 text-2xl font-bold text-slate-900 tracking-tight">{value}</p>
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bg} ${iconColor} border ${border} shrink-0`}>
              <Icon size={18} />
            </div>
          </div>
        ))}
      </div>

      {/* Daily Update Alert Banner matching screenshot */}
      <div className="bg-[#fff1f2]/70 border border-[#fecdd3] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white border border-rose-200 flex items-center justify-center text-rose-700 shrink-0">
            <Calendar size={18} />
          </div>
          <div>
            <h3 className="font-semibold text-xs text-slate-900">Daily update not submitted</h3>
            <p className="text-[11px] text-slate-500">Submit today's work update to keep your manager informed</p>
          </div>
        </div>
        <button
          onClick={() => (window.location.href = '/work')}
          className="bg-[#801424] hover:bg-[#9f1239] text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
        >
          <span>Submit</span>
          <span>→</span>
        </button>
      </div>

      {/* My Work Section */}
      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">My Work Items</h2>
            <p className="text-xs text-slate-500 mt-0.5">Tasks & deliverables assigned to you.</p>
          </div>
          <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
            {dashboard?.workItems?.length || 0} Items
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {dashboard?.workItems?.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle2 size={44} className="mx-auto text-emerald-500" />
              <p className="mt-4 font-extrabold text-slate-900 text-base">You're all caught up!</p>
              <p className="text-xs text-slate-500 mt-1">No active work items currently assigned.</p>
            </div>
          ) : (
            dashboard?.workItems?.map((item: any) => (
              <WorkRow key={item.id} item={item} />
            ))
          )}
        </div>
      </section>

      {/* Open Concerns Section */}
      <section className="glass-panel rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-200/60 bg-slate-50/50">
          <h2 className="text-base font-extrabold text-slate-900">Open Blockers & Concerns</h2>
        </div>

        {dashboard?.concerns?.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs font-medium">No open concerns.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {dashboard?.concerns?.map((c: any) => (
              <div key={c.id} className="p-4.5 flex items-center justify-between text-xs gap-4">
                <div>
                  <p className="font-semibold text-slate-800">{c.concern}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Reported on {new Date(c.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-700 border border-rose-200 uppercase">
                  {c.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}