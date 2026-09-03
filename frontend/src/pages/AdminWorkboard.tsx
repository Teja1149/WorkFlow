import { useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  Clock3,
  Plus,
  RefreshCw,
  Search,
  X,
  Layers3,
  Gauge,
} from 'lucide-react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthContext'
import { getEmployees } from '../features/employees/employee.service'
import {
  getWorkItems,
  updateWorkItem,
  type WorkItem,
} from '../features/work-items/work-item.service'
import {
  subscribeToWorkItems,
  subscribeToWorkUpdates,
} from '../features/work-items/work-item.realtime'
import {
  subscribeToDailyTargets,
} from '../features/daily-targets/daily-target.realtime'
import {
  createDailyTarget,
  createDailyTargetWithWorkItem,
  getTeamDailyTargets,
} from '../features/daily-targets/daily-target.service'
import { getProjects, type Project } from '../features/projects/project.service'
import { getWorkTypes } from '../features/work-types/work-type.service'
import type { WorkType } from '../features/work-types/work-type.types'
import { getProjectMilestones } from '../features/project-milestones/project-milestone.service'
import type { ProjectMilestone } from '../features/project-milestones/project-milestone.types'
import { getProjectSprints } from '../features/sprints/sprint.service'
import type { Sprint } from '../features/sprints/sprint.types'
import {
  getOrganizationWorkSettings,
  type OrganizationWorkSettings,
} from '../features/organization-settings/organization-setting.service'
import {
  createRecurringWork,
  generateRecurringWork,
} from '../features/recurring-work/recurring-work.service'
import { getReassignmentRecommendations } from '../features/work-analytics/work-analytics.service'
import type { DailyTarget } from '../features/daily-targets/daily-target.types'
import WorkDetailsDrawer from '../features/work-items/WorkDetailsDrawer'
import {
  getWorkStatusConfig,
} from '../features/work-items/work-status'
import {
  targetAchievement,
} from '../features/daily-targets/daily-target.ui'

type Employee = {
  id: string
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  employee_id?: string | null
  role?: string | null
}

type EmployeeRow = {
  employee: Employee
  current: WorkItem[]
  targets: DailyTarget[]
  recent: WorkItem[]
  achievement: number
  capacityUtilization: number
  isOverloaded: boolean
  highestSeverity: 'CRITICAL' | 'RED' | 'ORANGE' | 'AMBER' | 'GREEN'
}

function fullName(employee: Employee) {
  return (
    `${employee.first_name || ''} ${employee.last_name || ''}`.trim() ||
    employee.email ||
    'Employee'
  )
}

function getInitials(employee: Employee) {
  const first = employee.first_name?.charAt(0) || ''
  const last = employee.last_name?.charAt(0) || ''
  return (first + last).toUpperCase() || 'E'
}

function getWorkItemHealth(item: WorkItem): string {
  if (item.status === 'DONE') {
    if (!item.completed_at || !item.deadline) return 'GREEN'
    return new Date(item.completed_at).getTime() <=
      new Date(`${item.deadline}T23:59:59`).getTime()
      ? 'GREEN'
      : 'RED'
  }
  return (item as any).health || 'GREEN'
}

export function getWorkStatusLabel(status?: string | null) {
  return getWorkStatusConfig(status).label
}

export function getWorkStatusClass(status?: string | null) {
  return getWorkStatusConfig(status).badge
}

function getRowHighestSeverity(
  targets: DailyTarget[],
  current: WorkItem[],
): 'CRITICAL' | 'RED' | 'ORANGE' | 'AMBER' | 'GREEN' {
  if (targets.some((t) => t.health === 'CRITICAL')) return 'CRITICAL'
  if (
    targets.some((t) => t.health === 'RED') ||
    current.some((w) => getWorkItemHealth(w) === 'RED')
  )
    return 'RED'
  if (
    targets.some((t) => t.health === 'ORANGE') ||
    current.some((w) => getWorkItemHealth(w) === 'ORANGE')
  )
    return 'ORANGE'
  if (
    targets.some((t) => t.health === 'AMBER') ||
    current.some((w) => getWorkItemHealth(w) === 'AMBER')
  )
    return 'AMBER'
  return 'GREEN'
}

function severityScore(severity: string, currentCount: number): number {
  if (severity === 'CRITICAL') return 5
  if (severity === 'RED') return 4
  if (severity === 'ORANGE') return 3
  if (severity === 'AMBER') return 2
  if (currentCount === 0) return 0
  return 1
}

