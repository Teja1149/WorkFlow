import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Flame,
  Layers,
  RefreshCw,
  Users,
  Search,
  Flag,
  Calendar,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import {
  getProjectExecution,
  type ProjectExecutionData,
  type ProjectExecutionModule,
} from '../work-execution/project-execution.service'
import type { DailyWorkItem } from '../work-execution/work-execution.types'
import DeadlineCountdown from '../work-execution/DeadlineCountdown'
import {
  getOrganizationWorkSettings,
  type OrganizationWorkSettings,
} from '../organization-settings/organization-setting.service'

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

export default function ProjectExecutionSection({
  projectId,
}: {
  projectId: string
}) {
  const { accessToken } = useAuth()

  const [data, setData] = useState<ProjectExecutionData | null>(null)
  const [settings, setSettings] = useState<OrganizationWorkSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedModuleFilter, setSelectedModuleFilter] = useState<string>('ALL')
  const [selectedMilestoneFilter, setSelectedMilestoneFilter] = useState<string>('ALL')
  const [search, setSearch] = useState('')

  async function load() {
    if (!accessToken || !projectId) return
    setLoading(true)
    setError('')

    try {
      const [res, workSettings] = await Promise.all([
        getProjectExecution(accessToken, projectId),
        getOrganizationWorkSettings(accessToken).catch(() => null),
      ])
      setData(res)
      setSettings(workSettings)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load project execution.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [accessToken, projectId])

  // Team in this project (grouped by assignee)
  const teamBreakdown = useMemo(() => {
    if (!data?.work) return []

    const map = new Map<
      string,
      {
        id: string
        name: string
        role: string
        email: string
        items: DailyWorkItem[]
      }
    >()

    for (const item of data.work) {
      if (!item.assignee) continue
      const uid = item.assignee.id

      if (!map.has(uid)) {
        map.set(uid, {
          id: uid,
          name: `${item.assignee.first_name || ''} ${item.assignee.last_name || ''}`.trim(),
          role: item.assignee.employee_id || 'Member',
          email: item.assignee.email || '',
          items: [],
        })
      }

      map.get(uid)!.items.push(item as DailyWorkItem)
    }

    return Array.from(map.values())
  }, [data])

  // Filtered work list based on module filter and search
  const filteredWork = useMemo(() => {
    if (!data?.work) return []

    return data.work.filter((item: DailyWorkItem) => {
      const matchesModule =
        selectedModuleFilter === 'ALL' || item.module_id === selectedModuleFilter

      const matchesMilestone =
        selectedMilestoneFilter === 'ALL' ||
        item.milestone_id === selectedMilestoneFilter ||
        item.project_milestones?.id === selectedMilestoneFilter

      const matchesSearch =
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.assignee?.first_name?.toLowerCase().includes(search.toLowerCase()) ||
        item.project_modules?.name?.toLowerCase().includes(search.toLowerCase()) ||
        item.project_milestones?.name?.toLowerCase().includes(search.toLowerCase())

      return matchesModule && matchesMilestone && matchesSearch
    })
  }, [data, selectedModuleFilter, selectedMilestoneFilter, search])

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xs">
        <RefreshCw className="mx-auto h-6 w-6 animate-spin text-slate-400" />
        <p className="mt-3 text-sm text-slate-500">
          Loading project execution metrics...
        </p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error || 'Unable to load execution data for this project.'}
      </div>
    )
  }

  const { summary, modules } = data

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Project Execution</h2>
          <p className="text-xs text-slate-500">
            Real-time delivery progress, module health, and workload breakdown
          </p>
        </div>

        <button
          onClick={load}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-xs"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* Executive Summary Metrics */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-9">
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 col-span-1 sm:col-span-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700">Overall Progress</p>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black text-blue-900">{summary.progress}%</span>
            <span className="text-xs text-blue-700 font-semibold">{summary.completed}/{summary.totalWork} done</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-blue-200">
            <div
              className="h-full rounded-full bg-blue-600 transition-all"
              style={{ width: `${summary.progress}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Work</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{summary.totalWork}</p>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Completed</p>
          <p className="mt-1 text-xl font-bold text-emerald-900">{summary.completed}</p>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">In Progress</p>
          <p className="mt-1 text-xl font-bold text-blue-900">{summary.inProgress}</p>
        </div>

        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-red-600">Overdue</p>
          <p className="mt-1 text-xl font-bold text-red-700">{summary.overdue}</p>
        </div>

        <div className="rounded-xl border border-red-300 bg-red-100 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-red-800">Critical</p>
          <p className="mt-1 text-xl font-bold text-red-900">{summary.critical}</p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Blocked</p>
          <p className="mt-1 text-xl font-bold text-amber-800">{summary.blocked}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Members</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{summary.memberCount}</p>
        </div>
      </div>

      {/* Module Execution Breakdown */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-slate-700" />
            <h3 className="font-bold text-slate-900">Module Execution</h3>
          </div>

          {selectedModuleFilter !== 'ALL' && (
            <button
              onClick={() => setSelectedModuleFilter('ALL')}
              className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
            >
              Clear Module Filter
            </button>
          )}
        </div>

        {modules.length === 0 ? (
          <p className="text-xs text-slate-500">No active modules defined for this project.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((mod: ProjectExecutionModule) => {
              const isSelected = selectedModuleFilter === mod.id

              return (
                <div
                  key={mod.id}
                  onClick={() =>
                    setSelectedModuleFilter(isSelected ? 'ALL' : mod.id)
                  }
                  className={`rounded-xl border p-4 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-semibold text-slate-900 truncate text-sm">
                      {mod.name}
                    </h4>
                    <span className="text-xs font-bold text-slate-700">{mod.progress}%</span>
                  </div>

                  <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-slate-800 transition-all"
                      style={{ width: `${mod.progress}%` }}
                    />
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                    <span>{mod.totalWork} work items • {mod.memberIds.length} members</span>
                    {mod.overdue > 0 && (
                      <span className="font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-md">
                        {mod.overdue} overdue
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* PROJECT DELIVERABLES (Milestones View - Step 124) */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-slate-700" />
            <h3 className="font-bold text-slate-900 tracking-tight">PROJECT DELIVERABLES</h3>
          </div>

          {selectedMilestoneFilter !== 'ALL' && (
            <button
              onClick={() => setSelectedMilestoneFilter('ALL')}
              className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
            >
              Clear Milestone Filter
            </button>
          )}
        </div>

        {(!data.milestones || data.milestones.length === 0) ? (
          <p className="text-xs text-slate-500">No active deliverables or milestones defined for this project.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.milestones.map((m) => {
              const isSelected = selectedMilestoneFilter === m.id

              return (
                <div
                  key={m.id}
                  onClick={() =>
                    setSelectedMilestoneFilter(isSelected ? 'ALL' : m.id)
                  }
                  className={`rounded-xl border p-4 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">
                        {m.name}
                      </h4>
                      {m.deadline && (
                        <p className="mt-0.5 text-xs text-slate-500 flex items-center gap-1 font-medium">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          {m.deadline}
                        </p>
                      )}
                    </div>

                    <span className={`px-2 py-0.5 rounded-md border text-[11px] font-bold ${healthBadgeClass(m.health || 'GREEN')}`}>
                      {m.health || 'GREEN'}
                    </span>
                  </div>

                  {/* Progress Bar & Percentage */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs font-semibold mb-1">
                      <span className="text-slate-500">Progress</span>
                      <span className="text-slate-900">{m.progress_percent || 0}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full transition-all ${
                          m.health === 'CRITICAL' || m.health === 'RED'
                            ? 'bg-red-600'
                            : m.health === 'ORANGE'
                            ? 'bg-orange-500'
                            : m.health === 'AMBER'
                            ? 'bg-amber-500'
                            : 'bg-emerald-600'
                        }`}
                        style={{ width: `${m.progress_percent || 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                    <span>{m.total_work_items || 0} work items</span>
                    {(m.overdue_work_items || 0) > 0 && (
                      <span className="font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-100">
                        {m.overdue_work_items} overdue
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Team in this Project */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-xs p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
          <Users className="h-5 w-5 text-slate-700" />
          <h3 className="font-bold text-slate-900">Team in this Project</h3>
        </div>

        {teamBreakdown.length === 0 ? (
          <p className="text-xs text-slate-500">No members currently assigned to work items in this project.</p>
        ) : (
          <div className="space-y-4">
            {teamBreakdown.map((member) => (
              <div key={member.id} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/employees/${member.id}/work`}
                      className="font-bold text-slate-900 hover:text-blue-600 text-sm"
                    >
                      {member.name}
                    </Link>
                    <span className="text-xs text-slate-500">({member.items.length} items)</span>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {member.items.map((item: DailyWorkItem) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <Link
                          to={`/work-items/${item.id}`}
                          className="font-semibold text-slate-800 hover:text-blue-600 truncate block"
                        >
                          {item.title}
                        </Link>
                        <span className="text-[11px] text-slate-400">
                          {item.project_modules?.name || 'General'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-bold text-slate-700">{item.progress_percent || 0}%</span>
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
        )}
      </section>

      {/* Project Work List Table */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="font-bold text-slate-900">Project Work Items</h3>
            <p className="text-xs text-slate-500">
              {filteredWork.length} work items matching current scope
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search work..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500 bg-white w-48"
              />
            </div>

            <select
              value={selectedModuleFilter}
              onChange={(e) => setSelectedModuleFilter(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
            >
              <option value="ALL">All Modules</option>
              {modules.map((m: ProjectExecutionModule) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3">Work Title</th>
                <th className="px-4 py-3">Work Type</th>
                <th className="px-4 py-3">Module</th>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Deadline</th>
                <th className="px-4 py-3">Health</th>
                <th className="px-4 py-3 text-right">Progress</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredWork.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-400">
                    No work items found matching filters.
                  </td>
                </tr>
              ) : (
                filteredWork.map((item: DailyWorkItem) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-3.5 font-semibold text-slate-900">
                      <Link
                        to={`/work-items/${item.id}`}
                        className="hover:text-blue-600 transition"
                      >
                        {item.title}
                      </Link>
                    </td>

                    <td className="px-4 py-3.5 text-slate-600">
                      {item.work_types?.name || 'General'}
                    </td>

                    <td className="px-4 py-3.5 text-slate-600">
                      {item.project_modules?.name || 'General'}
                    </td>

                    <td className="px-4 py-3.5">
                      {item.assignee ? (
                        <Link
                          to={`/employees/${item.assignee.id}/work`}
                          className="font-medium text-slate-800 hover:text-blue-600"
                        >
                          {item.assignee.first_name} {item.assignee.last_name || ''}
                        </Link>
                      ) : (
                        <span className="text-slate-400">Unassigned</span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-slate-700 font-medium">
                      {item.status}
                    </td>

                    <td className="px-4 py-3.5 text-slate-600">
                      <DeadlineCountdown
                        deadline={item.deadline}
                        deadlineTime={item.deadline_time || null}
                        timezone={settings?.timezone || 'Asia/Kolkata'}
                        workdayEnd={settings?.workday_end || '18:00'}
                        health={item.health}
                      />
                    </td>

                    <td className="px-4 py-3.5">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${healthBadgeClass(
                          item.health,
                        )}`}
                      >
                        {item.health === 'RED'
                          ? 'OVERDUE'
                          : item.health === 'CRITICAL'
                          ? 'EMERGENCY'
                          : item.health}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-right font-bold text-slate-900">
                      {item.progress_percent || 0}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
