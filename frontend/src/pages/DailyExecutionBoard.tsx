import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Flame,
  RefreshCw,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthContext'
import { getMyDay as getEmployeeToday } from '../features/work-execution/my-day.service'
import { getTeamToday } from '../features/work-execution/team-today.service'
import { updateWorkItemStatus, type WorkItem } from '../features/work-items/work-item.service'
import type { DailyWorkItem } from '../features/work-execution/work-execution.types'
import DeadlineCountdown from '../features/work-execution/DeadlineCountdown'
import {
  getOrganizationWorkSettings,
  type OrganizationWorkSettings,
} from '../features/organization-settings/organization-setting.service'

type BoardColumn =
  | 'CRITICAL'
  | 'OVERDUE'
  | 'AT_RISK'
  | 'CARRIED_FORWARD'
  | 'IN_PROGRESS'
  | 'TODAY'
  | 'DONE'

function columnTitle(column: BoardColumn) {
  switch (column) {
    case 'CRITICAL':
      return 'Critical'

    case 'OVERDUE':
      return 'Overdue'

    case 'AT_RISK':
      return 'Due Soon'

    case 'CARRIED_FORWARD':
      return 'Carried Forward'

    case 'IN_PROGRESS':
      return 'In Progress'

    case 'TODAY':
      return 'Not Started'

    default:
      return 'Completed'
  }
}

function columnClass(column: BoardColumn) {
  switch (column) {
    case 'CRITICAL':
      return 'border-red-300 bg-red-50'

    case 'OVERDUE':
      return 'border-rose-200 bg-rose-50/60'

    case 'AT_RISK':
      return 'border-amber-200 bg-amber-50'

    case 'CARRIED_FORWARD':
      return 'border-violet-200 bg-violet-50'

    case 'TODAY':
      return 'border-slate-200 bg-white'

    case 'IN_PROGRESS':
      return 'border-blue-200 bg-blue-50/40'

    default:
      return 'border-emerald-200 bg-emerald-50/50'
  }
}

function getColumn(item: DailyWorkItem): BoardColumn {
  if (item.status === 'DONE') {
    return 'DONE'
  }

  if (item.health === 'CRITICAL') {
    return 'CRITICAL'
  }

  if (item.health === 'RED') {
    return 'OVERDUE'
  }

  if (
    item.health === 'AMBER' ||
    item.health === 'ORANGE'
  ) {
    return 'AT_RISK'
  }

  if (Number(item.carry_forward_count || 0) > 0) {
    return 'CARRIED_FORWARD'
  }

  if (
    item.status === 'IN_PROGRESS' ||
    item.status === 'DEVELOPMENT'
  ) {
    return 'IN_PROGRESS'
  }

  return 'TODAY'
}

