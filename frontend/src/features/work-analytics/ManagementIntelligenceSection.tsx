import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Flame,
  Layers,
  RefreshCw,
  ShieldAlert,
  UserCheck,
  X,
  Zap,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { updateWorkItem } from '../work-items/work-item.service'
import {
  getBottlenecks,
  getReassignmentRecommendations,
  getRootBlockers,
  type BottleneckModule,
  type ReassignmentRecommendation,
  type RootBlocker,
} from './work-analytics.service'

import { getTeamToday } from '../work-execution/team-today.service'

export default function ManagementIntelligenceSection() {
  const { accessToken } = useAuth()

  const [bottlenecks, setBottlenecks] = useState<BottleneckModule[]>([])
  const [recommendations, setRecommendations] = useState<
    ReassignmentRecommendation[]
  >([])
  const [rootBlockers, setRootBlockers] = useState<RootBlocker[]>([])
  const [criticalConcerns, setCriticalConcerns] = useState<any[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Review Reassign Modal State (Step 163)
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<{
    id: string
    title: string
    remainingHours: number
    currentAssigneeName: string
  } | null>(null)
  const [selectedCandidate, setSelectedCandidate] = useState<{
    id: string
    name: string
    utilization: number
  } | null>(null)
  const [reassignReason, setReassignReason] = useState('Workload balancing')
  const [submitting, setSubmitting] = useState(false)

  async function loadData() {
    if (!accessToken) return
    setLoading(true)
    setError('')

    try {
      const [botData, recData, rootData, teamData] = await Promise.all([
        getBottlenecks(accessToken).catch(() => []),
        getReassignmentRecommendations(accessToken).catch(() => []),
        getRootBlockers(accessToken).catch(() => []),
        getTeamToday(accessToken).catch(() => null),
      ])

      setBottlenecks(botData || [])
      setRecommendations(recData || [])
      setRootBlockers(rootData || [])

      const open = teamData?.openConcerns || []
      setCriticalConcerns(open.filter((c) => c.priority === 'CRITICAL' || c.priority === 'HIGH'))
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load management intelligence.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [accessToken])

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-500">
        <RefreshCw className="mx-auto h-5 w-5 animate-spin text-slate-400 mb-2" />
        Analyzing operational bottlenecks & recommendations...
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">
        {error}
      </div>
    )
  }

  const overloadedEmps = recommendations.filter(
    (r) => r.workload === 'OVERLOADED' || r.utilization > 100,
  )
  const availableEmps = recommendations
    .filter((r) => r.workload === 'AVAILABLE' || r.workload === 'NORMAL')
    .sort((a, b) => a.utilization - b.utilization)

  return (
    <div className="space-y-6">
      {/* STEP 173 — CRITICAL CONCERNS ADMIN ESCALATION */}
      {criticalConcerns.length > 0 && (
        <section className="rounded-2xl border border-red-300 bg-red-50/50 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-950">
              <AlertOctagon className="h-5 w-5 text-red-700" />
              <div>
                <h3 className="font-bold text-base tracking-tight uppercase">
                  Critical Unresolved Concerns
                </h3>
                <p className="text-xs text-red-700">
                  {criticalConcerns.length} unresolved blocker{criticalConcerns.length > 1 ? 's' : ''} causing task delays
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {criticalConcerns.map((c) => (
              <div
                key={c.id}
                className="rounded-xl border border-red-200 bg-white p-4 space-y-2 text-xs shadow-xs"
              >
                <div className="flex items-center justify-between font-bold text-slate-900">
                  <span>{c.projectName}</span>
                  <span className="rounded-md bg-red-100 px-2 py-0.5 text-[10px] text-red-800 uppercase font-extrabold">
                    {c.priority}
                  </span>
                </div>
                <p className="text-slate-800 font-semibold">{c.concern}</p>
                <p className="text-slate-500 text-[11px]">
                  Task: <Link to={`/work-items/${c.workItemId}`} className="text-blue-600 font-bold hover:underline">{c.workItemTitle}</Link> · Reported by {c.reporterName}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* STEP 164 — ROOT BLOCKER DETECTION */}
      {rootBlockers.length > 0 && (
        <section className="rounded-2xl border border-rose-200 bg-rose-50/40 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-rose-900">
              <ShieldAlert className="h-5 w-5 text-rose-600" />
              <div>
                <h3 className="font-bold text-base tracking-tight uppercase">
                  Root Blocker Detection
                </h3>
                <p className="text-xs text-rose-600 font-medium">
                  Critical prerequisite tasks blocking downstream execution
                </p>
              </div>
            </div>
            <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-800">
              {rootBlockers.length} Active Blocker{rootBlockers.length > 1 ? 's' : ''}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {rootBlockers.map((rb) => (
              <div
                key={rb.prerequisiteId}
                className="rounded-xl border border-rose-200 bg-white p-4 space-y-3 shadow-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">
                      ROOT BLOCKER
                    </span>
                    <Link
                      to={`/work-items/${rb.prerequisiteId}`}
                      className="font-bold text-slate-900 text-sm hover:text-rose-700 transition"
                    >
                      {rb.title}
                    </Link>
                  </div>
                  <span className="rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                    {rb.health}
                  </span>
                </div>

                <div className="text-xs text-slate-600 space-y-1">
                  <p>
                    Assignee:{' '}
                    <span className="font-semibold text-slate-900">
                      {rb.assigneeName}
                    </span>
                  </p>
                  <p className="font-bold text-rose-700">
                    Blocks {rb.blockedItems.length} downstream work item
                    {rb.blockedItems.length > 1 ? 's' : ''}:
                  </p>
                  <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-slate-700">
                    {rb.blockedItems.map((item) => (
                      <li key={item.id}>
                        <Link
                          to={`/work-items/${item.id}`}
                          className="hover:underline font-medium"
                        >
                          {item.title}
                        </Link>{' '}
                        <span className="text-slate-400">({item.health})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* STEP 161 — CURRENT BOTTLENECKS */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-600" />
            <div>
              <h3 className="font-bold text-slate-900 text-base tracking-tight uppercase">
                Current Bottlenecks
              </h3>
              <p className="text-xs text-slate-500">
                Modules ranked by overall operational risk score
              </p>
            </div>
          </div>
          <button
            onClick={loadData}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>

        {bottlenecks.length === 0 ? (
          <p className="text-xs text-slate-500 italic">
            No module bottlenecks identified. Execution running smoothly.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {bottlenecks.slice(0, 6).map((b, idx) => (
              <div
                key={b.id}
                className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3 hover:border-slate-300 transition"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 font-mono">
                      #{idx + 1} BOTTLENECK
                    </span>
                    <h4 className="font-bold text-slate-900 text-sm">
                      <Link
                        to={`/projects/${b.projectId}`}
                        className="hover:text-blue-600 transition"
                      >
                        {b.name}
                      </Link>
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {b.projectName}
                    </p>
                  </div>
                  <span className="rounded-lg bg-orange-100 border border-orange-200 px-2.5 py-1 text-xs font-extrabold text-orange-800">
                    Risk {b.riskScore}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-200/60">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Overdue:</span>
                    <span className="font-bold text-red-600">{b.overdue}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Critical:</span>
                    <span className="font-bold text-rose-600">{b.critical}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Blocked:</span>
                    <span className="font-bold text-amber-700">{b.blocked}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Remaining:</span>
                    <span className="font-bold text-slate-900">
                      {b.remainingHours.toFixed(1)}h
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* STEP 162 — WORKLOAD BALANCING & REASSIGNMENT RECOMMENDATIONS */}
      {overloadedEmps.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/40 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-amber-900">
            <Zap className="h-5 w-5 text-amber-600" />
            <div>
              <h3 className="font-bold text-base tracking-tight uppercase">
                Workload Balancing & Recommendations
              </h3>
              <p className="text-xs text-amber-700">
                Suggested task redistributions to relieve team member burnout
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {overloadedEmps.map((emp) => {
              const taskToMove = emp.assignedItems?.[0]
              const candidate = availableEmps[0]

              return (
                <div
                  key={emp.employee.id}
                  className="rounded-xl border border-amber-200 bg-white p-5 space-y-4 shadow-xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <span className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                        {emp.employee.name}
                      </span>
                      <span className="text-xs text-red-700 font-semibold">
                        {emp.utilization}% utilization · {emp.remainingHours}h remaining
                      </span>
                    </div>

                    <span className="self-start sm:self-auto rounded-md bg-red-100 border border-red-200 px-2.5 py-1 text-[10px] font-bold text-red-800 uppercase">
                      OVERLOADED
                    </span>
                  </div>

                  {taskToMove && candidate && (
                    <div className="grid gap-4 sm:grid-cols-2 text-xs">
                      <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                          Suggested Task to Move:
                        </span>
                        <p className="font-bold text-slate-900">{taskToMove.title}</p>
                        <p className="text-slate-500">
                          Estimated remaining:{' '}
                          <span className="font-bold text-slate-700">
                            {taskToMove.estimatedRemainingHours}h
                          </span>
                        </p>
                      </div>

                      <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 space-y-1.5 flex flex-col justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">
                            Potential Reassignment:
                          </span>
                          <p className="font-bold text-slate-900 flex items-center gap-1.5">
                            <UserCheck className="h-4 w-4 text-emerald-600" />
                            {candidate.employee.name}
                          </p>
                          <p className="text-slate-500 font-medium">
                            {candidate.utilization}% utilization (Available)
                          </p>
                        </div>

                        <button
                          onClick={() => {
                            setSelectedTask({
                              id: taskToMove.id,
                              title: taskToMove.title,
                              remainingHours: taskToMove.estimatedRemainingHours,
                              currentAssigneeName: emp.employee.name,
                            })
                            setSelectedCandidate({
                              id: candidate.employee.id,
                              name: candidate.employee.name,
                              utilization: candidate.utilization,
                            })
                            setReassignReason('Workload balancing')
                            setReviewModalOpen(true)
                          }}
                          className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 cursor-pointer shadow-xs"
                        >
                          Review Suggestion
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* STEP 163 — REASSIGN WORK REVIEW MODAL */}
      {reviewModalOpen && selectedTask && selectedCandidate && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 relative space-y-4">
            <button
              onClick={() => setReviewModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X size={20} />
            </button>

            <h2 className="text-lg font-bold text-slate-900">
              REASSIGN WORK
            </h2>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-2 text-xs">
              <p className="font-bold text-slate-900 text-sm">
                {selectedTask.title}
              </p>
              <p className="text-slate-600">
                Current Assignee:{' '}
                <span className="font-bold text-slate-900">
                  {selectedTask.currentAssigneeName}
                </span>
              </p>
              <p className="text-slate-600">
                Estimated Remaining:{' '}
                <span className="font-bold text-slate-900">
                  {selectedTask.remainingHours}h
                </span>
              </p>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault()
                if (!accessToken) return
                setSubmitting(true)
                try {
                  await updateWorkItem(accessToken, selectedTask.id, {
                    assigned_to: selectedCandidate.id,
                    assignment_reason: reassignReason.trim() || 'Workload balancing',
                  })
                  setReviewModalOpen(false)
                  await loadData()
                } catch (err) {
                  alert(
                    err instanceof Error
                      ? err.message
                      : 'Reassignment failed.',
                  )
                } finally {
                  setSubmitting(false)
                }
              }}
              className="space-y-4 text-xs"
            >
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 space-y-1">
                <span className="text-[10px] font-bold text-emerald-800 uppercase">
                  Recommended Candidate:
                </span>
                <p className="font-bold text-emerald-950 text-sm">
                  {selectedCandidate.name} — {selectedCandidate.utilization}% utilization
                </p>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Reason *
                </label>
                <input
                  type="text"
                  required
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  placeholder="e.g. Workload balancing"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-zinc-800 bg-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReviewModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl cursor-pointer disabled:opacity-50"
                >
                  Reassign Work
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
