import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FolderKanban,
  Target,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Zap,
  Briefcase,
  Users,
} from 'lucide-react'
import { useAuth } from '../../features/auth/AuthContext'
import {
  getEmployeeWorkload,
  type EmployeeWorkload,
} from '../../features/project-targets/project-target.service'

export default function MyWorkload() {
  const { accessToken, profile } = useAuth()

  const [workload, setWorkload] = useState<EmployeeWorkload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const isManager =
    profile?.role === 'SUPER_ADMIN' ||
    profile?.role === 'ADMIN' ||
    profile?.role === 'MANAGER'

  async function loadWorkload() {
    if (!accessToken) return
    setLoading(true)
    setError('')
    try {
      const data = await getEmployeeWorkload(accessToken)
      setWorkload(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workload.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadWorkload()
  }, [accessToken])

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-200/70 text-slate-700 text-[10px] font-bold uppercase tracking-wider mb-2">
              <Briefcase size={12} className="text-[#801424]" />
              Enterprise Delivery Engine
            </div>
            <h1 className="text-2xl font-black text-slate-900">
              MY WORKLOAD
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Your committed project deliverables, progress velocity, and today's planned execution.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadWorkload}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            {isManager && (
              <Link
                to="/work-distribution"
                className="inline-flex items-center gap-2 rounded-xl border border-[#801424]/30 bg-rose-50/50 hover:bg-rose-50 px-4 py-2 text-xs font-bold text-[#801424] shadow-2xs transition"
              >
                <Users className="h-4 w-4" />
                Team Workload View
              </Link>
            )}
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700">
            {error}
          </div>
        )}

        {/* TODAY'S EXECUTION COMMITMENT BANNER */}
        {workload && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#801424] font-mono flex items-center gap-1.5">
                <Zap size={14} />
                TODAY'S EXECUTION
              </span>
              <span className="text-xs font-semibold text-slate-500">
                {workload.today.completed_count} of {workload.today.targets_count} targets done
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">
                  Planned Output
                </span>
                <p className="text-2xl font-black text-slate-900 mt-1">
                  {workload.today.planned_output}
                </p>
                <span className="text-[10px] text-slate-500">items committed</span>
              </div>

              <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 text-center">
                <span className="text-[10px] uppercase font-bold text-emerald-700 font-mono">
                  Completed
                </span>
                <p className="text-2xl font-black text-emerald-900 mt-1">
                  {workload.today.completed}
                </p>
                <span className="text-[10px] text-emerald-600">delivered</span>
              </div>

              <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-4 text-center">
                <span className="text-[10px] uppercase font-bold text-rose-700 font-mono">
                  Remaining
                </span>
                <p className="text-2xl font-black text-rose-900 mt-1">
                  {workload.today.remaining}
                </p>
                <span className="text-[10px] text-rose-600">to deliver</span>
              </div>

              <div className="rounded-xl border border-[#801424]/20 bg-rose-50/30 p-4 text-center">
                <span className="text-[10px] uppercase font-bold text-[#801424] font-mono">
                  Today's Pace
                </span>
                <p className="text-2xl font-black text-[#801424] mt-1">
                  {workload.today.planned_output > 0
                    ? Math.round((workload.today.completed / workload.today.planned_output) * 100)
                    : 0}
                  %
                </p>
                <span className="text-[10px] text-[#801424]">achievement</span>
              </div>
            </div>
          </div>
        )}

        {/* MY PROJECT WORKLOAD TABLE */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Active Project Allocations
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Breakdown of your allocated target volumes and required daily delivery pace.
              </p>
            </div>

            {workload && (
              <span className="text-xs font-mono font-bold text-slate-700 px-3 py-1 bg-slate-100 rounded-full border border-slate-200">
                Total: {workload.totals.done} / {workload.totals.target} ({workload.totals.achievement}%)
              </span>
            )}
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400">
              <RefreshCw className="mx-auto h-6 w-6 animate-spin text-slate-400" />
              <p className="mt-3 text-xs font-medium">Loading project workload...</p>
            </div>
          ) : !workload || workload.projects.length === 0 ? (
            <div className="p-12 text-center">
              <FolderKanban className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-2 text-sm font-bold text-slate-700">No project allocations found</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Once a manager assigns project target volumes to your profile, your personalized required pace and workload will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                    <th className="py-3 px-5">Project</th>
                    <th className="py-3 px-4 text-center">Target</th>
                    <th className="py-3 px-4 text-center">Done</th>
                    <th className="py-3 px-4 text-center">Pending</th>
                    <th className="py-3 px-5">Progress</th>
                    <th className="py-3 px-4 text-center">Days Left</th>
                    <th className="py-3 px-4 text-center">Required Pace</th>
                    <th className="py-3 px-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {workload.projects.map((proj) => (
                    <tr key={proj.project_id} className="hover:bg-slate-50/60 transition">
                      <td className="py-4 px-5">
                        <Link
                          to={`/projects/${proj.project_id}`}
                          className="font-bold text-slate-900 hover:text-[#801424] text-xs"
                        >
                          {proj.project_name}
                        </Link>
                        <span className="block text-[10px] text-slate-400 mt-0.5">
                          Unit: {proj.unit}
                        </span>
                      </td>

                      <td className="py-4 px-4 text-center font-bold text-slate-900">
                        {proj.target}
                      </td>

                      <td className="py-4 px-4 text-center font-bold text-emerald-700">
                        {proj.done}
                      </td>

                      <td className="py-4 px-4 text-center font-bold text-rose-700">
                        {proj.pending}
                      </td>

                      <td className="py-4 px-5">
                        <div className="w-32">
                          <div className="flex items-center justify-between text-[10px] font-semibold text-slate-600 mb-1">
                            <span>{proj.achievement}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#801424] rounded-full"
                              style={{ width: `${proj.achievement}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4 text-center font-semibold text-slate-600">
                        {proj.days_remaining}d
                      </td>

                      <td className="py-4 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-full font-mono font-bold text-[11px] bg-slate-100 text-slate-800">
                          {proj.required_pace} {proj.unit}/day
                        </span>
                      </td>

                      <td className="py-4 px-5 text-right">
                        <Link
                          to={`/projects/${proj.project_id}`}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-bold text-slate-700 hover:bg-slate-50 transition text-[11px]"
                        >
                          View Project
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50/90 font-bold border-t border-slate-200 text-slate-900">
                    <td className="py-3 px-5 uppercase font-mono text-[10px]">TOTAL</td>
                    <td className="py-3 px-4 text-center">{workload.totals.target}</td>
                    <td className="py-3 px-4 text-center text-emerald-700">{workload.totals.done}</td>
                    <td className="py-3 px-4 text-center text-rose-700">{workload.totals.pending}</td>
                    <td className="py-3 px-5 text-slate-600">{workload.totals.achievement}% Achieved</td>
                    <td className="py-3 px-4 text-center">-</td>
                    <td className="py-3 px-4 text-center">-</td>
                    <td className="py-3 px-5"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
