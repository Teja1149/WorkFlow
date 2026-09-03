import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Clock,
  ListTodo,
  PlayCircle,
  Target,
  Zap,
  Sparkles,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthContext'
import { getEmployeeDashboard } from '../../features/dashboard/employee-dashboard.service'
import {
  getEmployeeWorkload,
  type EmployeeWorkload,
} from '../../features/project-targets/project-target.service'

type FilterKey =
  | 'ALL'
  | 'OVERDUE'
  | 'DUE_SOON'
  | 'IN_PROGRESS'
  | 'TODO'
  | 'DONE'
  | 'BLOCKED'

function getDeadlineDate(item: any) {
  if (!item.deadline) return null

  const date = new Date(item.deadline)

  if (item.deadline_time) {
    const [hours, minutes] = String(item.deadline_time)
      .split(':')
      .map(Number)

    if (!Number.isNaN(hours)) date.setHours(hours)
    if (!Number.isNaN(minutes)) date.setMinutes(minutes)
  }

  return date
}

function getDeadlineState(item: any) {
  if (item.status === 'DONE') return 'DONE'

  const deadline = getDeadlineDate(item)

  if (!deadline) return 'NONE'

  const now = new Date()
  const diff = deadline.getTime() - now.getTime()
  const hours = diff / (1000 * 60 * 60)

  if (hours < 0) return 'OVERDUE'
  if (hours <= 48) return 'DUE_SOON'

  return 'NORMAL'
}