export default function AdminWorkboard() {
  const { accessToken, profile } = useAuth()
  const navigate = useNavigate()

  const [employees, setEmployees] = useState<Employee[]>([])
  const [workItems, setWorkItems] = useState<WorkItem[]>([])
  const [dailyTargets, setDailyTargets] = useState<DailyTarget[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [workTypes, setWorkTypes] = useState<WorkType[]>([])
  const [capacities, setCapacities] = useState<Record<string, { utilizationPercent: number; isOverloaded: boolean }>>({})
  const [settings, setSettings] = useState<OrganizationWorkSettings | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Selected work for details drawer
  const [selectedWork, setSelectedWork] = useState<WorkItem | null>(null)

  // Unified Assign Work Drawer State
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignEmployee, setAssignEmployee] = useState<Employee | null>(null)
  const [assignStartMode, setAssignStartMode] = useState<
    'NEW' | 'EXISTING'
  >('NEW')
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  async function loadData() {
    if (!accessToken) return
    setError('')

    try {
      const [
        employeeData,
        workData,
        targetData,
        projectData,
        workTypeData,
        analyticsData,
        workSettings,
      ] = await Promise.all([
        getEmployees(accessToken),
        getWorkItems(accessToken).catch(() => []),
        getTeamDailyTargets(accessToken).catch(() => null),
        getProjects(accessToken).catch(() => []),
        getWorkTypes(accessToken).catch(() => []),
        getReassignmentRecommendations(accessToken).catch(() => null),
        getOrganizationWorkSettings(accessToken).catch(() => null),
      ])

      setEmployees(
        Array.isArray(employeeData)
          ? employeeData.filter(
              (emp: Employee) => emp.role === 'EMPLOYEE' || emp.role === 'MANAGER',
            )
          : [],
      )

      setWorkItems(Array.isArray(workData) ? workData : [])
      setDailyTargets(targetData?.targets || [])
      setProjects(Array.isArray(projectData) ? projectData : [])
      setWorkTypes(Array.isArray(workTypeData) ? workTypeData : [])
      setSettings(workSettings)

      if (Array.isArray(analyticsData)) {
        const map: Record<string, { utilizationPercent: number; isOverloaded: boolean }> = {}
        analyticsData.forEach((r) => {
          if (r.employee?.id) {
            map[r.employee.id] = {
              utilizationPercent: Math.round(r.utilization || 0),
              isOverloaded: r.workload === 'OVERLOADED',
            }
          }
        })
        setCapacities(map)
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load company workboard.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [accessToken])

  // Fast 5-second polling interval for live updates
  useEffect(() => {
    if (!accessToken) return
    const interval = window.setInterval(() => {
      void loadData()
    }, 5_000)
    return () => window.clearInterval(interval)
  }, [accessToken])

  // Supabase Realtime Subscriptions for immediate reflection
  useEffect(() => {
    if (!profile?.organization_id) return

    const unsubscribeWork = subscribeToWorkItems(
      profile.organization_id,
      () => {
        void loadData()
      },
    )

    const unsubscribeUpdates = subscribeToWorkUpdates(
      profile.organization_id,
      () => {
        void loadData()
      },
    )

    const unsubscribeTargets = subscribeToDailyTargets(
      profile.organization_id,
      () => {
        void loadData()
      },
    )

    return () => {
      unsubscribeWork()
      unsubscribeUpdates()
      unsubscribeTargets()
    }
  }, [profile?.organization_id])

  // Build and sort rows
  const rows = useMemo<EmployeeRow[]>(() => {
    const rawRows = employees
      .filter((employee) => {
        const query = search.trim().toLowerCase()
        if (!query) return true

        return (
          fullName(employee).toLowerCase().includes(query) ||
          employee.employee_id?.toLowerCase().includes(query)
        )
      })
      .map((employee) => {
        const employeeWork = workItems.filter(
          (item) => item.assigned_to === employee.id,
        )

        const current = [...employeeWork].sort((a, b) => {
          // Active work first, completed work last.
          if (a.status === 'DONE' && b.status !== 'DONE') return 1
          if (a.status !== 'DONE' && b.status === 'DONE') return -1

          // Within active work, earliest deadline first.
          if (a.status !== 'DONE' && b.status !== 'DONE') {
            return (
              new Date(a.deadline || '9999-12-31').getTime() -
              new Date(b.deadline || '9999-12-31').getTime()
            )
          }

          // Within completed work, newest completed first.
          return (
            new Date(b.completed_at || 0).getTime() -
            new Date(a.completed_at || 0).getTime()
          )
        })

        const recent = employeeWork
          .filter((item) => item.status === 'DONE')
          .sort(
            (a, b) =>
              new Date(b.completed_at || 0).getTime() -
              new Date(a.completed_at || 0).getTime(),
          )
          .slice(0, 5)

        const employeeTargets = dailyTargets.filter(
          (target) => target.employee_id === employee.id,
        )

        const targetPercents = employeeTargets.map((t) =>
          targetAchievement(t.target_value, t.actual_value),
        )
        const achievement =
          targetPercents.length > 0
            ? Math.round(
                targetPercents.reduce((sum, p) => sum + p, 0) /
                  targetPercents.length,
              )
            : 0

        const cap = capacities[employee.id] || {
          utilizationPercent: Math.min(150, Math.round((current.length / 4) * 100)),
          isOverloaded: current.length > 4,
        }

        const highestSeverity = getRowHighestSeverity(employeeTargets, current)

        return {
          employee,
          current,
          targets: employeeTargets,
          recent,
          achievement,
          capacityUtilization: cap.utilizationPercent,
          isOverloaded: cap.isOverloaded,
          highestSeverity,
        }
      })

    // Sort by severity (Critical -> Red -> Orange -> Amber -> Green -> No Work)
    return [...rawRows].sort(
      (a, b) =>
        severityScore(b.highestSeverity, b.current.length) -
        severityScore(a.highestSeverity, a.current.length),
    )
  }, [employees, workItems, dailyTargets, capacities, search])

  const summary = useMemo(() => {
    const active = workItems.filter((item) => item.status !== 'DONE')
    const overdue = active.filter((item) => getWorkItemHealth(item) === 'RED')
    return {
      employees: employees.length,
      active: active.length,
      overdue: overdue.length,
    }
  }, [employees, workItems])

  function showSuccessToast(message: string) {
    setToastMessage(message)
    setTimeout(() => {
      setToastMessage(null)
    }, 6000)
  }

  if (loading && rows.length === 0) {
    return (
      <div className="p-12 text-center text-slate-500 text-xs font-semibold">
        <RefreshCw className="mx-auto h-6 w-6 animate-spin text-slate-400 mb-2" />
        Loading company workboard...
      </div>
    )
  }

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-6 lg:p-8 space-y-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* TOAST NOTIFICATION */}
        {toastMessage && (
          <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-slate-700 text-xs font-bold flex items-center gap-3 animate-bounce">
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* HEADER */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              TEAM EXECUTION BOARD
            </h1>
            <p className="mt-1 text-xs text-slate-500 font-medium">
              {summary.employees} Team Members · {summary.active} Active Work · {summary.overdue} At Risk
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            <div className="relative w-48 sm:w-56 lg:w-64 shrink-0">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search employee..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-8.5 pr-3 text-xs outline-none focus:border-[#801424] shadow-2xs"
              />
            </div>

            <Link
              to="/work-types"
              className="h-10 inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs cursor-pointer transition"
            >
              <Layers3 className="h-4 w-4 text-[#801424]" />
              <span>Work Types</span>
            </Link>

            <Link
              to="/my-workload"
              className="h-10 inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs cursor-pointer transition"
            >
              <Gauge className="h-4 w-4 text-[#801424]" />
              <span>My Workload</span>
            </Link>

            <button
              onClick={() => {
                setAssignEmployee(null)
                setAssignStartMode('NEW')
                setAssignOpen(true)
              }}
              className="h-10 inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 rounded-xl bg-[#801424] px-4 text-xs font-bold text-white hover:bg-[#9f1239] shadow-xs cursor-pointer transition"
            >
              <Plus className="h-4 w-4" />
              <span>Plan & Assign Work</span>
            </button>

            <button
              onClick={loadData}
              disabled={loading}
              title="Refresh"
              className="h-10 w-10 inline-flex items-center justify-center shrink-0 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-2xs cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-700">
            {error}
          </div>
        )}

        {/* HORIZONTAL EMPLOYEE WORKBOARD WITH FIXED ACTION COLUMN */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="grid grid-cols-[220px_minmax(0,1fr)_120px] border-b border-slate-200 bg-slate-50">
            <div className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              EMPLOYEE
            </div>

            <div className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              CURRENT WORKS
            </div>

            <div className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500">
              ACTION
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {rows.map((row) => (
              <EmployeeWorkRow
                key={row.employee.id}
                row={row}
                onEmployeeClick={() =>
                  navigate(`/employees/${row.employee.id}/work`)
                }
                onNewWork={() => {
                  setAssignEmployee(row.employee)
                  setAssignStartMode('NEW')
                  setAssignOpen(true)
                }}
                onSelectWork={(item) => setSelectedWork(item)}
              />
            ))}

            {rows.length === 0 && (
              <div className="p-12 text-center text-slate-400 text-xs font-semibold">
                No employees match the current search query.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Unified Assign Work Drawer */}
      {assignOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setAssignOpen(false)}
          />

          <aside className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl animate-slideInRight flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 p-6">
                <div>
                  <h2 className="text-lg font-black text-slate-900">
                    Plan & Assign Work
                  </h2>

                  <p className="mt-1 text-xs text-slate-500">
                    Configure the work, target, schedule and people in one place.
                  </p>
                </div>

                <button
                  onClick={() => setAssignOpen(false)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <UnifiedAssignWorkDrawer
                initialEmployee={assignEmployee}
                initialSourceMode={assignStartMode}
                employees={employees}
                workItems={workItems}
                projects={projects}
                workTypes={workTypes}
                dailyTargets={dailyTargets}
                capacities={capacities}
                onClose={() => setAssignOpen(false)}
                onAssigned={async (summaryTitle) => {
                  setAssignOpen(false)
                  showSuccessToast(summaryTitle || '✓ Work Assigned Successfully')
                  await loadData()
                }}
              />
            </div>
          </aside>
        </div>
      )}

      {/* Work Details Drawer */}
      {selectedWork && (
        <WorkDetailsDrawer
          work={selectedWork}
          linkedTarget={
            dailyTargets.find((t) => t.work_item_id === selectedWork.id) || null
          }
          onClose={() => setSelectedWork(null)}
          onChanged={async () => {
            setSelectedWork(null)
            await loadData()
          }}
        />
      )}
    </div>
  )
}

function EmployeeWorkRow({
  row,
  onEmployeeClick,
  onNewWork,
  onSelectWork,
}: {
  row: EmployeeRow
  onEmployeeClick: () => void
  onNewWork: () => void
  onSelectWork: (item: WorkItem) => void
}) {
  return (
    <div className="bg-white hover:bg-slate-50/40 transition">
      <div className="grid grid-cols-[220px_minmax(0,1fr)_120px] min-h-47.5 items-stretch">

        {/* EMPLOYEE */}
        <div className="border-r border-slate-100 bg-white px-5 py-5 flex flex-col justify-center">
          <button
            type="button"
            onClick={onEmployeeClick}
            className="flex w-full items-start gap-3 text-left cursor-pointer group"
          >
            <div className="relative shrink-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#801424] text-xs font-bold text-white shadow-sm">
                {getInitials(row.employee)}
              </div>

              <span
                className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white ${
                  row.highestSeverity === 'CRITICAL' ||
                  row.highestSeverity === 'RED'
                    ? 'bg-rose-500'
                    : row.highestSeverity === 'ORANGE'
                    ? 'bg-orange-500'
                    : row.highestSeverity === 'AMBER'
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
              />
            </div>

            <div className="min-w-0 pt-0.5">
              <p className="truncate text-sm font-bold text-slate-900 group-hover:text-[#801424]">
                {fullName(row.employee)}
              </p>

              <p className="mt-1 text-xs text-slate-400">
                {row.current.filter((item) => item.status !== 'DONE').length} active
                {' · '}
                {row.current.filter((item) => item.status === 'DONE').length} completed
              </p>

              {row.isOverloaded && (
                <p className="mt-2 text-[10px] font-bold text-red-600">
                  OVERLOADED
                </p>
              )}
            </div>
          </button>
        </div>

        {/* WORKS — HORIZONTAL SCROLLABLE */}
        <div className="min-w-0 overflow-x-auto border-r border-slate-100">
          <div className="flex min-w-max items-stretch gap-3 p-4">
            {row.current.map((item) => (
              <WorkCard
                key={item.id}
                item={item}
                onClick={() => onSelectWork(item)}
              />
            ))}

            {row.current.length === 0 && (
              <div className="flex min-h-38.75 w-50 min-w-50 shrink-0 items-center justify-center rounded-xl border border-dashed border-slate-200 text-xs italic text-slate-400">
                No assigned work
              </div>
            )}
          </div>
        </div>

        {/* FIXED ACTION COLUMN ON RIGHT */}
        <div className="flex items-center justify-center p-3 bg-slate-50/20">
          <button
            type="button"
            onClick={onNewWork}
            className="flex flex-col items-center justify-center gap-1.5 h-full max-h-38.75 w-full rounded-xl border-2 border-dashed border-slate-200 bg-white text-slate-500 transition hover:border-[#801424]/40 hover:bg-[#801424]/5 hover:text-[#801424] cursor-pointer p-2 shadow-2xs"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-current">
              <Plus size={15} />
            </div>

            <span className="text-[11px] font-bold text-center">
              + New Work
            </span>
          </button>
        </div>

      </div>
    </div>
  )
}

function WorkCard({
  item,
  onClick,
}: {
  item: WorkItem
  onClick?: () => void
}) {
  const health = getWorkItemHealth(item)
  const isOverdue = health === 'RED'
  const progress = Math.min(
    100,
    Math.max(0, Number(item.progress_percent || 0)),
  )

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex min-h-38.75 w-57.5 min-w-57.5 shrink-0 flex-col rounded-xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md cursor-pointer ${
        isOverdue
          ? 'border-red-300 bg-red-50/40 hover:border-red-400'
          : item.status === 'DONE'
          ? 'border-emerald-300 bg-emerald-50/40 hover:border-emerald-400'
          : item.status === 'IN_PROGRESS'
          ? 'border-blue-300 bg-blue-50/40 hover:border-blue-400'
          : item.status === 'BLOCKED'
          ? 'border-orange-300 bg-orange-50/40 hover:border-orange-400'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      {/* TITLE */}
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-sm font-bold text-slate-900 group-hover:text-[#801424]">
          {item.title}
        </p>

        {isOverdue && (
          <span className="shrink-0 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[9px] font-extrabold uppercase text-red-700">
            Overdue
          </span>
        )}
      </div>

      {/* PROGRESS */}
      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Progress
          </span>

          <span className="text-sm font-extrabold text-slate-900">
            {progress}%
          </span>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all ${
              item.status === 'DONE'
                ? 'bg-emerald-500'
                : isOverdue
                ? 'bg-red-500'
                : 'bg-[#801424]'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* STATUS */}
      <div className="mt-4 flex items-center justify-between gap-2">
        <span
          className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${getWorkStatusClass(
            item.status,
          )}`}
        >
          {getWorkStatusLabel(item.status)}
        </span>

        {item.priority && (
          <span className="text-[10px] font-semibold text-slate-400">
            {item.priority}
          </span>
        )}
      </div>

      {/* DEADLINE */}
      <div className="mt-auto pt-3">
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <Clock3 size={11} />

          <span>
            {item.deadline
              ? `Due ${item.deadline}`
              : 'No deadline'}
          </span>
        </div>
      </div>
    </button>
  )
}

// Unified Assign Work Drawer with Individual and Daily Recurring support
function UnifiedAssignWorkDrawer({
  initialEmployee,
  initialSourceMode,
  employees,
  workItems,
  projects,
  workTypes,
  dailyTargets,
  capacities,
  onClose,
  onAssigned,
}: {
  initialEmployee: Employee | null
  initialSourceMode: 'NEW' | 'EXISTING'
  employees: Employee[]
  workItems: WorkItem[]
  projects: Project[]
  workTypes: WorkType[]
  dailyTargets: DailyTarget[]
  capacities: Record<string, { utilizationPercent: number; isOverloaded: boolean }>
  onClose: () => void
  onAssigned: (summaryTitle?: string) => Promise<void>
}) {
  const { accessToken } = useAuth()
  const [assignmentCategory, setAssignmentCategory] = useState<'INDIVIDUAL' | 'RECURRING'>('INDIVIDUAL')
  const [sourceMode, setSourceMode] = useState<'NEW' | 'EXISTING'>(
    initialSourceMode,
  )

  useEffect(() => {
    if (initialSourceMode) setSourceMode(initialSourceMode)
  }, [initialSourceMode])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(
    initialEmployee?.id || employees[0]?.id || '',
  )
  const [assigning, setAssigning] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // New Work Fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [projectId, setProjectId] = useState(projects[0]?.id || '')
  const [moduleId, setModuleId] = useState('')
  const [milestoneId, setMilestoneId] = useState('')
  const [sprintId, setSprintId] = useState('')
  const [workTypeId, setWorkTypeId] = useState(workTypes[0]?.id || '')
  const [priority, setPriority] = useState<WorkItem['priority']>('MEDIUM')
  const [deadlineDate, setDeadlineDate] = useState(
    new Date().toISOString().slice(0, 10),
  )
  const [deadlineTime, setDeadlineTime] = useState('17:00')
  const [estimatedHours, setEstimatedHours] = useState<number | string>(4)

  // Recurring Fields
  const [recurringMode, setRecurringMode] = useState<'ALL' | 'SELECTED'>('ALL')
  const [selectedRecurringEmployeeIds, setSelectedRecurringEmployeeIds] = useState<string[]>(
    initialEmployee ? [initialEmployee.id] : [],
  )
  const [recurringStartDate, setRecurringStartDate] = useState(
    new Date().toISOString().slice(0, 10),
  )
  const [recurringEndDate, setRecurringEndDate] = useState('')

  // Target Fields
  const [targetValue, setTargetValue] = useState<number | string>(1)
  const [targetUnit, setTargetUnit] = useState('tasks')
  const [targetDeadlineTime, setTargetDeadlineTime] = useState('17:00')

  // Existing Work Mode state
  const [existingWorkSearch, setExistingWorkSearch] = useState('')
  const [selectedExistingWorkId, setSelectedExistingWorkId] = useState('')

  const [projectMilestones, setProjectMilestones] = useState<ProjectMilestone[]>([])
  const [projectSprints, setProjectSprints] = useState<Sprint[]>([])

  useEffect(() => {
    if (!accessToken || !projectId) {
      setProjectMilestones([])
      setProjectSprints([])
      return
    }
    getProjectMilestones(accessToken, projectId)
      .then((m) => setProjectMilestones(m || []))
      .catch(() => setProjectMilestones([]))

    getProjectSprints(accessToken, projectId)
      .then((s) => setProjectSprints(s || []))
      .catch(() => setProjectSprints([]))
  }, [accessToken, projectId])

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === selectedEmployeeId) || null,
    [employees, selectedEmployeeId],
  )

  const unassignedAndEmployeeWork = useMemo(() => {
    return workItems.filter((w) => {
      if (w.status === 'DONE') return false
      const matchesSearch =
        !existingWorkSearch.trim() ||
        w.title.toLowerCase().includes(existingWorkSearch.trim().toLowerCase())
      const isAssignable =
        !w.assigned_to || w.assigned_to === selectedEmployeeId
      return matchesSearch && isAssignable
    })
  }, [workItems, existingWorkSearch, selectedEmployeeId])

  function toggleRecurringEmployee(empId: string) {
    setSelectedRecurringEmployeeIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId],
    )
  }

  async function handleAssignSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!accessToken) return

    setAssigning(true)
    setErrorMessage('')

    try {
      if (assignmentCategory === 'RECURRING') {
        if (!title.trim()) {
          throw new Error('Please enter a work title.')
        }
        if (recurringMode === 'SELECTED' && selectedRecurringEmployeeIds.length === 0) {
          throw new Error('Please select at least one employee for recurring work.')
        }

        await createRecurringWork(accessToken, {
          title: title.trim(),
          description: description.trim() || null,
          project_id: projectId || null,
          work_type_id: workTypeId || null,
          module_id: moduleId || null,
          milestone_id: milestoneId || null,
          priority,
          assignment_mode: recurringMode,
          employee_ids: recurringMode === 'SELECTED' ? selectedRecurringEmployeeIds : undefined,
          frequency: 'DAILY',
          deadline_time: deadlineTime || '17:00',
          start_date: recurringStartDate || new Date().toISOString().slice(0, 10),
          end_date: recurringEndDate || null,
        })

        // Generate today's instances immediately
        const genResult = await generateRecurringWork(accessToken).catch(() => ({ generatedCount: 0 }))

        await onAssigned(
          `✓ Created Daily Recurring Work "${title.trim()}" (${genResult.generatedCount} instances generated for today)`,
        )
      } else if (sourceMode === 'NEW') {
        if (!selectedEmployeeId) {
          throw new Error('Please select an employee.')
        }
        if (!title.trim()) {
          throw new Error('Please enter a work title.')
        }

        await createDailyTargetWithWorkItem(accessToken, {
          work_title: title.trim(),
          title: title.trim(),
          work_description: description.trim() || undefined,
          description: description.trim() || undefined,
          project_id: projectId || undefined,
          module_id: moduleId || undefined,
          milestone_id: milestoneId || undefined,
          sprint_id: sprintId || undefined,
          work_type_id: workTypeId || undefined,
          priority,
          deadline_date: deadlineDate || undefined,
          deadline: deadlineDate || undefined,
          deadline_time: deadlineTime || undefined,
          estimated_hours: Number(estimatedHours) || undefined,
          employee_id: selectedEmployeeId,
          assigned_to: selectedEmployeeId,
          target_title: title.trim(),
          target_value: Number(targetValue) || 1,
          unit: targetUnit.trim() || 'tasks',
          target_deadline_time: targetDeadlineTime || '17:00',
        })

        await onAssigned(`✓ Created and assigned "${title.trim()}" to ${fullName(selectedEmployee!)}`)
      } else {
        if (!selectedEmployeeId) {
          throw new Error('Please select an employee.')
        }
        if (!selectedExistingWorkId) {
          throw new Error('Please select an existing work item.')
        }

        const work = workItems.find((w) => w.id === selectedExistingWorkId)
        if (!work) throw new Error('Selected work item not found.')

        if (work.assigned_to !== selectedEmployeeId) {
          await updateWorkItem(accessToken, selectedExistingWorkId, {
            assigned_to: selectedEmployeeId,
            status: work.status === 'TODO' ? 'TODO' : work.status,
          })
        }

        await createDailyTarget(accessToken, {
          employee_id: selectedEmployeeId,
          work_item_id: selectedExistingWorkId,
          title: work.title,
          target_value: Number(targetValue) || 1,
          unit: targetUnit.trim() || 'tasks',
          deadline_date: new Date().toISOString().slice(0, 10),
          deadline_time: targetDeadlineTime || '17:00',
          priority: (work.priority as any) || 'MEDIUM',
        })

        await onAssigned(`✓ Assigned "${work.title}" to ${fullName(selectedEmployee!)} with daily target`)
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to assign work.',
      )
    } finally {
      setAssigning(false)
    }
  }

  return (
    <form onSubmit={handleAssignSubmit} className="p-6 space-y-5 text-xs">
      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 font-bold text-red-700">
          {errorMessage}
        </div>
      )}

      {/* TOP WORKFLOW SELECTOR */}
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => {
            setAssignmentCategory('INDIVIDUAL')
            setSourceMode('NEW')
          }}
          className={`rounded-lg px-3 py-2 text-xs font-bold transition cursor-pointer ${
            assignmentCategory === 'INDIVIDUAL'
              ? 'bg-white text-[#801424] shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          One-Time Work
        </button>

        <button
          type="button"
          onClick={() => setAssignmentCategory('RECURRING')}
          className={`rounded-lg px-3 py-2 text-xs font-bold transition cursor-pointer ${
            assignmentCategory === 'RECURRING'
              ? 'bg-white text-[#801424] shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Daily Recurring
        </button>
      </div>

      {/* SECTION 1 — WHAT WORK? */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-[#801424]">
            1. Work
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Define what needs to be done.
          </p>
        </div>

        {/* Work Type */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            Work Type
          </label>
          <select
            value={workTypeId}
            onChange={(e) => {
              const wtId = e.target.value
              setWorkTypeId(wtId)
              const found = workTypes.find((w) => w.id === wtId)
              if (found) {
                if (found.unit) setTargetUnit(found.unit)
                if (found.default_target) setTargetValue(found.default_target)
              }
            }}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold outline-none focus:border-[#801424]"
          >
            <option value="">Select work type</option>
            {workTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </div>

        {/* Title */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            Work Title *
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Daily Video Editing"
            required
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold outline-none focus:border-[#801424]"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            Instructions
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="What should the person deliver?"
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs outline-none focus:border-[#801424]"
          />
        </div>
      </div>

      {/* SECTION 2 — WHERE? */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-[#801424]">
            2. Project
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Project
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold outline-none focus:border-[#801424]"
            >
              <option value="">No project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Milestone
            </label>
            <select
              value={milestoneId}
              onChange={(e) => setMilestoneId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold outline-none focus:border-[#801424]"
            >
              <option value="">No milestone</option>
              {projectMilestones.map((milestone) => (
                <option key={milestone.id} value={milestone.id}>
                  {milestone.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* SECTION 3 — HOW MUCH? */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-[#801424]">
            3. Target
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Define the expected output. Progress is calculated automatically from actual output.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Target
            </label>
            <input
              type="number"
              min="0"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-black outline-none focus:border-[#801424]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Unit
            </label>
            <input
              value={targetUnit}
              onChange={(e) => setTargetUnit(e.target.value)}
              placeholder="Videos"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold outline-none focus:border-[#801424]"
            />
          </div>
        </div>

        <div className="rounded-xl bg-white border border-slate-200 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">
              Target Preview
            </span>
            <span className="text-sm font-black text-slate-900">
              {targetValue || 0} {targetUnit || 'items'}
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 4 — WHO? */}
      {assignmentCategory === 'INDIVIDUAL' ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#801424] mb-3">
            4. Assign To
          </p>

          <select
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold outline-none focus:border-[#801424]"
          >
            <option value="">Select person</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {fullName(employee)}
              </option>
            ))}
          </select>

          {selectedEmployeeId && (
            <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 p-3">
              <p className="text-[10px] font-bold uppercase text-slate-400">
                Current workload
              </p>
              <p className="mt-1 text-sm font-black text-slate-900">
                {capacities[selectedEmployeeId]?.utilizationPercent || 0}% utilized
              </p>
              {capacities[selectedEmployeeId]?.isOverloaded && (
                <p className="mt-1 text-[11px] font-bold text-rose-600">
                  ⚠ This assignment may overload this person.
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#801424] mb-3">
            4. Assign To
          </p>

          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={() => setRecurringMode('ALL')}
              className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold cursor-pointer transition ${
                recurringMode === 'ALL'
                  ? 'bg-[#801424] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Managers & Employees
            </button>

            <button
              type="button"
              onClick={() => setRecurringMode('SELECTED')}
              className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold cursor-pointer transition ${
                recurringMode === 'SELECTED'
                  ? 'bg-[#801424] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Select People
            </button>
          </div>

          {recurringMode === 'SELECTED' && (
            <div className="max-h-48 overflow-y-auto space-y-1 rounded-xl border border-slate-200 p-2">
              {employees.map((employee) => {
                const selected = selectedRecurringEmployeeIds.includes(employee.id)
                return (
                  <label
                    key={employee.id}
                    className={`flex items-center gap-3 rounded-xl p-2.5 cursor-pointer text-xs ${
                      selected ? 'bg-rose-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleRecurringEmployee(employee.id)}
                      className="accent-[#801424] h-4 w-4"
                    />
                    <span className="font-bold text-slate-800">
                      {fullName(employee)}
                    </span>
                  </label>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* SECTION 5 — WHEN? */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
        <p className="text-[10px] font-black uppercase tracking-wider text-[#801424]">
          5. Schedule
        </p>

        {assignmentCategory === 'RECURRING' ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Start Date
                </label>
                <input
                  type="date"
                  value={recurringStartDate}
                  onChange={(e) => setRecurringStartDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs outline-none focus:border-[#801424]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  End Date
                </label>
                <input
                  type="date"
                  value={recurringEndDate}
                  onChange={(e) => setRecurringEndDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs outline-none focus:border-[#801424]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Daily Deadline
              </label>
              <input
                type="time"
                value={deadlineTime}
                onChange={(e) => setDeadlineTime(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold outline-none focus:border-[#801424]"
              />
            </div>

            <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 text-xs text-blue-800 font-semibold">
              🔁 This work will automatically generate a fresh work item for each assigned person every day.
            </div>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Deadline Date
              </label>
              <input
                type="date"
                value={deadlineDate}
                onChange={(e) => setDeadlineDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs outline-none focus:border-[#801424]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Deadline Time
              </label>
              <input
                type="time"
                value={deadlineTime}
                onChange={(e) => setDeadlineTime(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs outline-none focus:border-[#801424]"
              />
            </div>
          </div>
        )}
      </div>

      {/* ACTION FOOTER */}
      <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
        >
          Cancel
        </button>

        <button
          type="submit"
          disabled={assigning}
          className="rounded-xl bg-[#801424] px-6 py-2.5 text-xs font-bold text-white hover:bg-[#9f1239] transition disabled:opacity-50 cursor-pointer shadow-xs"
        >
          {assigning
            ? 'Saving Work Plan...'
            : assignmentCategory === 'RECURRING'
            ? 'Create Daily Work Plan'
            : 'Create & Assign Work'}
        </button>
      </div>
    </form>
  )
}
