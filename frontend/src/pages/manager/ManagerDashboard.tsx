import { useEffect, useState } from 'react'
import { FolderKanban, Users, CheckSquare, AlertTriangle, TrendingUp, AlertCircle, Sparkles } from 'lucide-react'
import { useAuth } from '../../features/auth/AuthContext'
import { getManagerDashboard } from '../../features/dashboard/dashboard.service'

export default function ManagerDashboard() {
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
        const data = await getManagerDashboard(accessToken)
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
    return <div className="p-12 text-center text-slate-400">Loading Manager Dashboard...</div>
  }

  if (error) {
    return (
      <div className="p-6 rounded-xl bg-red-50 text-red-700 border border-red-200 flex items-center gap-3">
        <AlertCircle size={20} />
        <span>{error}</span>
      </div>
    )
  }

  const stats = [
    { title: 'Managed Projects', value: dashboard?.stats?.projects || 0, icon: FolderKanban, bg: 'bg-blue-50/80', iconColor: 'text-blue-600', border: 'border-blue-100' },
    { title: 'Team Members', value: dashboard?.stats?.team || 0, icon: Users, bg: 'bg-slate-100', iconColor: 'text-slate-700', border: 'border-slate-200' },
    { title: 'Active Tasks', value: dashboard?.stats?.activeWork || 0, icon: CheckSquare, bg: 'bg-amber-50/80', iconColor: 'text-amber-600', border: 'border-amber-100' },
    { title: 'Overdue Items', value: dashboard?.stats?.overdue || 0, icon: AlertTriangle, bg: 'bg-rose-50/80', iconColor: 'text-rose-600', border: 'border-rose-100' },
  ]

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold text-[10px] uppercase tracking-wider mb-2">
            <Sparkles size={12} className="text-amber-500" />
            Manager Overview
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Welcome back, {profile?.first_name || 'Manager'} {profile?.last_name || ''}
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Real-time snapshot of managed projects, team daily updates, progress metrics, and active blockers.
          </p>
        </div>
      </div>

      {/* Metric Cards */}
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

      {/* Managed Projects Section */}
      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">Managed Projects</h2>
            <p className="text-xs text-slate-500 mt-0.5">Projects currently assigned to your team.</p>
          </div>
          <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
            {dashboard?.projects?.length || 0} Active
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {dashboard?.projects?.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm font-medium">
              No managed projects assigned yet.
            </div>
          ) : (
            dashboard?.projects?.map((project: any) => (
              <div key={project.id} className="p-5 hover:bg-slate-50/50 transition-colors flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 text-white font-bold flex items-center justify-center text-xs shadow-xs">
                    {project.project_key}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{project.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Methodology: <span className="font-semibold text-slate-700">{project.methodology}</span>
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {project.status || 'ACTIVE'}
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Grid: Team Daily Updates & Open Concerns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team Daily Updates */}
        <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">Team Daily Updates</h2>
              <p className="text-xs text-slate-500 mt-0.5">Real-time work submissions across team members.</p>
            </div>
            <TrendingUp size={18} className="text-slate-700" />
          </div>

          <div className="p-5 space-y-3 max-h-96 overflow-y-auto">
            {dashboard?.updates?.length === 0 ? (
              <div className="text-center text-slate-400 py-8 text-xs font-medium">
                No recent daily updates logged.
              </div>
            ) : (
              dashboard?.updates?.map((u: any) => (
                <div
                  key={u.id}
                  className="p-3.5 border border-slate-100 rounded-xl bg-slate-50/50 space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">
                      {u.employee?.first_name} {u.employee?.last_name || ''}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                      {u.progress_percent}% Progress
                    </span>
                  </div>
                  <p className="text-slate-600">{u.update_text}</p>
                  <p className="text-[10px] text-slate-400">
                    {new Date(u.created_at).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Reported Concerns */}
        <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">Blockers & Concerns</h2>
              <p className="text-xs text-slate-500 mt-0.5">Urgent issues requiring manager attention.</p>
            </div>
            <AlertTriangle size={18} className="text-rose-500" />
          </div>

          <div className="p-5 space-y-3 max-h-96 overflow-y-auto">
            {dashboard?.concerns?.length === 0 ? (
              <div className="text-center text-slate-400 py-8 text-xs font-medium">
                No open blockers reported.
              </div>
            ) : (
              dashboard?.concerns?.map((c: any) => (
                <div
                  key={c.id}
                  className="p-3.5 border border-rose-200/80 rounded-xl bg-rose-50/40 space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">
                      {c.reporter?.first_name} {c.reporter?.last_name || ''}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200 uppercase">
                      OPEN
                    </span>
                  </div>
                  <p className="text-slate-700 font-medium">{c.concern}</p>
                  <p className="text-[10px] text-slate-400">
                    {new Date(c.created_at).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
