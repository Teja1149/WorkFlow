import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock3, RefreshCw } from 'lucide-react'
import { useAuth } from '../features/auth/AuthContext'
import {
  getTodayWork,
  processCarryForward,
  refreshWorkHealth,
} from '../features/work-execution/work-execution.service'
import type {
  DailyWorkItem,
  TodayWork,
} from '../features/work-execution/work-execution.types'

function formatDeadlineDisplay(item: DailyWorkItem) {
  if (!item.deadline) return null

  let timeString = ''
  if (item.deadline_time) {
    const [h, m] = item.deadline_time.split(':')
    const hour = parseInt(h, 10)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const formattedHour = hour % 12 || 12
    timeString = `${formattedHour}:${m} ${ampm}`
  }

  const effectiveTime = item.deadline_time || '18:00'
  const deadlineDate = new Date(`${item.deadline}T${effectiveTime}`)
  const diffMs = deadlineDate.getTime() - Date.now()

  let countdownText = ''
  if (item.status === 'DONE') {
    countdownText = 'Completed'
  } else if (diffMs < 0) {
    const absMs = Math.abs(diffMs)
    const hours = Math.floor(absMs / (1000 * 60 * 60))
    const mins = Math.floor((absMs % (1000 * 60 * 60)) / (1000 * 60))
    countdownText = `OVERDUE BY ${hours}h ${mins}m`
  } else {
    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    countdownText = `${hours}h ${mins}m remaining`
  }

  return {
    deadlineLabel: timeString ? `Deadline: ${timeString}` : `Deadline: ${item.deadline}`,
    countdownText,
    isOverdue: diffMs < 0 && item.status !== 'DONE',
  }
}

