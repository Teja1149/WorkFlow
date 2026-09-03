import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Flame,
  FolderKanban,
  Layers,
  RefreshCw,
  Target,
  User,
} from 'lucide-react'

import { useAuth } from '../features/auth/AuthContext'
import {
  getEmployeeWorkDetail,
  type EmployeeWorkDetailData,
} from '../features/work-execution/employee-detail.service'
import DeadlineCountdown from '../features/work-execution/DeadlineCountdown'
import {
  getOrganizationWorkSettings,
  type OrganizationWorkSettings,
} from '../features/organization-settings/organization-setting.service'
import { getEmployeeDailyTargets } from '../features/daily-targets/daily-target.service'
import type { DailyTarget } from '../features/daily-targets/daily-target.types'
import WorkDetailsDrawer from '../features/work-items/WorkDetailsDrawer'

function healthBadgeClass(health: string) {
  switch (health) {
    case 'CRITICAL':
      return 'bg-red-100 text-red-800 border-red-300'
    case 'RED':
      return 'bg-red-50 text-red-700 border-red-200'
    case 'ORANGE':
      return 'bg-orange-50 text-orange-700 border-orange-200'
    case 'AMBER':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    default:
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  }
}

export default function EmployeeWorkDetail() {
  const { employeeId } = useParams<{ employeeId: string }>()
  const { accessToken } = useAuth()

  const [data, setData] = useState<EmployeeWorkDetailData | null>(null)
  const [selectedWork, setSelectedWork] = useState<
    EmployeeWorkDetailData['work'][number] | null
  >(null)
  const [dailyTargets, setDailyTargets] = useState<DailyTarget[]>([])
  const [settings, setSettings] = useState<OrganizationWorkSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    if (!accessToken || !employeeId) return
    setLoading(true)
    setError('')

    try {
      const todayStr = new Date().toISOString().slice(0, 10)
      const [res, workSettings, targets] = await Promise.all([
        getEmployeeWorkDetail(accessToken, employeeId),
        getOrganizationWorkSettings(accessToken).catch(() => null),
        getEmployeeDailyTargets(accessToken, employeeId, todayStr).catch(() => []),
      ])
      setData(res)
      setSettings(workSettings)
      setDailyTargets(Array.isArray(targets) ? targets : [])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load employee work detail.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [accessToken, employeeId])

  // Group work items by Project -> Module
  const projectHierarchy = useMemo(() => {
    if (!data?.work) return []

    const map = new Map<
      string,
      {
        id: string
        name: string
        modules: Map<
          string,
          {
            id: string
            name: string
            items: typeof data.work
          }
        >
      }
    >()

    for (const item of data.work) {
      const projId = item.projects?.id || 'unassigned'
      const projName = item.projects?.name || 'Unassigned Project'

      if (!map.has(projId)) {
        map.set(projId, {
          id: projId,
          name: projName,
          modules: new Map(),
        })
      }

      const projNode = map.get(projId)!
      const modId = item.project_modules?.id || 'general'
      const modName = item.project_modules?.name || 'General / Root'

      if (!projNode.modules.has(modId)) {
        projNode.modules.set(modId, {
          id: modId,
          name: modName,
          items: [],
        })
      }

      projNode.modules.get(modId)!.items.push(item)
    }

    return Array.from(map.values()).map((p) => ({
      ...p,
      modules: Array.from(p.modules.values()),
    }))
  }, [data])

  if (loading) {
    return (
      <div className="p-8 text-center">
        <RefreshCw className="mx-auto h-6 w-6 animate-spin text-slate-400" />
        <p className="mt-3 text-sm text-slate-500">
          Loading employee execution details...
        </p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <Link
          to="/team-today"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Team Today
        </Link>

        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {error || 'Employee details not found.'}
        </div>
      </div>
    )
  }

  const { employee, summary, work } = data

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Top Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/team-today"
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 shadow-xs"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900">
                  {employee.first_name} {employee.last_name || ''}
                </h1>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                  {employee.role}
                </span>
              </div>

              <p className="text-xs text-slate-500">
                {employee.email} {employee.employee_id ? `• ID: ${employee.employee_id}` : ''}
              </p>
            </div>
          </div>

          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-xs"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {/* Summary Metric Cards */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <p className="text-xs font-semibold uppercase text-slate-400">Total Work</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{summary.total}</p>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-xs">
            <p className="text-xs font-semibold uppercase text-emerald-700">Completed</p>
            <p className="mt-2 text-3xl font-bold text-emerald-900">{summary.completed}</p>
          </div>

          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-xs">
            <p className="text-xs font-semibold uppercase text-red-600">Overdue</p>
            <p className="mt-2 text-3xl font-bold text-red-700">{summary.overdue}</p>
          </div>

          <div className="rounded-2xl border border-red-300 bg-red-100 p-5 shadow-xs">
            <p className="text-xs font-semibold uppercase text-red-800">Critical</p>
            <p className="mt-2 text-3xl font-bold text-red-900">{summary.critical}</p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-xs">
            <p className="text-xs font-semibold uppercase text-amber-700">Carried Forward</p>
            <p className="mt-2 text-3xl font-bold text-amber-800">{summary.carriedForward}</p>
          </div>
        </div>

        {/* TODAY'S TARGETS (Step 112) */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-[#801424]" />
              <h2 className="font-bold text-slate-900 text-base uppercase tracking-wide">
                TODAY'S TARGETS
              </h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
                {dailyTargets.length}
              </span>
            </div>

            {dailyTargets.length > 0 && (
              <div className="flex items-center gap-3 text-xs">
                <span className="text-slate-500">
                  Completed: <strong className="text-emerald-700">{dailyTargets.filter((t) => t.status === 'COMPLETED').length}</strong>
                </span>
                <span className="text-slate-500">
                  Partial: <strong className="text-amber-700">{dailyTargets.filter((t) => t.status === 'PARTIAL').length}</strong>
                </span>
                <span className="text-slate-500">
                  Pending: <strong className="text-blue-700">{dailyTargets.filter((t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length}</strong>
                </span>
              </div>
            )}
          </div>

          {dailyTargets.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 italic">
              No daily targets assigned for today.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {dailyTargets.map((t) => {
                const targetValue = Number(t.target_value || 0)
                const actualValue = Number(t.actual_value || 0)
                const remaining = Math.max(0, targetValue - actualValue)
                const achieved =
                  targetValue === 0
                    ? 0
                    : Math.min(100, Math.round((actualValue / targetValue) * 100))

                return (
                  <div
                    key={t.id}
                    className="rounded-xl border border-slate-200 p-4 space-y-3 bg-slate-50/50 hover:bg-white transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">
                          {t.title}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {t.projects?.name || 'General work'}
                          {t.project_modules?.name &&
                            ` · ${t.project_modules.name}`}
                          {t.project_milestones?.name &&
                            ` · ${t.project_milestones.name}`}
                        </p>
                      </div>

                      <span
                        className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full border shrink-0 ${
                          t.status === 'COMPLETED'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : t.status === 'PARTIAL'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : t.status === 'MISSED'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}
                      >
                        {t.status}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-800">
                          {actualValue} / {targetValue} {t.unit}
                        </span>
                        <span className="text-[#801424]">{achieved}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="h-full bg-[#801424] rounded-full transition-all"
                          style={{ width: `${achieved}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                        <span>
                          {remaining > 0
                            ? `${remaining} ${t.unit} remaining`
                            : 'Target achieved'}
                        </span>
                        {t.deadline_time && (
                          <span>Deadline: {t.deadline_time}</span>
                        )}
                      </div>
                    </div>

                    {t.result_reason && (
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded">
                          Reason: {t.result_reason.replaceAll('_', ' ')}
                        </span>
                        {t.result_note && (
                          <span className="text-[11px] text-slate-500 truncate max-w-45">
                            "{t.result_note}"
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Project & Module Structure */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="border-b border-slate-100 p-6 flex items-center gap-2">
            <FolderKanban className="h-5 w-5 text-slate-600" />
            <h2 className="font-semibold text-slate-900">Project & Work Area Breakdown</h2>
          </div>

          <div className="p-6 space-y-6">
            {projectHierarchy.map((proj) => (
              <div key={proj.id} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                <div className="flex items-center gap-2 font-bold text-slate-800 mb-3">
                  <FolderKanban className="h-4 w-4 text-blue-600" />
                  <Link to={`/projects/${proj.id}`} className="hover:text-blue-600">
                    {proj.name}
                  </Link>
                </div>

                <div className="space-y-4 pl-4 border-l-2 border-slate-200">
                  {proj.modules.map((mod) => (
                    <div key={mod.id}>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-2">
                        <Layers className="h-3.5 w-3.5 text-slate-400" />
                        <span>{mod.name}</span>
                      </div>

                      <div className="space-y-2">
                        {mod.items.map((item) => (
                          <div
                            key={item.id}
                            onClick={() => setSelectedWork(item)}
                            className="flex items-center justify-between rounded-lg bg-white p-3 border border-slate-200 text-xs shadow-xs cursor-pointer hover:border-[#801424] hover:shadow-sm transition"
                          >
                            <Link
                              to={`/work-items/${item.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="font-semibold text-slate-900 hover:text-blue-600 truncate max-w-xs md:max-w-md"
                            >
                              {item.title}
                            </Link>

                            <div className="flex items-center gap-3">
                              <span className="font-semibold text-slate-600">
                                {item.progress_percent || 0}%
                              </span>

                              <span
                                className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${healthBadgeClass(
                                  item.health,
                                )}`}
                              >
                                {item.health === 'RED'
                                  ? 'OVERDUE'
                                  : item.health === 'CRITICAL'
                                  ? 'EMERGENCY'
                                  : item.health}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Current Work List */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="border-b border-slate-100 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-900">
                  My Assigned Work
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Start, update, and submit your assigned work from here.
                </p>
              </div>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                {work.length} {work.length === 1 ? 'Work' : 'Works'}
              </span>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {work.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                No work items assigned to you.
              </div>
            ) : (
              work.map((item) => {
                const progress = Number(item.progress_percent || 0)

                return (
                  <div
                    key={item.id}
                    className="p-5 space-y-4 hover:bg-slate-50/40 transition"
                  >
                    {/* Work information */}
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => setSelectedWork(item)}
                          className="text-left font-bold text-slate-900 hover:text-[#801424] cursor-pointer"
                        >
                          {item.title}
                        </button>

                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                          <span>
                            Project: {item.projects?.name || 'N/A'}
                          </span>

                          {item.project_modules?.name && (
                            <span>
                              • Module: {item.project_modules.name}
                            </span>
                          )}

                          {item.deadline && (
                            <DeadlineCountdown
                              deadline={item.deadline}
                              deadlineTime={item.deadline_time || null}
                              timezone={settings?.timezone || 'Asia/Kolkata'}
                              workdayEnd={settings?.workday_end || '18:00'}
                              health={item.health}
                            />
                          )}
                        </div>
                      </div>

                      {/* Status */}
                      <span
                        className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${
                          item.status === 'TODO'
                            ? 'bg-slate-100 text-slate-700 border-slate-200'
                            : item.status === 'IN_PROGRESS'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : item.status === 'BLOCKED'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {item.status === 'TODO'
                          ? 'To Do'
                          : item.status === 'IN_PROGRESS'
                          ? 'In Progress'
                          : item.status === 'BLOCKED'
                          ? 'Blocked'
                          : 'Completed'}
                      </span>
                    </div>

                    {/* Progress */}
                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500">
                          Progress
                        </span>

                        <span className="text-sm font-bold text-slate-900">
                          {progress}%
                        </span>
                      </div>

                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full transition-all ${
                            item.status === 'DONE'
                              ? 'bg-emerald-500'
                              : item.status === 'BLOCKED'
                              ? 'bg-amber-500'
                              : 'bg-blue-500'
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Health */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${healthBadgeClass(
                          item.health,
                        )}`}
                      >
                        {item.health === 'RED'
                          ? 'OVERDUE'
                          : item.health === 'CRITICAL'
                          ? 'CRITICAL'
                          : item.health || 'ON TRACK'}
                      </span>

                      {item.carry_forward_count > 0 && (
                        <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[10px] font-bold text-orange-700">
                          Carried Forward {item.carry_forward_count}x
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                      {/* TODO */}
                      {item.status === 'TODO' && (
                        <button
                          type="button"
                          onClick={() => setSelectedWork(item)}
                          className="rounded-lg bg-[#801424] px-4 py-2 text-xs font-bold text-white hover:bg-[#9f1239] cursor-pointer"
                        >
                          Start Work
                        </button>
                      )}

                      {/* IN_PROGRESS */}
                      {item.status === 'IN_PROGRESS' && (
                        <>
                          <button
                            type="button"
                            onClick={() => setSelectedWork(item)}
                            className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 cursor-pointer"
                          >
                            Complete Work
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedWork(item)}
                            className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 cursor-pointer"
                          >
                            Put On Hold
                          </button>
                        </>
                      )}

                      {/* BLOCKED */}
                      {item.status === 'BLOCKED' && (
                        <button
                          type="button"
                          onClick={() => setSelectedWork(item)}
                          className="rounded-lg bg-[#801424] px-4 py-2 text-xs font-bold text-white hover:bg-[#9f1239] cursor-pointer"
                        >
                          Resume Work
                        </button>
                      )}

                      {/* DONE */}
                      {item.status === 'DONE' && (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700">
                          <CheckCircle2 className="h-4 w-4" />
                          Completed
                        </span>
                      )}

                      {/* DETAILS */}
                      <button
                        type="button"
                        onClick={() => setSelectedWork(item)}
                        className="ml-auto rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </section>

        {selectedWork && (
          <WorkDetailsDrawer
            work={selectedWork as any}
            linkedTarget={
              dailyTargets.find((t) => t.work_item_id === selectedWork.id) || null
            }
            onClose={() => setSelectedWork(null)}
            onChanged={async () => {
              setSelectedWork(null)
              await load()
            }}
          />
        )}
      </div>
    </div>
  )
}
