import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  RefreshCw,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { useAuth } from '../features/auth/AuthContext'
import { getMyDay } from '../features/work-execution/my-day.service'
import type {
  DailyWorkItem,
  TodayWork,
} from '../features/work-execution/work-execution.types'
import DeadlineCountdown from '../features/work-execution/DeadlineCountdown'
import {
  getOrganizationWorkSettings,
  type OrganizationWorkSettings,
} from '../features/organization-settings/organization-setting.service'
import { getEmployeeDailyTargets, updateDailyTargetResult } from '../features/daily-targets/daily-target.service'
import {
  subscribeToWorkItems,
  subscribeToWorkUpdates,
} from '../features/work-items/work-item.realtime'
import {
  subscribeToDailyTargets,
} from '../features/daily-targets/daily-target.realtime'
import type { DailyTarget } from '../features/daily-targets/daily-target.types'
import MetricCard from '../components/ui/MetricCard'
import HealthBadge from '../components/ui/HealthBadge'
import DailyTargetCard from '../features/daily-targets/DailyTargetCard'
import DailyTargetDrawer from '../features/daily-targets/DailyTargetDrawer'
import DailyReportRequiredBanner from '../features/projects/components/DailyReportRequiredBanner'

function healthClass(health: DailyWorkItem['health']) {
  switch (health) {
    case 'CRITICAL':
      return 'border-red-300 bg-red-100 text-red-800'
    case 'RED':
      return 'border-red-200 bg-red-50 text-red-700'
    case 'ORANGE':
      return 'border-orange-200 bg-orange-50 text-orange-700'
    case 'AMBER':
      return 'border-amber-200 bg-amber-50 text-amber-700'
    default:
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }
}