function WorkCard({ item }: { item: DailyWorkItem }) {
  const healthClass = {
    GREEN: 'border-emerald-200 bg-emerald-50',
    AMBER: 'border-amber-200 bg-amber-50',
    ORANGE: 'border-orange-200 bg-orange-50',
    RED: 'border-red-200 bg-red-50',
    CRITICAL: 'border-red-300 bg-red-100',
  }[item.health]

  const deadlineInfo = formatDeadlineDisplay(item)

  return (
    <div className={`rounded-xl border p-4 ${healthClass}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-900">
            {item.title}
          </h3>

          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {item.work_types?.name && (
              <span className="rounded-full bg-white/80 px-2 py-1">
                {item.work_types.name}
              </span>
            )}

            {item.project_modules?.name && (
              <span className="rounded-full bg-white/80 px-2 py-1">
                {item.project_modules.name}
              </span>
            )}

            <span className="rounded-full bg-white/80 px-2 py-1 font-semibold">
              {item.status}
            </span>

            {item.target_quantity && Number(item.target_quantity) > 0 && (
              <span className="rounded-full bg-[#801424]/10 text-[#801424] px-2 py-1 font-bold">
                {item.completed_quantity || 0} / {item.target_quantity} {item.quantity_unit || 'items'}
              </span>
            )}
          </div>
        </div>

        <span className="shrink-0 text-sm font-bold">
          {item.target_quantity && Number(item.target_quantity) > 0
            ? `${Math.min(100, Math.round(((Number(item.completed_quantity) || 0) / Number(item.target_quantity)) * 100))}%`
            : `${item.progress_percent || 0}%`}
        </span>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/70">
        <div
          className="h-full rounded-full bg-slate-700 transition-all"
          style={{
            width: `${Math.min(
              100,
              Math.max(0, item.progress_percent || 0),
            )}%`,
          }}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-600">
        {deadlineInfo && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 font-medium">
              <Clock3 className="h-3.5 w-3.5" />
              {deadlineInfo.deadlineLabel}
            </span>
            <span
              className={`rounded-md px-2 py-0.5 font-bold ${
                deadlineInfo.isOverdue
                  ? 'bg-red-200 text-red-900'
                  : 'bg-white/80 text-slate-700'
              }`}
            >
              {deadlineInfo.countdownText}
            </span>
          </div>
        )}

        {item.carry_forward_count > 0 && (
          <span className="font-semibold text-orange-700">
            Carried forward {item.carry_forward_count}x
          </span>
        )}

        <span className="font-semibold">
          {item.health === 'RED'
            ? 'OVERDUE'
            : item.health === 'CRITICAL'
            ? 'EMERGENCY'
            : item.health}
        </span>
      </div>
    </div>
  )
}

function Section({
  title,
  items,
}: {
  title: string
  items: DailyWorkItem[]
}) {
  if (items.length === 0) return null

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">
          {title}
        </h2>

        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
          {items.length}
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {items.map((item) => (
          <WorkCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  )
}

export default function DailyWork() {
  const { accessToken, profile } = useAuth()

  const [data, setData] = useState<TodayWork>({
    carryForward: [],
    newWork: [],
    inProgress: [],
    atRisk: [],
    overdue: [],
    critical: [],
  })

  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    if (!accessToken) return

    setLoading(true)
    setError('')

    try {
      const result = await getTodayWork(accessToken)
      setData(result)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load today’s work.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [accessToken])

  async function handleRefreshHealth() {
    if (!accessToken) return

    setWorking(true)

    try {
      await refreshWorkHealth(accessToken)
      await load()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to refresh work health.',
      )
    } finally {
      setWorking(false)
    }
  }

  async function handleProcessCarryForward() {
    if (!accessToken) return

    setWorking(true)
    setError('')

    try {
      const result = await processCarryForward(accessToken)

      await load()

      alert(
        `${result.carriedForward} work item(s) carried forward to ${result.nextWorkingDay}.`,
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to process carry-forward work.',
      )
    } finally {
      setWorking(false)
    }
  }

  const total =
    data.carryForward.length +
    data.newWork.length +
    data.inProgress.length +
    data.atRisk.length +
    data.overdue.length +
    data.critical.length

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-slate-500">
              {profile?.role === 'EMPLOYEE'
                ? 'My execution'
                : 'Team execution'}
            </p>

            <h1 className="mt-1 text-3xl font-bold text-slate-900">
              Daily Work
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              {total} active work items require attention.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {profile?.role !== 'EMPLOYEE' && (
              <button
                onClick={handleProcessCarryForward}
                disabled={working}
                className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50 cursor-pointer"
              >
                Process Carry Forward
              </button>
            )}

            <button
              onClick={handleRefreshHealth}
              disabled={working}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw
                className={`h-4 w-4 ${working ? 'animate-spin' : ''}`}
              />
              Refresh Health
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
            <RefreshCw className="mx-auto h-6 w-6 animate-spin text-slate-400" />
            <p className="mt-3 text-sm text-slate-500">
              Loading today's work...
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-xs font-semibold uppercase text-slate-400">
                  Active
                </p>
                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {total}
                </p>
              </div>

              <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5">
                <p className="text-xs font-semibold uppercase text-orange-600">
                  At Risk
                </p>
                <p className="mt-2 text-3xl font-bold text-orange-700">
                  {data.atRisk.length}
                </p>
              </div>

              <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
                <p className="text-xs font-semibold uppercase text-red-600">
                  Overdue
                </p>
                <p className="mt-2 text-3xl font-bold text-red-700">
                  {data.overdue.length}
                </p>
              </div>

              <div className="rounded-2xl border border-red-300 bg-red-100 p-5">
                <p className="text-xs font-semibold uppercase text-red-700">
                  Critical
                </p>
                <p className="mt-2 text-3xl font-bold text-red-800">
                  {data.critical.length}
                </p>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <p className="text-xs font-semibold uppercase text-amber-700">
                  Carry Forward
                </p>
                <p className="mt-2 text-3xl font-bold text-amber-800">
                  {data.carryForward.length}
                </p>
              </div>
            </div>

            <Section
              title="Critical"
              items={data.critical}
            />

            <Section
              title="Overdue"
              items={data.overdue}
            />

            <Section
              title="At Risk"
              items={data.atRisk}
            />

            <Section
              title="Carried Forward"
              items={data.carryForward}
            />

            <Section
              title="In Progress"
              items={data.inProgress}
            />

            <Section
              title="New Work"
              items={data.newWork}
            />

            {total === 0 && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-12 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
                <h2 className="mt-3 font-semibold text-emerald-900">
                  All clear
                </h2>
                <p className="mt-1 text-sm text-emerald-700">
                  No active work requires attention.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
