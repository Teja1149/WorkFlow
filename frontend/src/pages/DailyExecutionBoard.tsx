import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Flame,
  RefreshCw,
  ExternalLink,
  Target,
  Layers,
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
import {
  classifyWorkItem,
  groupEmployeeWork,
  sortWorkByUrgency,
  type WorkCategory,
} from '../features/work-items/work-item-classification'
import WorkDetailsDrawer from '../features/work-items/WorkDetailsDrawer'

type BoardColumn =
  | 'CRITICAL'
  | 'OVERDUE'
  | 'AT_RISK'
  | 'BLOCKED'
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

    case 'BLOCKED':
      return 'Blocked'

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

    case 'BLOCKED':
      return 'border-orange-200 bg-orange-50'

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

  if (item.status === 'BLOCKED') {
    return 'BLOCKED'
  }

  if (
    item.health === 'CRITICAL' ||
    item.pacing?.status === 'BEHIND' ||
    item.pacing?.status === 'OVERDUE'
  ) {
    return 'CRITICAL'
  }

  if (item.health === 'RED') {
    return 'OVERDUE'
  }

  if (
    item.health === 'AMBER' ||
    item.health === 'ORANGE' ||
    item.pacing?.status === 'AT_RISK'
  ) {
    return 'AT_RISK'
  }

  if (
    Number(item.carry_forward_count || 0) > 0
  ) {
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
  const [selectedWork, setSelectedWork] = useState<WorkItem | null>(null)

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
  }, [accessToken, profile?.role])

  // Step 21.4 — Only show assigned work to employee when logged in as employee
  const employeeItems = useMemo(() => {
    if (profile?.role === 'EMPLOYEE' && profile?.id) {
      return items.filter(
        (item) => item.assigned_to === profile.id || (item as any).assignee?.id === profile.id,
      )
    }
    return items
  }, [items, profile])

  async function handleStatusChange(
    item: DailyWorkItem,
    newStatus: string,
    notes?: string,
  ) {
    if (!accessToken) return

    // Step 21.8 — Quantity task completion validation
    if (newStatus === 'DONE') {
      const targetQty = Number(item.target_quantity || 0)
      const completedQty = Number(item.completed_quantity || 0)

      if (targetQty > 0 && completedQty < targetQty) {
        const proceed = window.confirm(
          `Target quantity not completed (${completedQty} / ${targetQty} ${item.quantity_unit || 'items'}). Do you want to mark this task as complete anyway?`,
        )
        if (!proceed) {
          setSelectedWork(item as any)
          return
        }
      }
    }

    // Step 21.8 & 21.12 — Blocker reason validation
    if (newStatus === 'BLOCKED' && !notes?.trim()) {
      const reason = window.prompt(
        'Why is this work blocked? Please enter the blocker details:',
      )
      if (!reason?.trim()) {
        setError('A blocker reason is required to put work on hold.')
        return
      }
      notes = reason.trim()
    }

    try {
      setError('')
      await updateWorkItemStatus(
        accessToken,
        item.id,
        newStatus as WorkItem['status'],
        notes,
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

  // Step 21.13 — Live Work Summary calculation
  const attentionCounts = useMemo(() => {
    const active = employeeItems.filter((item) => item.status !== 'DONE')
    const overdue = active.filter(
      (item) => item.health === 'RED' || classifyWorkItem(item as any) === 'OVERDUE',
    ).length
    const critical = active.filter(
      (item) => item.health === 'CRITICAL' || classifyWorkItem(item as any) === 'CRITICAL',
    ).length
    const blocked = employeeItems.filter((item) => item.status === 'BLOCKED').length
    const inProgress = employeeItems.filter((item) => item.status === 'IN_PROGRESS' || item.status === 'DEVELOPMENT').length
    const pending = employeeItems.filter((item) => item.status === 'TODO').length
    const carriedForward = employeeItems.filter((item) => Number(item.carry_forward_count || 0) > 0).length

    return {
      total: employeeItems.length,
      active: active.length,
      critical,
      overdue,
      dueSoon: data?.atRisk?.length || 0,
      blocked,
      carriedForward,
      inProgress,
      pending,
    }
  }, [employeeItems, data])

  const columns = useMemo(() => {
    const result: Record<
      BoardColumn,
      DailyWorkItem[]
    > = {
      CRITICAL: [],
      OVERDUE: [],
      AT_RISK: [],
      BLOCKED: [],
      CARRIED_FORWARD: [],
      TODAY: [],
      IN_PROGRESS: [],
      DONE: [],
    }

    for (const item of employeeItems) {
      result[getColumn(item)].push(item)
    }

    for (const column of Object.keys(result) as BoardColumn[]) {
      result[column] = sortWorkByUrgency(result[column] as any) as any
    }

    return result
  }, [employeeItems])

  if (loading && items.length === 0) {
    return (
      <div className="p-8 text-center">
        <RefreshCw className="mx-auto h-6 w-6 animate-spin text-slate-400" />
        <p className="mt-3 text-sm text-slate-500">
          Loading work center...
        </p>
      </div>
    )
  }

  const isEmployee = profile?.role === 'EMPLOYEE'

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-[1600px] space-y-6">

        {/* HEADER */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                {isEmployee ? 'DAILY WORK CENTER' : 'TEAM EXECUTION BOARD'}
              </h1>
              {isEmployee && (
                <span className="rounded-full bg-rose-100 text-[#801424] px-3 py-0.5 text-xs font-black">
                  {attentionCounts.active} Active Tasks
                </span>
              )}
            </div>
            <p className="mt-1 text-xs md:text-sm text-slate-500 font-medium">
              {isEmployee
                ? "Your daily priority queue — Overdue, Critical, and Today's assignments."
                : 'Live team execution board organized by urgency and workflow state.'}
            </p>
          </div>

          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-700 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 21.13 — LIVE WORK SUMMARY METRICS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-red-600">
              Critical
            </p>
            <p className="mt-1 text-2xl font-black text-red-800">
              {attentionCounts.critical}
            </p>
          </div>

          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600">
              Overdue
            </p>
            <p className="mt-1 text-2xl font-black text-rose-800">
              {attentionCounts.overdue}
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
              Due Soon
            </p>
            <p className="mt-1 text-2xl font-black text-amber-800">
              {attentionCounts.dueSoon}
            </p>
          </div>

          <div className="rounded-2xl border border-orange-200 bg-orange-50 p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-orange-700">
              Blocked
            </p>
            <p className="mt-1 text-2xl font-black text-orange-800">
              {attentionCounts.blocked}
            </p>
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
              In Progress
            </p>
            <p className="mt-1 text-2xl font-black text-blue-800">
              {attentionCounts.inProgress}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Not Started
            </p>
            <p className="mt-1 text-2xl font-black text-slate-800">
              {attentionCounts.pending}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              Completed
            </p>
            <p className="mt-1 text-2xl font-black text-emerald-800">
              {columns.DONE.length}
            </p>
          </div>
        </div>

        {/* STEP 21.6 — BOARD COLUMNS */}
        <div className="grid grid-flow-col auto-cols-[minmax(270px,1fr)] gap-4 overflow-x-auto pb-4">
          {(
            [
              'CRITICAL',
              'OVERDUE',
              'AT_RISK',
              'BLOCKED',
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
              onOpenDetails={(item) => setSelectedWork(item as any)}
              userRole={profile?.role}
            />
          ))}
        </div>
      </div>

      {/* WORK DETAILS DRAWER */}
      {selectedWork && (
        <WorkDetailsDrawer
          work={selectedWork}
          onClose={() => setSelectedWork(null)}
          onChanged={async () => {
            await load()
          }}
        />
      )}
    </div>
  )
}

function BoardColumnView({
  column,
  items,
  settings,
  onStatusChange,
  onOpenDetails,
  userRole,
}: {
  column: BoardColumn
  items: DailyWorkItem[]
  settings: OrganizationWorkSettings | null
  onStatusChange: (
    item: DailyWorkItem,
    nextStatus: string,
    notes?: string,
  ) => void
  onOpenDetails: (item: DailyWorkItem) => void
  userRole?: string
}) {
  return (
    <section
      className={`min-h-125 rounded-2xl border flex flex-col ${columnClass(
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

          {column === 'BLOCKED' && (
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          )}

          {column === 'CARRIED_FORWARD' && (
            <RefreshCw className="h-4 w-4 text-violet-600" />
          )}

          {column === 'IN_PROGRESS' && (
            <Clock3 className="h-4 w-4 text-blue-600" />
          )}

          {column === 'TODAY' && (
            <Layers className="h-4 w-4 text-slate-600" />
          )}

          {column === 'DONE' && (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          )}

          <h2 className="font-bold text-slate-800 text-xs tracking-tight">
            {columnTitle(column)}
          </h2>
        </div>

        <span className="rounded-full bg-white/80 px-2.5 py-0.5 text-[11px] font-black text-slate-700 shadow-2xs">
          {items.length}
        </span>
      </div>

      <div className="space-y-3 p-3 flex-1 overflow-y-auto">
        {items.map((item) => (
          <BoardCard
            key={item.id}
            item={item}
            settings={settings}
            onStatusChange={onStatusChange}
            onOpenDetails={onOpenDetails}
            userRole={userRole}
          />
        ))}

        {items.length === 0 && (
          <div className="py-12 text-center text-xs text-slate-400 font-medium">
            No work in this queue
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
  onOpenDetails,
  userRole,
}: {
  item: DailyWorkItem
  settings: OrganizationWorkSettings | null
  onStatusChange: (
    item: DailyWorkItem,
    nextStatus: string,
    notes?: string,
  ) => void
  onOpenDetails: (item: DailyWorkItem) => void
  userRole?: string
}) {
  const hasQuantityTarget = Number(item.target_quantity || 0) > 0

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2.5 hover:border-slate-300 transition group">
      <div className="flex items-start justify-between gap-2">
        <button
          onClick={() => onOpenDetails(item)}
          className="text-left line-clamp-2 text-xs font-bold text-slate-900 hover:text-[#801424] cursor-pointer"
        >
          {item.title}
        </button>

        <span className="shrink-0 text-[11px] font-black text-slate-700">
          {item.progress_percent || 0}%
        </span>
      </div>

      {/* QUANTITY TARGET & PACING BADGE */}
      {hasQuantityTarget && (
        <div className="rounded-lg bg-rose-50/60 border border-rose-100 p-2.5 text-[11px] space-y-1.5 shadow-2xs">
          <div className="flex items-center justify-between font-bold text-slate-800">
            <span className="flex items-center gap-1">
              <Target size={12} className="text-[#801424]" />
              {item.completed_quantity || 0} / {item.target_quantity} {item.quantity_unit || 'items'}
            </span>
            {item.pacing?.status && (
              <span
                className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                  item.pacing.status === 'OVERDUE'
                    ? 'bg-red-600 text-white'
                    : item.pacing.status === 'BEHIND'
                    ? 'bg-rose-200 text-rose-900 border border-rose-300'
                    : item.pacing.status === 'AT_RISK'
                    ? 'bg-amber-200 text-amber-900 border border-amber-300'
                    : item.pacing.status === 'AHEAD'
                    ? 'bg-emerald-200 text-emerald-900 border border-emerald-300'
                    : 'bg-teal-100 text-teal-800 border border-teal-200'
                }`}
              >
                {item.pacing.status}
              </span>
            )}
          </div>

          {/* Expected vs Actual & Backlog */}
          {item.pacing?.enabled && (
            <div className="flex items-center justify-between text-[10px] text-slate-600 pt-1 border-t border-rose-200/50">
              <span>
                Expected: <strong className="text-slate-800">{item.pacing.expectedQuantity}</strong> {item.quantity_unit || 'items'}
              </span>
              {item.pacing.backlog && item.pacing.backlog > 0 ? (
                <span className="font-extrabold text-rose-600">
                  ⚠ Backlog: {item.pacing.backlog}
                </span>
              ) : (
                <span className="text-emerald-700 font-bold">
                  On Pace
                </span>
              )}
            </div>
          )}

          {/* Increased pace notice */}
          {item.pacing?.enabled && item.pacing.workloadIncreased && (
            <div className="text-[9px] font-bold text-amber-800 bg-amber-50 rounded px-1.5 py-0.5 border border-amber-200/70">
              ⚡ Required: {Math.ceil(item.pacing.requiredPerDay)} {item.quantity_unit || 'items'}/day (Pace Increased)
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {item.projects?.project_key && (
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
            {item.projects.project_key}
          </span>
        )}

        {item.project_modules?.name && (
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
            {item.project_modules.name}
          </span>
        )}

        {item.work_types?.name && (
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
            {item.work_types.name}
          </span>
        )}
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-[#801424]"
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

      {item.assignee && userRole !== 'EMPLOYEE' && (
        <p className="text-[11px] text-slate-500 font-medium">
          👤 {item.assignee.first_name} {item.assignee.last_name || ''}
        </p>
      )}

      {/* STEP 21.7 & 21.8 — CONTEXTUAL CONTROLLED ACTIONS */}
      <div className="pt-2 flex flex-wrap items-center justify-between gap-1.5 border-t border-slate-100 text-xs">
        <div className="flex items-center gap-1.5">
          {item.status === 'TODO' && (
            <button
              onClick={() => onStatusChange(item, 'IN_PROGRESS')}
              className="px-2.5 py-1 rounded-lg bg-[#801424] text-white font-bold text-[11px] hover:bg-[#9f1239] transition cursor-pointer shadow-2xs"
            >
              Start Work
            </button>
          )}

          {item.status === 'IN_PROGRESS' && (
            <>
              <button
                onClick={() => onStatusChange(item, 'DONE')}
                className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px] hover:bg-emerald-700 transition cursor-pointer shadow-2xs"
              >
                Complete
              </button>

              <button
                onClick={() => onStatusChange(item, 'BLOCKED')}
                className="px-2 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-300 font-bold text-[11px] hover:bg-amber-100 transition cursor-pointer"
              >
                Put On Hold
              </button>
            </>
          )}

          {item.status === 'BLOCKED' && (
            <button
              onClick={() => onStatusChange(item, 'IN_PROGRESS')}
              className="px-2.5 py-1 rounded-lg bg-[#801424] text-white font-bold text-[11px] hover:bg-[#9f1239] transition cursor-pointer shadow-2xs"
            >
              Resume Work
            </button>
          )}
        </div>

        <button
          onClick={() => onOpenDetails(item)}
          className="text-[11px] font-bold text-slate-500 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
        >
          Details
          <ExternalLink size={10} />
        </button>
      </div>
    </div>
  )
}