export default function DailyExecutionBoard() {
  const { accessToken, profile } = useAuth()

  const [items, setItems] = useState<DailyWorkItem[]>([])
  const [data, setData] = useState<any>(null)
  const [settings, setSettings] = useState<OrganizationWorkSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    if (!accessToken) return

    setLoading(true)
    setError('')

    try {
      const [result, workSettings] = await Promise.all([
        profile?.role === 'EMPLOYEE'
          ? getEmployeeToday(accessToken)
          : getTeamToday(accessToken),
        getOrganizationWorkSettings(accessToken).catch(() => null),
      ])

      setSettings(workSettings)
      setData(result)

      const carried = (result as any).carriedForward || (result as any).carryForward || []
      const all = [
        ...(result.critical || []),
        ...(result.overdue || []),
        ...(result.atRisk || []),
        ...carried,
        ...(result.inProgress || []),
        ...(result.newWork || []),
        ...((result as any).work || []),
      ]

      const unique = Array.from(
        new Map(
          all.map((item) => [item.id, item]),
        ).values(),
      )

      setItems(unique)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load execution board.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()

    const interval = window.setInterval(
      load,
      60_000,
    )

    return () => {
      window.clearInterval(interval)
    }
  }, [accessToken])

  async function handleStatusChange(item: DailyWorkItem, newStatus: string) {
    if (!accessToken) return
    try {
      setError('')
      await updateWorkItemStatus(
        accessToken,
        item.id,
        newStatus as WorkItem['status'],
      )
      await load()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to update work status.',
      )
    }
  }

  const attentionCounts = {
    critical: data?.critical?.length || 0,
    overdue: data?.overdue?.length || 0,
    dueSoon: data?.atRisk?.length || 0,
    carriedForward:
      data?.carriedForward?.length ||
      data?.carryForward?.length ||
      0,
    inProgress: data?.inProgress?.length || 0,
    pending: data?.newWork?.length || 0,
  }

  const columns = useMemo(() => {
    const result: Record<
      BoardColumn,
      DailyWorkItem[]
    > = {
      CRITICAL: [],
      OVERDUE: [],
      AT_RISK: [],
      CARRIED_FORWARD: [],
      TODAY: [],
      IN_PROGRESS: [],
      DONE: [],
    }

    for (const item of items) {
      result[getColumn(item)].push(item)
    }

    return result
  }, [items])

  if (loading) {
    return (
      <div className="p-8 text-center">
        <RefreshCw className="mx-auto h-6 w-6 animate-spin text-slate-400" />
        <p className="mt-3 text-sm text-slate-500">
          Loading execution board...
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-[1600px] space-y-6">

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-slate-500">
              Agile execution
            </p>

            <h1 className="mt-1 text-3xl font-bold text-slate-900">
              Daily Execution Board
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Work organized by urgency and execution state.
            </p>
          </div>

          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-xs"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ATTENTION COUNTS */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-[10px] font-bold uppercase text-red-600">
              Critical
            </p>
            <p className="mt-1 text-2xl font-bold text-red-800">
              {attentionCounts.critical}
            </p>
          </div>

          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-[10px] font-bold uppercase text-rose-600">
              Overdue
            </p>
            <p className="mt-1 text-2xl font-bold text-rose-800">
              {attentionCounts.overdue}
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-[10px] font-bold uppercase text-amber-700">
              Due Soon
            </p>
            <p className="mt-1 text-2xl font-bold text-amber-800">
              {attentionCounts.dueSoon}
            </p>
          </div>

          <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
            <p className="text-[10px] font-bold uppercase text-violet-700">
              Carried Forward
            </p>
            <p className="mt-1 text-2xl font-bold text-violet-800">
              {attentionCounts.carriedForward}
            </p>
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-[10px] font-bold uppercase text-blue-700">
              In Progress
            </p>
            <p className="mt-1 text-2xl font-bold text-blue-800">
              {attentionCounts.inProgress}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[10px] font-bold uppercase text-slate-500">
              Not Started
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-800">
              {attentionCounts.pending}
            </p>
          </div>
        </div>

        <div className="grid gap-4 overflow-x-auto xl:grid-cols-7">
          {(
            [
              'CRITICAL',
              'OVERDUE',
              'AT_RISK',
              'CARRIED_FORWARD',
              'IN_PROGRESS',
              'TODAY',
              'DONE',
            ] as BoardColumn[]
          ).map((column) => (
            <BoardColumnView
              key={column}
              column={column}
              items={columns[column]}
              settings={settings}
              onStatusChange={handleStatusChange}
              userRole={profile?.role}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function BoardColumnView({
  column,
  items,
  settings,
  onStatusChange,
  userRole,
}: {
  column: BoardColumn
  items: DailyWorkItem[]
  settings: OrganizationWorkSettings | null
  onStatusChange: (item: DailyWorkItem, nextStatus: string) => void
  userRole?: string
}) {
  return (
    <section
      className={`min-h-125 rounded-2xl border ${columnClass(
        column,
      )}`}
    >
      <div className="flex items-center justify-between border-b border-black/5 p-4">
        <div className="flex items-center gap-2">
          {column === 'CRITICAL' && (
            <Flame className="h-4 w-4 text-red-600" />
          )}

          {column === 'OVERDUE' && (
            <AlertTriangle className="h-4 w-4 text-rose-600" />
          )}

          {column === 'AT_RISK' && (
            <Clock3 className="h-4 w-4 text-amber-600" />
          )}

          {column === 'CARRIED_FORWARD' && (
            <RefreshCw className="h-4 w-4 text-violet-600" />
          )}

          {column === 'DONE' && (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          )}

          <h2 className="font-semibold text-slate-800 text-sm">
            {columnTitle(column)}
          </h2>
        </div>

        <span className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-bold text-slate-600">
          {items.length}
        </span>
      </div>

      <div className="space-y-3 p-3">
        {items.map((item) => (
          <BoardCard
            key={item.id}
            item={item}
            settings={settings}
            onStatusChange={onStatusChange}
            userRole={userRole}
          />
        ))}

        {items.length === 0 && (
          <div className="py-12 text-center text-xs text-slate-400">
            No work here
          </div>
        )}
      </div>
    </section>
  )
}

function BoardCard({
  item,
  settings,
  onStatusChange,
  userRole,
}: {
  item: DailyWorkItem
  settings: OrganizationWorkSettings | null
  onStatusChange: (item: DailyWorkItem, nextStatus: string) => void
  userRole?: string
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-2">
      <div className="flex items-start justify-between gap-3">
        <Link
          to={`/work-items/${item.id}`}
          className="line-clamp-2 text-sm font-semibold text-slate-900 hover:text-blue-600"
        >
          {item.title}
        </Link>

        <span className="shrink-0 text-xs font-bold text-slate-700">
          {item.progress_percent || 0}%
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {item.projects?.project_key && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
            {item.projects.project_key}
          </span>
        )}

        {item.project_modules?.name && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
            {item.project_modules.name}
          </span>
        )}

        {item.work_types?.name && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
            {item.work_types.name}
          </span>
        )}
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-slate-700"
          style={{
            width: `${Math.min(
              100,
              Math.max(
                0,
                item.progress_percent || 0,
              ),
            )}%`,
          }}
        />
      </div>

      <div>
        <DeadlineCountdown
          deadline={item.deadline}
          deadlineTime={item.deadline_time}
          timezone={settings?.timezone || 'Asia/Kolkata'}
          workdayEnd={settings?.workday_end || '18:00'}
          health={item.health}
        />
      </div>

      {item.assignee && (
        <p className="text-xs text-slate-500">
          {item.assignee.first_name}{' '}
          {item.assignee.last_name}
        </p>
      )}

      {/* CONTEXTUAL STATUS ACTIONS (Step 235, 236 & 237) */}
      <div className="pt-2 flex flex-wrap items-center gap-1.5 border-t border-slate-100 text-xs">
        {item.status === 'TODO' && (
          <button
            onClick={() => onStatusChange(item, 'IN_PROGRESS')}
            className="px-2.5 py-1 rounded-md bg-[#801424] text-white font-bold text-[11px] hover:bg-[#9f1239] transition cursor-pointer"
          >
            Start Work
          </button>
        )}

        {item.status === 'IN_PROGRESS' && (
          <>
            <button
              onClick={() => onStatusChange(item, 'DONE')}
              className="px-2.5 py-1 rounded-md bg-emerald-600 text-white font-bold text-[11px] hover:bg-emerald-700 transition cursor-pointer"
            >
              Complete Work
            </button>

            <button
              onClick={() => onStatusChange(item, 'BLOCKED')}
              className="px-2 py-1 rounded-md bg-amber-50 text-amber-900 border border-amber-300 font-bold text-[11px] hover:bg-amber-100 transition cursor-pointer"
            >
              Put On Hold
            </button>
          </>
        )}

        {item.status === 'BLOCKED' && (
          <button
            onClick={() => onStatusChange(item, 'IN_PROGRESS')}
            className="px-2.5 py-1 rounded-md bg-[#801424] text-white font-bold text-[11px] hover:bg-[#9f1239] transition cursor-pointer"
          >
            Resume Work
          </button>
        )}
      </div>
    </div>
  )
}