function WorkRow({
  item,
  onOpen,
}: {
  item: any
  onOpen: (item: any) => void
}) {
  const deadlineState = getDeadlineState(item)

  const statusLabel =
    item.status === 'IN_PROGRESS'
      ? 'IN PROGRESS'
      : item.status === 'BLOCKED'
      ? 'BLOCKED'
      : item.status === 'DONE'
      ? 'COMPLETED'
      : 'NOT STARTED'

  const statusClass =
    item.status === 'DONE'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : item.status === 'IN_PROGRESS'
      ? 'bg-blue-50 text-blue-700 border-blue-200'
      : item.status === 'BLOCKED'
      ? 'bg-rose-50 text-rose-700 border-rose-200'
      : 'bg-slate-100 text-slate-700 border-slate-200'

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="w-full text-left p-4 md:p-5 bg-white hover:bg-slate-50 border-b border-slate-100 transition-colors cursor-pointer"
    >
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {item.projects?.project_key && (
              <span className="font-mono text-[10px] font-bold px-2 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-100">
                {item.projects.project_key}
              </span>
            )}

            {item.priority && (
              <span
                className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase ${
                  item.priority === 'URGENT' || item.priority === 'CRITICAL'
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : item.priority === 'HIGH'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                {item.priority}
              </span>
            )}

            {deadlineState === 'OVERDUE' && (
              <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
                OVERDUE
              </span>
            )}

            {deadlineState === 'DUE_SOON' && (
              <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                DUE SOON
              </span>
            )}
          </div>

          <h3 className="font-bold text-slate-900 text-sm md:text-base truncate">
            {item.title}
          </h3>

          {item.description && (
            <p className="text-xs text-slate-500 mt-1 line-clamp-1">
              {item.description}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-4 mt-3">
            {item.deadline && (
              <div
                className={`flex items-center gap-1.5 text-[11px] font-semibold ${
                  deadlineState === 'OVERDUE'
                    ? 'text-rose-600'
                    : deadlineState === 'DUE_SOON'
                    ? 'text-amber-600'
                    : 'text-slate-400'
                }`}
              >
                <Calendar size={13} />
                <span>
                  {new Date(item.deadline).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
            )}

            {item.projects?.name && (
              <span className="text-[11px] text-slate-400 font-medium">
                {item.projects.name}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between lg:justify-end gap-3">
          <span
            className={`px-3 py-1.5 rounded-full border text-[10px] font-extrabold whitespace-nowrap ${statusClass}`}
          >
            {statusLabel}
          </span>

          <span className="text-slate-300 text-lg">›</span>
        </div>
      </div>
    </button>
  )
}

export default function EmployeeDashboard() {
  const { accessToken, profile } = useAuth()

  const [dashboard, setDashboard] = useState<any>(null)
  const [workload, setWorkload] = useState<EmployeeWorkload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<FilterKey>('ALL')

  useEffect(() => {
    async function load() {
      if (!accessToken) return

      setLoading(true)
      setError('')

      try {
        const [dashData, workloadData] = await Promise.all([
          getEmployeeDashboard(accessToken),
          getEmployeeWorkload(accessToken).catch(() => null),
        ])
        setDashboard(dashData)
        setWorkload(workloadData)
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load dashboard.',
        )
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [accessToken])

  const allItems = useMemo(() => {
    return Array.isArray(dashboard?.work)
      ? dashboard.work
      : []
  }, [dashboard])

  const counts = useMemo(() => {
    return {
      all: allItems.filter((item: any) => item.status !== 'DONE').length,

      overdue: allItems.filter(
        (item: any) =>
          getDeadlineState(item) === 'OVERDUE' && item.status !== 'DONE',
      ).length,

      dueSoon: allItems.filter(
        (item: any) =>
          getDeadlineState(item) === 'DUE_SOON' && item.status !== 'DONE',
      ).length,

      inProgress: allItems.filter(
        (item: any) => item.status === 'IN_PROGRESS',
      ).length,

      todo: allItems.filter(
        (item: any) =>
          (item.status === 'TODO' || item.status === 'BACKLOG') &&
          item.status !== 'DONE',
      ).length,

      done: allItems.filter(
        (item: any) => item.status === 'DONE',
      ).length,

      blocked: allItems.filter(
        (item: any) =>
          item.status === 'BLOCKED' && item.status !== 'DONE',
      ).length,
    }
  }, [allItems])

  const filteredItems = useMemo(() => {
    const items = [...allItems]

    switch (filter) {
      case 'OVERDUE':
        return items.filter(
          (item) =>
            getDeadlineState(item) === 'OVERDUE' && item.status !== 'DONE',
        )

      case 'DUE_SOON':
        return items.filter(
          (item) =>
            getDeadlineState(item) === 'DUE_SOON' && item.status !== 'DONE',
        )

      case 'IN_PROGRESS':
        return items.filter(
          (item) => item.status === 'IN_PROGRESS',
        )

      case 'TODO':
        return items.filter(
          (item) =>
            (item.status === 'TODO' || item.status === 'BACKLOG') &&
            item.status !== 'DONE',
        )

      case 'DONE':
        return items.filter(
          (item) => item.status === 'DONE',
        )

      case 'BLOCKED':
        return items.filter(
          (item) =>
            item.status === 'BLOCKED' && item.status !== 'DONE',
        )

      default:
        // All Active: Everything except Completed
        return items.filter((item) => item.status !== 'DONE')
    }
  }, [allItems, filter])

  const filterCards = [
    {
      key: 'ALL' as FilterKey,
      label: 'All Active',
      value: counts.all,
      icon: CheckSquare,
      className:
        'border-slate-200 bg-white text-slate-800',
    },
    {
      key: 'TODO' as FilterKey,
      label: 'Pending',
      value: counts.todo,
      icon: ListTodo,
      className:
        'border-slate-200 bg-slate-50 text-slate-700',
    },
    {
      key: 'IN_PROGRESS' as FilterKey,
      label: 'In Progress',
      value: counts.inProgress,
      icon: PlayCircle,
      className:
        'border-blue-200 bg-blue-50 text-blue-700',
    },
    {
      key: 'DUE_SOON' as FilterKey,
      label: 'Due Soon',
      value: counts.dueSoon,
      icon: Clock,
      className:
        'border-amber-200 bg-amber-50 text-amber-700',
    },
    {
      key: 'OVERDUE' as FilterKey,
      label: 'Overdue',
      value: counts.overdue,
      icon: AlertTriangle,
      className:
        'border-rose-200 bg-rose-50 text-rose-700',
    },
    {
      key: 'BLOCKED' as FilterKey,
      label: 'Blocked',
      value: counts.blocked,
      icon: Zap,
      className:
        'border-violet-200 bg-violet-50 text-violet-700',
    },
    {
      key: 'DONE' as FilterKey,
      label: 'Completed',
      value: counts.done,
      icon: CheckCircle2,
      className:
        'border-emerald-200 bg-emerald-50 text-emerald-700',
    },
  ]

  function openWork(item: any) {
    window.location.href = `/work-items/${item.id}`
  }

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400 text-xs font-semibold">
        Loading your work...
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 rounded-2xl bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-3">
        <AlertCircle size={20} />
        <span className="text-sm font-semibold">{error}</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Employee Workspace
        </p>

        <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
          Good afternoon, {profile?.first_name || 'there'}
        </h1>

        <p className="text-xs text-slate-500 mt-1">
          Here is everything that needs your attention.
        </p>
      </div>

      {/* MY PROJECT WORKLOAD & TODAY'S OUTPUT */}
      {workload && workload.projects.length > 0 && (
        <section className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#801424] font-mono flex items-center gap-1.5">
                <Target size={14} />
                MY PROJECT WORKLOAD
              </span>
            </div>
            <Link
              to="/my-workload"
              className="text-xs font-bold text-[#801424] hover:underline flex items-center gap-1"
            >
              <span>View Full Workload</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Active Project Allocations */}
            <div className="space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                PROJECT TARGET ALLOCATIONS
              </span>
              {workload.projects.slice(0, 2).map((proj) => (
                <div
                  key={proj.project_id}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-slate-900">{proj.project_name}</span>
                    <span className="font-bold text-slate-700 font-mono">
                      {proj.target} {proj.unit}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span><strong>{proj.target}</strong> allocated</span>
                    <span>•</span>
                    <span><strong className="text-emerald-700">{proj.done}</strong> done</span>
                    <span>•</span>
                    <span><strong className="text-rose-700">{proj.pending}</strong> pending</span>
                    <span>•</span>
                    <span><strong className="text-slate-900">{proj.achievement}%</strong></span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full bg-[#801424] rounded-full"
                      style={{ width: `${proj.achievement}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Today's Target Execution */}
            <div className="p-4 rounded-xl border border-rose-200/80 bg-rose-50/30 flex flex-col justify-between space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-rose-200/60 pb-2">
                <span className="font-bold uppercase tracking-wider text-[#801424] font-mono text-[11px] flex items-center gap-1.5">
                  <Zap size={14} />
                  TODAY
                </span>
                <span className="text-[11px] font-bold text-slate-600">
                  {workload.today.completed_count} / {workload.today.targets_count} Done
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Target</span>
                  <span className="text-lg font-black text-slate-900">{workload.today.planned_output}</span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-emerald-200">
                  <span className="text-[10px] uppercase font-bold text-emerald-600 block">Completed</span>
                  <span className="text-lg font-black text-emerald-700">{workload.today.completed}</span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-rose-200">
                  <span className="text-[10px] uppercase font-bold text-rose-600 block">Remaining</span>
                  <span className="text-lg font-black text-rose-700">{workload.today.remaining}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-600 font-medium">
                  {workload.today.remaining === 0 && workload.today.planned_output > 0
                    ? '🎉 All planned daily output completed!'
                    : `${workload.today.remaining} items remaining to deliver today`}
                </span>

                <Link
                  to="/my-day"
                  className="px-3 py-1.5 rounded-lg bg-[#801424] hover:bg-[#9f1239] text-white font-bold text-xs shadow-2xs transition inline-flex items-center gap-1"
                >
                  <Sparkles size={12} className="text-amber-300" />
                  <span>UPDATE WORK</span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ATTENTION SUMMARY */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 md:p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              What needs your attention?
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Click any category to see those tasks.
            </p>
          </div>

          {filter !== 'ALL' && (
            <button
              type="button"
              onClick={() => setFilter('ALL')}
              className="text-[11px] font-bold text-[#801424] hover:underline cursor-pointer"
            >
              Show all
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-3">
          {filterCards.map(
            ({
              key,
              label,
              value,
              icon: Icon,
              className,
            }) => {
              const active = filter === key

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={`rounded-xl border p-4 text-left transition-all cursor-pointer ${
                    active
                      ? 'ring-2 ring-[#801424]/20 border-[#801424]'
                      : 'hover:border-slate-300'
                  } ${className}`}
                >
                  <div className="flex items-center justify-between">
                    <Icon size={17} />
                    <span className="text-2xl font-bold">
                      {value}
                    </span>
                  </div>

                  <p className="text-[11px] font-bold mt-3">
                    {label}
                  </p>
                </button>
              )
            },
          )}
        </div>
      </section>

      {/* DAILY UPDATE */}
      <section className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 md:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white border border-blue-200 flex items-center justify-center text-blue-600">
              <Calendar size={18} />
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Today's work update
              </h3>

              <p className="text-[11px] text-slate-500 mt-0.5">
                Tell your manager what you worked on today.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              window.location.href = '/work'
            }}
            className="bg-[#801424] hover:bg-[#9f1239] text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            Add Update →
          </button>
        </div>
      </section>

      {/* WORK LIST */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              {filter === 'ALL'
                ? 'My Work'
                : filterCards.find((x) => x.key === filter)?.label}
            </h2>

            <p className="text-[11px] text-slate-500 mt-0.5">
              {filteredItems.length} task
              {filteredItems.length === 1 ? '' : 's'}
            </p>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
            <CheckSquare size={14} />
            {counts.all} assigned
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2
              size={42}
              className="mx-auto text-emerald-500"
            />

            <p className="mt-4 font-bold text-slate-900 text-sm">
              Nothing here!
            </p>

            <p className="text-xs text-slate-500 mt-1">
              There are no tasks in this category.
            </p>
          </div>
        ) : (
          <div>
            {filteredItems.map((item: any) => (
              <WorkRow
                key={item.id}
                item={item}
                onOpen={openWork}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}