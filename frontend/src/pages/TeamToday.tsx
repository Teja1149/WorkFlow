import { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  Clock3,
  Edit2,
  Filter,
  RefreshCw,
  Search,
  Target,
  Trash2,
  Users,
  X,
  ArrowRight,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '../features/auth/AuthContext'
import {
  getTeamDailyTargets,
  updateDailyTarget,
  cancelDailyTarget,
} from '../features/daily-targets/daily-target.service'
import {
  subscribeToWorkItems,
  subscribeToWorkUpdates,
} from '../features/work-items/work-item.realtime'
import {
  subscribeToDailyTargets,
} from '../features/daily-targets/daily-target.realtime'
import {
  getOrganizationWorkSettings,
  type OrganizationWorkSettings,
} from '../features/organization-settings/organization-setting.service'
import MetricCard from '../components/ui/MetricCard'
import HealthBadge from '../components/ui/HealthBadge'
import DeadlineCountdown from '../features/work-execution/DeadlineCountdown'
import DailyTargetDrawer from '../features/daily-targets/DailyTargetDrawer'

function MiniStat({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="rounded-lg bg-slate-50 p-2 text-center">
      <p className="text-lg font-bold text-slate-800">
        {value}
      </p>

      <p className="text-[11px] text-slate-500">
        {label}
      </p>
    </div>
  )
}

function EmployeeExecutionCard({
  employee,
  onOpen,
}: {
  employee: any
  onOpen: () => void
}) {
  const name =
    `${employee.employee?.first_name || ''} ${employee.employee?.last_name || ''}`.trim() ||
    'Employee'

  const hasCarryForward =
    employee.targets?.some(
      (target: any) => target.carried_forward_from !== null,
    ) || Number(employee.carriedCount || 0) > 0

  const state =
    employee.pending > 0
      ? employee.achievement < 50
        ? 'RED'
        : 'AMBER'
      : 'GREEN'

  const stateClasses = {
    GREEN:
      'bg-emerald-50 text-emerald-700 border-emerald-200',
    AMBER:
      'bg-amber-50 text-amber-700 border-amber-200',
    RED:
      'bg-red-50 text-red-700 border-red-200',
  }[state]

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-slate-300 hover:shadow-md cursor-pointer flex flex-col justify-between"
    >
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-900 text-base">
                {name}
              </h3>
              {hasCarryForward && (
                <span className="rounded-full bg-orange-50 border border-orange-200 px-2 py-0.5 text-[10px] font-bold text-orange-700">
                  Carry Forward
                </span>
              )}
            </div>

            <p className="mt-1 text-xs text-slate-500">
              {employee.targetCount || 0} targets
              {hasCarryForward && employee.carriedCount
                ? ` (${employee.targetCount - employee.carriedCount} new · ${employee.carriedCount} carried)`
                : ' today'}
            </p>
          </div>

          <span
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${stateClasses}`}
          >
            {state}
          </span>
        </div>

        <div className="mt-5">
          <div className="flex items-end justify-between">
            <span className="text-sm text-slate-500">
              Achievement
            </span>

            <span className="text-2xl font-bold text-slate-900">
              {employee.achievement}%
            </span>
          </div>

          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-[#801424] transition-all"
              style={{
                width: `${Math.min(
                  100,
                  Math.max(
                    0,
                    employee.achievement,
                  ),
                )}%`,
              }}
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <MiniStat
            label="Done"
            value={employee.completed}
          />

          <MiniStat
            label="Partial"
            value={employee.partial}
          />

          <MiniStat
            label="Pending"
            value={employee.pending}
          />
        </div>
      </div>

      <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-600">
        <span className="hover:text-blue-600">Open today execution →</span>

        {employee.employee?.id && (
          <Link
            to={`/employees/${employee.employee.id}/target-history`}
            onClick={(e) => e.stopPropagation()}
            className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700 hover:bg-[#801424] hover:text-white transition"
          >
            View Performance
          </Link>
        )}
      </div>
    </button>
  )
}

function AttentionTargetCard({
  target,
  settings,
  onView,
  onReassign,
  onExtend,
}: {
  target: any
  settings: OrganizationWorkSettings | null
  onView: () => void
  onReassign: () => void
  onExtend: () => void
}) {
  const targetValue =
    Number(target.target_value || 0)

  const actual =
    Number(target.actual_value || 0)

  const remaining =
    Math.max(
      0,
      targetValue - actual,
    )

  const achievement =
    targetValue === 0
      ? 0
      : Math.min(
          100,
          Math.round(
            (actual / targetValue) * 100,
          ),
        )

  const employee =
    `${target.employee?.first_name || ''} ${target.employee?.last_name || ''}`.trim()

  const health = target.health || 'GREEN'

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 text-base">
            {target.title}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {employee || 'Unassigned'}
            {' · '}
            {target.projects?.name || 'General'}
            {target.project_modules?.name &&
              ` · ${target.project_modules.name}`}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <HealthBadge health={health} />

          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              target.status === 'MISSED'
                ? 'bg-rose-100 text-rose-800'
                : target.status === 'PARTIAL'
                ? 'bg-amber-100 text-amber-800'
                : target.status === 'CARRIED_FORWARD'
                ? 'bg-orange-100 text-orange-800'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {target.status}
          </span>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">
            {actual} / {targetValue} {target.unit}
          </span>

          <span className="font-bold text-slate-800">
            {achievement}%
          </span>
        </div>

        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-[#801424] transition-all"
            style={{
              width: `${achievement}%`,
            }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-slate-500">
          <span className="font-medium">
            {remaining > 0
              ? `${remaining} ${target.unit} remaining`
              : 'Completed'}
          </span>

          <DeadlineCountdown
            deadline={target.deadline_date}
            deadlineTime={target.deadline_time || null}
            timezone={settings?.timezone || 'Asia/Kolkata'}
            workdayEnd={settings?.workday_end || '18:00'}
            health={health}
          />
        </div>

        {target.result_reason && (
          <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-700">
            {target.result_reason.replaceAll('_', ' ')}
          </span>
        )}
      </div>

      {/* Step 111 — Manager actions */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={onView}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-bold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
          >
            View
          </button>

          <button
            onClick={onReassign}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-bold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
          >
            Reassign
          </button>
        </div>

        <button
          onClick={onExtend}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-bold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
        >
          Extend / Edit
        </button>
      </div>
    </div>
  )
}

export default function TeamToday() {
  const { accessToken, profile } = useAuth()
  const navigate = useNavigate()

  const today = new Date().toISOString().slice(0, 10)
  const [selectedDate, setSelectedDate] = useState(today)

  const [teamData, setTeamData] = useState<any>(null)
  const [filter, setFilter] = useState<
    'ALL' | 'NEW' | 'CARRIED_FORWARD' | 'PARTIAL' | 'OVERDUE' | 'CRITICAL'
  >('ALL')
  const [settings, setSettings] = useState<OrganizationWorkSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Edit / Extend Modal state
  const [editingTarget, setEditingTarget] = useState<any | null>(null)
  const [inspectTarget, setInspectTarget] = useState<any | null>(null)
  const [editTitleInput, setEditTitleInput] = useState('')
  const [editValueInput, setEditValueInput] = useState<number | string>(1)
  const [editDeadlineTimeInput, setEditDeadlineTimeInput] = useState('')
  const [editPriorityInput, setEditPriorityInput] = useState('MEDIUM')
  const [savingEdit, setSavingEdit] = useState(false)

  // Step 108 — Date Navigation
  function changeDate(offset: number) {
    const date = new Date(`${selectedDate}T00:00:00`)
    date.setDate(date.getDate() + offset)
    setSelectedDate(date.toISOString().slice(0, 10))
  }

  function setDateOffsetFromToday(daysOffset: number) {
    const date = new Date()
    date.setDate(date.getDate() + daysOffset)
    setSelectedDate(date.toISOString().slice(0, 10))
  }

  async function loadData(showLoading = false) {
    if (!accessToken) return
    if (showLoading) setLoading(true)
    setError('')
    try {
      const [result, workSettings] = await Promise.all([
        getTeamDailyTargets(accessToken, selectedDate),
        getOrganizationWorkSettings(accessToken).catch(() => null),
      ])
      setTeamData(result)
      setSettings(workSettings)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load team targets.',
      )
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  // Step 109 — Load date-specific targets
  useEffect(() => {
    loadData(true)
  }, [accessToken, selectedDate])

  // Step 444 — Realtime Subscriptions for live updates
  useEffect(() => {
    if (!profile?.organization_id) return

    const unsubscribeWork = subscribeToWorkItems(
      profile.organization_id,
      () => {
        void loadData(false)
      },
    )

    const unsubscribeUpdates = subscribeToWorkUpdates(
      profile.organization_id,
      () => {
        void loadData(false)
      },
    )

    const unsubscribeTargets = subscribeToDailyTargets(
      profile.organization_id,
      () => {
        void loadData(false)
      },
    )

    return () => {
      unsubscribeWork()
      unsubscribeUpdates()
      unsubscribeTargets()
    }
  }, [profile?.organization_id, selectedDate])

  // Step 218 — Dedicated Filtering
  const filteredTargets = useMemo(() => {
    const list = teamData?.targets || []
    if (filter === 'ALL') return list

    return list.filter((target: any) => {
      if (filter === 'CARRIED_FORWARD') {
        return Boolean(target.carried_forward_from)
      }
      if (filter === 'NEW') {
        return !target.carried_forward_from
      }
      if (filter === 'PARTIAL') {
        return target.status === 'PARTIAL'
      }
      if (filter === 'OVERDUE') {
        return target.status === 'MISSED' || target.health === 'RED' || target.health === 'CRITICAL'
      }
      if (filter === 'CRITICAL') {
        return target.health === 'CRITICAL'
      }
      return true
    })
  }, [teamData, filter])

  const filteredEmployees = useMemo(() => {
    if (!teamData?.employees) return []
    if (filter === 'ALL') return teamData.employees

    return teamData.employees.filter((emp: any) => {
      if (filter === 'CARRIED_FORWARD') {
        return (
          emp.targets?.some((t: any) => t.carried_forward_from !== null) ||
          Number(emp.carriedCount || 0) > 0
        )
      }
      if (filter === 'NEW') {
        return emp.targets?.some((t: any) => t.carried_forward_from === null) || !emp.carriedCount
      }
      if (filter === 'PARTIAL') {
        return emp.partial > 0
      }
      if (filter === 'OVERDUE') {
        return emp.missed > 0 || emp.targets?.some((t: any) => t.health === 'RED' || t.health === 'CRITICAL')
      }
      if (filter === 'CRITICAL') {
        return emp.targets?.some((t: any) => t.health === 'CRITICAL')
      }
      return true
    })
  }, [teamData, filter])

  // Step 110 — Needs Attention calculation (top 10)
  const attentionTargets = useMemo(() => {
    const list = teamData?.targets || []

    return list
      .filter(
        (target: any) =>
          target.status !== 'COMPLETED' &&
          target.status !== 'CANCELLED',
      )
      .sort((a: any, b: any) => {
        const rank = (target: any) => {
          if (target.status === 'MISSED') return 5
          if (target.carried_forward_from) return 4
          if (target.status === 'PARTIAL') return 3
          if (target.status === 'IN_PROGRESS') return 2
          return 1
        }
        return rank(b) - rank(a)
      })
      .slice(0, 10)
  }, [teamData])

  function handleOpenEditModal(target: any) {
    setEditingTarget(target)
    setEditTitleInput(target.title || '')
    setEditValueInput(target.target_value || 1)
    setEditDeadlineTimeInput(target.deadline_time || '')
    setEditPriorityInput(target.priority || 'MEDIUM')
  }

  async function handleEditTargetSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!accessToken || !editingTarget) return

    setSavingEdit(true)
    try {
      await updateDailyTarget(accessToken, editingTarget.id, {
        title: editTitleInput.trim(),
        target_value: Number(editValueInput) || 0,
        deadline_time: editDeadlineTimeInput || null,
        priority: editPriorityInput,
      })

      setEditingTarget(null)
      const result = await getTeamDailyTargets(accessToken, selectedDate)
      setTeamData(result)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update target.')
    } finally {
      setSavingEdit(false)
    }
  }

  const summary = teamData?.summary || {
    total: 0,
    completed: 0,
    partial: 0,
    pending: 0,
    missed: 0,
    carriedForward: 0,
    achievement: 0,
  }

  const isToday = selectedDate === today

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-8">

        {/* HEADER & DATE CONTROLS */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              TEAM TODAY
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Operational overview of today's target execution across all team members.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Quick chips: Yesterday, Today, Tomorrow */}
            <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-semibold text-slate-600">
              <button
                type="button"
                onClick={() => setDateOffsetFromToday(-1)}
                className="rounded-lg px-3 py-1.5 hover:text-slate-900 cursor-pointer"
              >
                Yesterday
              </button>
              <button
                type="button"
                onClick={() => setDateOffsetFromToday(0)}
                className={`rounded-lg px-3 py-1.5 cursor-pointer ${
                  isToday ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setDateOffsetFromToday(1)}
                className="rounded-lg px-3 py-1.5 hover:text-slate-900 cursor-pointer"
              >
                Tomorrow
              </button>
            </div>

            {/* Step 108 — Date picker & stepper */}
            <div className="flex items-center gap-1.5 bg-white rounded-xl border border-slate-200 p-1 shadow-xs">
              <button
                type="button"
                onClick={() => changeDate(-1)}
                className="rounded-lg px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                ←
              </button>

              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-2 py-1 text-xs font-semibold text-slate-700 outline-none cursor-pointer bg-transparent"
              />

              <button
                type="button"
                onClick={() => changeDate(1)}
                className="rounded-lg px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                →
              </button>
            </div>

            <Link
              to="/set-daily-target"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#801424] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#9f1239] transition shadow-xs"
            >
              <Target className="h-4 w-4" />
              + Set Daily Target
            </Link>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* SUMMARY METRICS (Step 105) */}
        <section className="space-y-3">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
              SUMMARY
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
            <MetricCard
              label="Targets"
              value={summary.total}
            />

            <MetricCard
              label="Completed"
              value={summary.completed}
            />

            <MetricCard
              label="Partial"
              value={summary.partial}
            />

            <MetricCard
              label="Pending"
              value={summary.pending}
            />

            <MetricCard
              label="Overdue / Missed"
              value={summary.missed || 0}
            />

            <MetricCard
              label="Carried Forward"
              value={summary.carriedForward}
            />

            <MetricCard
              label="Achievement"
              value={`${summary.achievement}%`}
            />
          </div>
        </section>

        {/* STEP 218 — DEDICATED CARRY FORWARD & STATUS FILTER BAR */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs bg-slate-100 p-1 rounded-xl">
            {(
              [
                ['ALL', 'All'],
                ['NEW', 'New Targets'],
                ['CARRIED_FORWARD', 'Carried Forward'],
                ['PARTIAL', 'Partial'],
                ['OVERDUE', 'Overdue'],
                ['CRITICAL', 'Critical'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`rounded-lg px-3 py-1.5 font-bold transition cursor-pointer ${
                  filter === key
                    ? 'bg-[#801424] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <span className="text-xs text-slate-500 font-medium">
            Showing <strong>{filteredEmployees.length}</strong> employee(s)
          </span>
        </div>

        {/* EMPLOYEE EXECUTION (Step 106) */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
              EMPLOYEE EXECUTION
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              Click an employee to view details
            </span>
          </div>

          {filteredEmployees.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
              No employee targets match the "{filter.replace('_', ' ')}" filter for this date.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredEmployees.map((empItem: any) => (
                <EmployeeExecutionCard
                  key={empItem.employee?.id || Math.random()}
                  employee={empItem}
                  onOpen={() => {
                    if (empItem.employee?.id) {
                      navigate(`/employees/${empItem.employee.id}/work`)
                    }
                  }}
                />
              ))}
            </div>
          )}
        </section>

        {/* NEEDS ATTENTION (Step 107 & 110) */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
              NEEDS ATTENTION
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              Top items requiring manager attention ({attentionTargets.length})
            </span>
          </div>

          {attentionTargets.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
              All targets are completed or on track.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {attentionTargets.map((target: any) => (
                <AttentionTargetCard
                  key={target.id}
                  target={target}
                  settings={settings}
                  onView={() => setInspectTarget(target)}
                  onReassign={() => {
                    navigate(
                      target.work_item_id
                        ? `/work-distribution?workItemId=${target.work_item_id}`
                        : '/work-distribution',
                    )
                  }}
                  onExtend={() => {
                    handleOpenEditModal(target)
                  }}
                />
              ))}
            </div>
          )}
        </section>

      </div>

      {/* EDIT / EXTEND TARGET MODAL */}
      {editingTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 relative space-y-4">
            <button
              onClick={() => setEditingTarget(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
            >
              <X size={20} />
            </button>

            <div>
              <h3 className="text-lg font-bold text-slate-900 uppercase tracking-wide">
                EXTEND / EDIT TARGET
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Adjust target commitment, deadline time, or priority
              </p>
            </div>

            <form onSubmit={handleEditTargetSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={editTitleInput}
                  onChange={(e) => setEditTitleInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Target Value ({editingTarget.unit})
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={editValueInput}
                    onChange={(e) => setEditValueInput(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Deadline Time
                  </label>
                  <input
                    type="time"
                    value={editDeadlineTimeInput}
                    onChange={(e) => setEditDeadlineTimeInput(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Priority
                </label>
                <select
                  value={editPriorityInput}
                  onChange={(e) => setEditPriorityInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingTarget(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2.5 rounded-xl bg-[#801424] hover:bg-[#9f1239] text-white font-bold disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STEP 305 — Universal Daily Target Drawer */}
      <DailyTargetDrawer
        target={inspectTarget}
        isOpen={Boolean(inspectTarget)}
        onClose={() => setInspectTarget(null)}
        onUpdateResult={(target) => {
          setInspectTarget(null)
          handleOpenEditModal(target)
        }}
      />
    </div>
  )
}
