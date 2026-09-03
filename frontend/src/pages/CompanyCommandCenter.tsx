import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Clock3,
  RefreshCw,
  ShieldAlert,
  Users,
} from 'lucide-react'

import { useAuth } from '../features/auth/AuthContext'
import { getCompanyExecution } from '../features/work-execution/company-execution.service'
import type { CompanyExecutionData } from '../features/work-execution/company-execution.service'
import EmployeeCapacitySection from '../features/work-execution/EmployeeCapacitySection'
import ManagementIntelligenceSection from '../features/work-analytics/ManagementIntelligenceSection'

function healthClass(health: string) {
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

function fullName(
  person?: {
    first_name?: string
    last_name?: string
  } | null,
) {
  if (!person) return 'Unassigned'
  return `${person.first_name || ''} ${person.last_name || ''}`.trim()
}

export default function CompanyCommandCenter() {
  const { accessToken } = useAuth()

  const [data, setData] =
    useState<CompanyExecutionData | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [projectFilter, setProjectFilter] = useState('ALL')
  const [moduleFilter, setModuleFilter] = useState('ALL')
  const [employeeFilter, setEmployeeFilter] = useState('ALL')
  const [workTypeFilter, setWorkTypeFilter] = useState('ALL')
  const [healthFilter, setHealthFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')

  async function load() {
    if (!accessToken) return

    setLoading(true)
    setError('')

    try {
      const result =
        await getCompanyExecution(accessToken)

      setData(result)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load company execution.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [accessToken])

  const filteredWork = useMemo(() => {
    return (data?.work || []).filter((item) => {
      const matchesProject =
        projectFilter === 'ALL' ||
        item.project_id === projectFilter

      const matchesModule =
        moduleFilter === 'ALL' ||
        item.module_id === moduleFilter

      const matchesEmployee =
        employeeFilter === 'ALL' ||
        item.assigned_to === employeeFilter

      const matchesWorkType =
        workTypeFilter === 'ALL' ||
        item.work_type_id === workTypeFilter

      const matchesHealth =
        healthFilter === 'ALL' ||
        item.health === healthFilter

      const matchesStatus =
        statusFilter === 'ALL' ||
        item.status === statusFilter

      return (
        matchesProject &&
        matchesModule &&
        matchesEmployee &&
        matchesWorkType &&
        matchesHealth &&
        matchesStatus
      )
    })
  }, [
    data,
    projectFilter,
    moduleFilter,
    employeeFilter,
    workTypeFilter,
    healthFilter,
    statusFilter,
  ])

  const employees = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string
        name: string
        assigned: number
        completed: number
        overdue: number
        critical: number
      }
    >()

    for (const item of filteredWork) {
      if (!item.assigned_to) continue

      const person = item.assignee

      const existing =
        map.get(item.assigned_to) || {
          id: item.assigned_to,
          name: fullName(person),
          assigned: 0,
          completed: 0,
          overdue: 0,
          critical: 0,
        }

      existing.assigned += 1

      if (item.status === 'DONE') {
        existing.completed += 1
      }

      if (item.health === 'RED') {
        existing.overdue += 1
      }

      if (item.health === 'CRITICAL') {
        existing.critical += 1
      }

      map.set(item.assigned_to, existing)
    }

    return Array.from(map.values())
      .sort(
        (a, b) =>
          b.overdue -
          a.overdue ||
          b.critical -
          a.critical ||
          b.assigned -
          a.assigned,
      )
  }, [filteredWork])

  const projects = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string
        name: string
        key: string
        total: number
        completed: number
        overdue: number
        critical: number
      }
    >()

    for (const item of filteredWork) {
      const project = item.projects
      if (!project) continue

      const existing =
        map.get(project.id) || {
          id: project.id,
          name: project.name,
          key: project.project_key,
          total: 0,
          completed: 0,
          overdue: 0,
          critical: 0,
        }

      existing.total += 1

      if (item.status === 'DONE') {
        existing.completed += 1
      }

      if (item.health === 'RED') {
        existing.overdue += 1
      }

      if (item.health === 'CRITICAL') {
        existing.critical += 1
      }

      map.set(project.id, existing)
    }

    return Array.from(map.values())
      .sort(
        (a, b) =>
          b.critical -
          a.critical ||
          b.overdue -
          a.overdue,
      )
  }, [filteredWork])

  if (loading) {
    return (
      <div className="p-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <RefreshCw className="mx-auto h-6 w-6 animate-spin text-slate-400" />
          <p className="mt-3 text-sm text-slate-500">
            Loading company command center...
          </p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
          {error || 'Unable to load company execution data.'}
        </div>
      </div>
    )
  }

  const { summary } = data

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-slate-500">
              Organization overview
            </p>

            <h1 className="mt-1 text-3xl font-bold text-slate-900">
              Company Command Center
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Live visibility into company work, teams, projects, risks and execution. Showing {filteredWork.length} of {data.work.length} items.
            </p>
          </div>

          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Filter Bar */}
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm bg-white outline-none focus:border-zinc-800"
            >
              <option value="ALL">All Projects</option>
              {Array.from(
                new Map(
                  (data?.work || [])
                    .filter((x) => x.projects)
                    .map((x) => [x.project_id, x.projects])
                ).values()
              ).map((project) => (
                <option
                  key={project!.id}
                  value={project!.id}
                >
                  {project!.project_key} — {project!.name}
                </option>
              ))}
            </select>

            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm bg-white outline-none focus:border-zinc-800"
            >
              <option value="ALL">All Modules</option>
              {Array.from(
                new Map(
                  (data?.work || [])
                    .filter((x) => x.project_modules)
                    .map((x) => [
                      x.module_id,
                      x.project_modules,
                    ])
                ).values()
              ).map((module) => (
                <option
                  key={module!.id}
                  value={module!.id}
                >
                  {module!.name}
                </option>
              ))}
            </select>

            <select
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm bg-white outline-none focus:border-zinc-800"
            >
              <option value="ALL">All Employees</option>
              {Array.from(
                new Map(
                  (data?.work || [])
                    .filter((x) => x.assignee)
                    .map((x) => [
                      x.assigned_to,
                      x.assignee,
                    ])
                ).values()
              ).map((employee) => (
                <option
                  key={employee!.id}
                  value={employee!.id}
                >
                  {employee!.first_name} {employee!.last_name}
                </option>
              ))}
            </select>

            <select
              value={workTypeFilter}
              onChange={(e) => setWorkTypeFilter(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm bg-white outline-none focus:border-zinc-800"
            >
              <option value="ALL">All Work Types</option>
              {Array.from(
                new Map(
                  (data?.work || [])
                    .filter((x) => x.work_types)
                    .map((x) => [
                      x.work_type_id,
                      x.work_types,
                    ])
                ).values()
              ).map((type) => (
                <option key={type!.id} value={type!.id}>
                  {type!.name}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm bg-white outline-none focus:border-zinc-800"
            >
              <option value="ALL">All Statuses</option>
              <option value="TODO">TODO</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="BLOCKED">BLOCKED</option>
              <option value="DONE">DONE</option>
            </select>

            <select
              value={healthFilter}
              onChange={(e) => setHealthFilter(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm bg-white outline-none focus:border-zinc-800"
            >
              <option value="ALL">All Health</option>
              <option value="GREEN">GREEN</option>
              <option value="AMBER">AMBER</option>
              <option value="ORANGE">ORANGE</option>
              <option value="RED">RED</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              onClick={() => setHealthFilter('RED')}
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 cursor-pointer"
            >
              Show Overdue
            </button>

            <button
              onClick={() => setHealthFilter('CRITICAL')}
              className="rounded-lg border border-red-300 bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-200 cursor-pointer"
            >
              Show Critical
            </button>

            <button
              onClick={() => {
                setProjectFilter('ALL')
                setModuleFilter('ALL')
                setEmployeeFilter('ALL')
                setWorkTypeFilter('ALL')
                setHealthFilter('ALL')
                setStatusFilter('ALL')
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Company KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase text-slate-400">
              Total Work
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {summary.totalWork}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="text-xs font-semibold uppercase text-emerald-700">
              Completed
            </p>
            <p className="mt-2 text-3xl font-bold text-emerald-800">
              {summary.completed}
            </p>
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
            <p className="text-xs font-semibold uppercase text-blue-700">
              In Progress
            </p>
            <p className="mt-2 text-3xl font-bold text-blue-800">
              {summary.inProgress}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase text-slate-500">
              Pending
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-800">
              {summary.pending}
            </p>
          </div>

          <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <p className="text-xs font-semibold uppercase text-red-600">
              Overdue
            </p>
            <p className="mt-2 text-3xl font-bold text-red-700">
              {summary.overdue}
            </p>
          </div>

          <div className="rounded-2xl border border-red-300 bg-red-100 p-5">
            <p className="text-xs font-semibold uppercase text-red-700">
              Critical
            </p>
            <p className="mt-2 text-3xl font-bold text-red-800">
              {summary.critical}
            </p>
          </div>

          <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5">
            <p className="text-xs font-semibold uppercase text-orange-700">
              Carry Forward
            </p>
            <p className="mt-2 text-3xl font-bold text-orange-800">
              {summary.carriedForward}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase text-slate-500">
              Completion
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {summary.completionRate}%
            </p>
          </div>
        </div>

        {/* Execution health */}
        <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <section className="rounded-2xl border border-slate-200 bg-white shadow-xs">
            <div className="border-b border-slate-100 p-6">
              <h2 className="text-lg font-semibold text-slate-900">
                Project Execution
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Projects requiring the most attention appear first.
              </p>
            </div>

            <div className="divide-y divide-slate-100">
              {projects.length === 0 ? (
                <div className="p-10 text-center text-sm text-slate-500">
                  No project work found for current filters.
                </div>
              ) : (
                projects.map((project) => {
                  const percent =
                    project.total === 0
                      ? 0
                      : Math.round(
                          (project.completed / project.total) * 100,
                        )

                  return (
                    <div key={project.id} className="p-5">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-400">
                              {project.key}
                            </span>

                            <Link
                              to={`/projects/${project.id}`}
                              className="font-semibold text-slate-900 hover:text-blue-600 transition"
                            >
                              {project.name}
                            </Link>
                          </div>

                          <div className="mt-2 flex flex-wrap gap-2 text-xs">
                            {project.overdue > 0 && (
                              <span className="rounded-full bg-red-50 px-2.5 py-1 font-semibold text-red-700">
                                {project.overdue} overdue
                              </span>
                            )}

                            {project.critical > 0 && (
                              <span className="rounded-full bg-red-100 px-2.5 py-1 font-semibold text-red-800">
                                {project.critical} critical
                              </span>
                            )}
                          </div>
                        </div>

                        <span className="text-lg font-bold text-slate-900">
                          {percent}%
                        </span>
                      </div>

                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-slate-700 transition-all"
                          style={{
                            width: `${percent}%`,
                          }}
                        />
                      </div>

                      <p className="mt-2 text-xs text-slate-500">
                        {project.completed} of {project.total} completed
                      </p>
                    </div>
                  )
                })
              )}
            </div>
          </section>

          {/* Employee workload */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-xs">
            <div className="border-b border-slate-100 p-6">
              <h2 className="text-lg font-semibold text-slate-900">
                Employee Workload
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Employees with the most risk appear first.
              </p>
            </div>

            <div className="divide-y divide-slate-100">
              {employees.map((employee) => {
                const percent =
                  employee.assigned === 0
                    ? 0
                    : Math.round(
                        (employee.completed / employee.assigned) * 100,
                      )

                return (
                  <div key={employee.id} className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
                          {employee.name.slice(0, 2).toUpperCase()}
                        </div>

                        <div className="min-w-0">
                          <Link
                            to={`/employees/${employee.id}/work`}
                            className="truncate text-sm font-semibold text-slate-800 hover:text-blue-600 transition"
                          >
                            {employee.name}
                          </Link>

                          <p className="text-xs text-slate-500">
                            {employee.completed}/{employee.assigned} complete
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {employee.overdue > 0 && (
                          <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
                            {employee.overdue} overdue
                          </span>
                        )}

                        {employee.critical > 0 && (
                          <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-800">
                            {employee.critical} critical
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-slate-700 transition-all"
                        style={{
                          width: `${percent}%`,
                        }}
                      />
                    </div>
                  </div>
                )
              })}

              {employees.length === 0 && (
                <div className="p-10 text-center text-sm text-slate-500">
                  No assigned employees found for current filters.
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Management Intelligence: Bottlenecks, Root Blockers & Recommendations (Steps 159-164) */}
        <ManagementIntelligenceSection />

        {/* Employee Capacity Dashboard & Smart Reassignments (Steps 137 & 138) */}
        <EmployeeCapacitySection />

        {/* Filtered Work Queue */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center gap-3 border-b border-slate-100 p-6">
            <ShieldAlert className="h-5 w-5 text-red-600" />

            <div>
              <h2 className="font-semibold text-slate-900">
                Filtered Work Queue ({filteredWork.length})
              </h2>

              <p className="text-sm text-slate-500">
                Work items matching your current filter configuration.
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {filteredWork.slice(0, 30).map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <Link
                    to={`/work-items/${item.id}`}
                    className="font-semibold text-slate-900 hover:text-blue-600 transition"
                  >
                    {item.title}
                  </Link>

                  <p className="mt-1 text-sm text-slate-500">
                    {item.projects && (
                      <Link
                        to={`/projects/${item.project_id}`}
                        className="hover:text-blue-600 transition"
                      >
                        {item.projects.project_key} · {item.projects.name}
                      </Link>
                    )}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.project_modules?.name && (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                        {item.project_modules.name}
                      </span>
                    )}

                    {item.assignee && (
                      <Link
                        to={`/employees/${item.assignee.id}/work`}
                        className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 hover:text-blue-600 transition"
                      >
                        {fullName(item.assignee)}
                      </Link>
                    )}

                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${healthClass(
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

                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">
                    {item.progress_percent || 0}%
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Deadline: {item.deadline || 'Not set'}
                  </p>
                </div>
              </div>
            ))}

            {filteredWork.length === 0 && (
              <div className="p-12 text-center text-sm text-slate-500">
                No work items match the current filter parameters.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