function WorkCard({
  item,
  settings,
}: {
  item: DailyWorkItem
  settings: OrganizationWorkSettings | null
}) {
  const statusLabel =
    item.status === 'TODO'
      ? 'Pending'
      : item.status === 'IN_PROGRESS'
      ? 'In Progress'
      : item.status === 'BLOCKED'
      ? 'Blocked'
      : item.status === 'DONE'
      ? 'Completed'
      : item.status

  const statusClass =
    item.status === 'DONE'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : item.status === 'IN_PROGRESS'
      ? 'bg-blue-50 text-blue-700 border-blue-200'
      : item.status === 'BLOCKED'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : item.health === 'CRITICAL' || item.health === 'RED'
      ? 'bg-rose-50 text-rose-700 border-rose-200'
      : 'bg-slate-50 text-slate-600 border-slate-200'

  const urgency =
    item.health === 'CRITICAL'
      ? 'URGENT'
      : item.health === 'RED'
      ? 'OVERDUE'
      : item.health === 'ORANGE'
      ? 'DUE SOON'
      : null

  return (
    <Link
      to={`/work-items/${item.id}`}
      className="block rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 hover:border-slate-300 hover:shadow-sm transition"
    >
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-slate-900 text-sm sm:text-base truncate">
              {item.title}
            </h3>

            <span
              className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusClass}`}
            >
              {statusLabel}
            </span>

            {urgency && (
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                  urgency === 'OVERDUE' || urgency === 'URGENT'
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}
              >
                {urgency}
              </span>
            )}

            {item.target_quantity && Number(item.target_quantity) > 0 && (
              <span className="rounded-full bg-rose-50 border border-rose-200 px-2.5 py-1 text-[10px] font-bold text-[#801424]">
                {item.completed_quantity || 0} / {item.target_quantity} {item.quantity_unit || 'items'} completed
              </span>
            )}
          </div>

          <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-xs text-slate-500">
            {item.projects?.name && (
              <span className="font-medium">{item.projects.name}</span>
            )}

            {item.project_modules?.name && (
              <span>• {item.project_modules.name}</span>
            )}

            {item.work_types?.name && (
              <span>• {item.work_types.name}</span>
            )}
          </div>

          {item.description && (
            <p className="mt-2 text-xs text-slate-500 line-clamp-2">
              {item.description}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between lg:justify-end gap-4 shrink-0">
          {item.deadline && (
            <div className="text-right">
              <p className="text-[10px] uppercase font-bold tracking-wide text-slate-400">
                Deadline
              </p>

              <div className="mt-1">
                <DeadlineCountdown
                  deadline={item.deadline}
                  deadlineTime={item.deadline_time || null}
                  timezone={settings?.timezone || 'Asia/Kolkata'}
                  workdayEnd={settings?.workday_end || '18:00'}
                  health={item.health}
                />
              </div>
            </div>
          )}

          <span className="text-slate-300 text-lg">→</span>
        </div>
      </div>
    </Link>
  )
}

export default function MyDay() {
  const { accessToken, profile } = useAuth()

  const [data, setData] = useState<TodayWork>({
    carryForward: [],
    newWork: [],
    inProgress: [],
    atRisk: [],
    overdue: [],
    critical: [],
  })

  const [dailyTargets, setDailyTargets] = useState<DailyTarget[]>([])
  const [targetLoading, setTargetLoading] = useState(false)
  const [selectedTarget, setSelectedTarget] = useState<DailyTarget | null>(null)
  const [inspectTarget, setInspectTarget] = useState<DailyTarget | null>(null)
  const [resultModalOpen, setResultModalOpen] = useState(false)

  const [resultValue, setResultValue] = useState('')
  const [resultReason, setResultReason] = useState('')
  const [resultNote, setResultNote] = useState('')
  const [actualHours, setActualHours] = useState('')

  const [settings, setSettings] = useState<OrganizationWorkSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadDailyTargets() {
    if (!accessToken || !profile?.id) return

    setTargetLoading(true)

    try {
      const today = new Date()
        .toISOString()
        .slice(0, 10)

      const targets =
        await getEmployeeDailyTargets(
          accessToken,
          profile.id,
          today,
        )

      setDailyTargets(
        Array.isArray(targets)
          ? targets
          : [],
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load today’s targets.',
      )
    } finally {
      setTargetLoading(false)
    }
  }

  async function load() {
    if (!accessToken || !profile?.id) return

    setLoading(true)
    setError('')

    try {
      const [work, workSettings] = await Promise.all([
        getMyDay(accessToken),
        getOrganizationWorkSettings(accessToken).catch(() => null),
      ])

      setData(work)
      setSettings(workSettings)
      await loadDailyTargets()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load My Day.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [accessToken, profile?.id])

  // Step 445 — Realtime Subscriptions for immediate reflection of assignments/updates
  useEffect(() => {
    if (!profile?.organization_id) return

    const unsubscribeWork = subscribeToWorkItems(
      profile.organization_id,
      () => {
        void load()
      },
    )

    const unsubscribeUpdates = subscribeToWorkUpdates(
      profile.organization_id,
      () => {
        void load()
      },
    )

    const unsubscribeTargets = subscribeToDailyTargets(
      profile.organization_id,
      () => {
        void load()
      },
    )

    return () => {
      unsubscribeWork()
      unsubscribeUpdates()
      unsubscribeTargets()
    }
  }, [profile?.organization_id])

  const carriedForwardTargets = dailyTargets.filter(
    (target) => target.carried_forward_from !== null,
  )

  const newTargets = dailyTargets.filter(
    (target) => target.carried_forward_from === null,
  )

  const carriedValue = carriedForwardTargets.reduce(
    (sum, target) => sum + Number(target.target_value || 0),
    0,
  )

  const newValue = newTargets.reduce(
    (sum, target) => sum + Number(target.target_value || 0),
    0,
  )

  const totalTargets = dailyTargets.length

  const completedTargets = dailyTargets.filter(
    (target) => target.status === 'COMPLETED',
  ).length

  const totalTargetValue = dailyTargets.reduce(
    (sum, target) => sum + Number(target.target_value || 0),
    0,
  )

  const totalActualValue = dailyTargets.reduce(
    (sum, target) => sum + Number(target.actual_value || 0),
    0,
  )

  const totalRemaining = Math.max(
    0,
    totalTargetValue - totalActualValue,
  )

  const achievement =
    totalTargetValue === 0
      ? 0
      : Math.min(
          100,
          Math.round(
            (totalActualValue / totalTargetValue) * 100,
          ),
        )

  function openResultModal(target: DailyTarget) {
    setSelectedTarget(target)
    setResultValue(String(target.actual_value || 0))
    setResultReason(target.result_reason || '')
    setResultNote(target.result_note || '')
    setActualHours(
      target.actual_hours !== null && target.actual_hours !== undefined
        ? String(target.actual_hours)
        : '',
    )
    setResultModalOpen(true)
  }

  async function handleSubmitResult(event: React.FormEvent) {
    event.preventDefault()

    if (!accessToken || !selectedTarget) {
      return
    }

    try {
      await updateDailyTargetResult(
        accessToken,
        selectedTarget.id,
        {
          actual_value: Number(resultValue) || 0,
          actual_hours: actualHours ? Number(actualHours) : null,
          result_reason: resultReason || null,
          result_note: resultNote.trim() || undefined,
        },
      )

      setResultModalOpen(false)
      setSelectedTarget(null)

      await loadDailyTargets()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to submit result.',
      )
    }
  }

  const allCurrentWork = useMemo(() => {
    const list = [
      ...(data.critical || []),
      ...(data.overdue || []),
      ...(data.inProgress || []),
      ...(data.atRisk || []),
      ...(data.newWork || []),
      ...(data.carryForward || []),
    ]
    const seen = new Set<string>()
    return list.filter((item) => {
      if (seen.has(item.id)) return false
      seen.add(item.id)
      return true
    })
  }, [data])

  if (loading && dailyTargets.length === 0) {
    return (
      <div className="p-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-xs">
          <RefreshCw className="mx-auto h-6 w-6 animate-spin text-slate-400" />
          <p className="mt-3 text-sm text-slate-500">
            Loading your work...
          </p>
        </div>
      </div>
    )
  }

  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Employee Workspace
            </p>

            <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-slate-900">
              My Work
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              {formattedDate} · Focus on what needs your attention today.
            </p>
          </div>

          <button
            onClick={load}
            disabled={loading || targetLoading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs cursor-pointer"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                loading || targetLoading ? 'animate-spin' : ''
              }`}
            />
            Refresh
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {/* PROMINENT DAILY REPORT COMPLIANCE BANNER */}
        {accessToken && (
          <DailyReportRequiredBanner
            accessToken={accessToken}
            onReportSubmitted={load}
          />
        )}

        {/* QUICK OVERVIEW */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <button
            type="button"
            onClick={() => {
              document
                .getElementById('pending-work')
                ?.scrollIntoView({ behavior: 'smooth' })
            }}
            className="rounded-2xl border border-slate-200 bg-white p-4 text-left hover:border-slate-300 transition cursor-pointer"
          >
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Pending
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {data.newWork?.length || 0}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Not started
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              document
                .getElementById('in-progress-work')
                ?.scrollIntoView({ behavior: 'smooth' })
            }}
            className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 text-left hover:border-blue-200 transition cursor-pointer"
          >
            <p className="text-[10px] font-bold uppercase tracking-wide text-blue-600">
              In Progress
            </p>
            <p className="mt-2 text-2xl font-bold text-blue-900">
              {data.inProgress?.length || 0}
            </p>
            <p className="mt-1 text-[11px] text-blue-700">
              Currently working
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              document
                .getElementById('due-soon-work')
                ?.scrollIntoView({ behavior: 'smooth' })
            }}
            className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4 text-left hover:border-amber-200 transition cursor-pointer"
          >
            <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700">
              Due Soon
            </p>
            <p className="mt-2 text-2xl font-bold text-amber-900">
              {data.atRisk?.length || 0}
            </p>
            <p className="mt-1 text-[11px] text-amber-700">
              Needs attention
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              document
                .getElementById('overdue-work')
                ?.scrollIntoView({ behavior: 'smooth' })
            }}
            className="rounded-2xl border border-rose-100 bg-rose-50/70 p-4 text-left hover:border-rose-200 transition cursor-pointer"
          >
            <p className="text-[10px] font-bold uppercase tracking-wide text-rose-700">
              Overdue
            </p>
            <p className="mt-2 text-2xl font-bold text-rose-900">
              {(data.overdue?.length || 0) + (data.critical?.length || 0)}
            </p>
            <p className="mt-1 text-[11px] text-rose-700">
              Act immediately
            </p>
          </button>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 col-span-2 lg:col-span-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Daily Target
            </p>

            <p className="mt-2 text-2xl font-bold text-slate-900">
              {completedTargets}/{totalTargets}
            </p>

            <p className="mt-1 text-[11px] text-slate-500">
              targets completed
            </p>
          </div>
        </div>

        {/* URGENT */}
        {(data.critical?.length > 0 || data.overdue?.length > 0) && (
          <section
            id="overdue-work"
            className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4 sm:p-5"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                <AlertTriangle size={18} />
              </div>

              <div>
                <h2 className="text-sm font-bold text-rose-900">
                  Needs Immediate Attention
                </h2>
                <p className="text-xs text-rose-700 mt-0.5">
                  Overdue or critical work should be handled first.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {[...(data.critical || []), ...(data.overdue || [])]
                .filter(
                  (item, index, arr) =>
                    arr.findIndex((x) => x.id === item.id) === index,
                )
                .map((item) => (
                  <WorkCard
                    key={item.id}
                    item={item}
                    settings={settings}
                  />
                ))}
            </div>
          </section>
        )}

        {/* IN PROGRESS */}
        <section id="in-progress-work">
          <div className="flex items-end justify-between mb-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                In Progress
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Work you are currently executing.
              </p>
            </div>

            <span className="rounded-full bg-blue-50 border border-blue-100 px-3 py-1 text-[10px] font-bold text-blue-700">
              {data.inProgress?.length || 0}
            </span>
          </div>

          {data.inProgress?.length ? (
            <div className="space-y-3">
              {data.inProgress.map((item) => (
                <WorkCard
                  key={item.id}
                  item={item}
                  settings={settings}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
              <p className="text-sm font-semibold text-slate-700">
                Nothing currently in progress
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Pick a pending task when you're ready to start.
              </p>
            </div>
          )}
        </section>

        {/* DUE SOON */}
        <section id="due-soon-work">
          <div className="flex items-end justify-between mb-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Due Soon
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Tasks approaching their deadline.
              </p>
            </div>

            <span className="rounded-full bg-amber-50 border border-amber-100 px-3 py-1 text-[10px] font-bold text-amber-700">
              {data.atRisk?.length || 0}
            </span>
          </div>

          {data.atRisk?.length ? (
            <div className="space-y-3">
              {data.atRisk.map((item) => (
                <WorkCard
                  key={item.id}
                  item={item}
                  settings={settings}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
              <p className="text-sm font-semibold text-slate-700">
                No tasks are currently due soon
              </p>
            </div>
          )}
        </section>

        {/* PENDING */}
        <section id="pending-work">
          <div className="flex items-end justify-between mb-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Pending Work
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Tasks waiting for you to start.
              </p>
            </div>

            <span className="rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-[10px] font-bold text-slate-700">
              {data.newWork?.length || 0}
            </span>
          </div>

          {data.newWork?.length ? (
            <div className="space-y-3">
              {data.newWork.map((item) => (
                <WorkCard
                  key={item.id}
                  item={item}
                  settings={settings}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
              <p className="text-sm font-semibold text-slate-700">
                No pending work
              </p>
              <p className="mt-1 text-xs text-slate-500">
                You're caught up.
              </p>
            </div>
          )}
        </section>

        {/* CARRY FORWARD */}
        {data.carryForward?.length > 0 && (
          <section>
            <div className="mb-3">
              <h2 className="text-lg font-bold text-slate-900">
                Carried Forward
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Work that was not finished on previous working days.
              </p>
            </div>

            <div className="space-y-3">
              {data.carryForward.map((item) => (
                <WorkCard
                  key={item.id}
                  item={item}
                  settings={settings}
                />
              ))}
            </div>
          </section>
        )}

        {/* TODAY'S TARGETS — COMPACT */}
        {dailyTargets.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Today's Targets
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Record your result when the work is complete.
                </p>
              </div>

              <span className="text-xs font-bold text-slate-700">
                {completedTargets}/{totalTargets}
              </span>
            </div>

            <div className="space-y-2">
              {dailyTargets.map((target) => (
                <button
                  key={target.id}
                  type="button"
                  onClick={() => setInspectTarget(target)}
                  className="w-full rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-left hover:bg-white hover:border-slate-200 transition cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">
                        {target.title}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-500">
                        {target.status === 'COMPLETED'
                          ? 'Completed'
                          : 'Result pending'}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${
                        target.status === 'COMPLETED'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {target.status === 'COMPLETED'
                        ? 'DONE'
                        : 'UPDATE'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

      </div>

      {/* RESULT MODAL UI */}
      {resultModalOpen && selectedTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4">

          <form
            onSubmit={handleSubmitResult}
            className="w-full max-w-lg rounded-2xl bg-white shadow-xl"
          >

            <div className="border-b border-slate-100 p-6">
              <h2 className="text-lg font-semibold text-slate-900">
                Update Result
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {selectedTarget.title}
              </p>
            </div>

            <div className="space-y-4 p-6">

              <div className="rounded-xl bg-slate-50 p-4">
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">
                    Target
                  </span>

                  <span className="font-semibold text-slate-800">
                    {selectedTarget.target_value}{' '}
                    {selectedTarget.unit}
                  </span>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Completed
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={resultValue}
                  onChange={(e) =>
                    setResultValue(
                      e.target.value,
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Actual Hours
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={actualHours}
                  onChange={(e) =>
                    setActualHours(
                      e.target.value,
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Reason
                </label>

                <select
                  value={resultReason}
                  onChange={(e) =>
                    setResultReason(
                      e.target.value,
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                >
                  <option value="">
                    Select reason
                  </option>
                  <option value="COMPLETED">
                    Completed
                  </option>
                  <option value="NORMAL_DELAY">
                    Normal delay
                  </option>
                  <option value="DEPENDENCY">
                    Dependency
                  </option>
                  <option value="CLIENT_WAITING">
                    Client waiting
                  </option>
                  <option value="RESOURCE_UNAVAILABLE">
                    Resource unavailable
                  </option>
                  <option value="TECHNICAL_ISSUE">
                    Technical issue
                  </option>
                  <option value="APPROVAL_PENDING">
                    Approval pending
                  </option>
                  <option value="UNPLANNED_WORK">
                    Unplanned work
                  </option>
                  <option value="OTHER">
                    Other
                  </option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Notes
                </label>

                <textarea
                  value={resultNote}
                  onChange={(e) =>
                    setResultNote(
                      e.target.value,
                    )
                  }
                  rows={3}
                  placeholder="Explain anything important about today's result..."
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                />
              </div>

            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 p-6">

              <button
                type="button"
                onClick={() =>
                  setResultModalOpen(false)
                }
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 cursor-pointer hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="rounded-lg bg-[#801424] px-5 py-2 text-sm font-semibold text-white cursor-pointer hover:bg-[#9f1239]"
              >
                Submit Result
              </button>

            </div>
          </form>
        </div>
      )}

      {/* STEP 305 — Universal Daily Target Inspection Drawer */}
      <DailyTargetDrawer
        target={inspectTarget}
        isOpen={Boolean(inspectTarget)}
        onClose={() => setInspectTarget(null)}
        onUpdateResult={(target) => {
          setInspectTarget(null)
          openResultModal(target)
        }}
      />
    </div>
  )
}
