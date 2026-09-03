import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  Flame,
  HelpCircle,
  Info,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingUp,
  User,
  Users,
  X,
} from 'lucide-react'

import { useAuth } from '../features/auth/AuthContext'
import {
  getEmployeeTargetHistory,
  getEmployeeTargetPerformance,
} from '../features/daily-targets/daily-target.service'
import MetricCard from '../components/ui/MetricCard'
import HealthBadge from '../components/ui/HealthBadge'

type PresetRange = 'THIS_WEEK' | 'THIS_MONTH' | 'LAST_30_DAYS' | 'ALL'

function getPresetDates(preset: PresetRange) {
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]

  if (preset === 'THIS_WEEK') {
    const day = now.getDay()
    const diffToMon = (day === 0 ? -6 : 1) - day
    const monday = new Date(now)
    monday.setDate(now.getDate() + diffToMon)
    return { from: monday.toISOString().split('T')[0], to: todayStr }
  }

  if (preset === 'THIS_MONTH') {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    return { from: firstDay.toISOString().split('T')[0], to: todayStr }
  }

  if (preset === 'LAST_30_DAYS') {
    const d = new Date(now)
    d.setDate(now.getDate() - 30)
    return { from: d.toISOString().split('T')[0], to: todayStr }
  }

  return { from: undefined, to: undefined }
}

const REASON_LABELS: Record<string, string> = {
  CLIENT_WAITING: 'Client Waiting',
  DEPENDENCY: 'Dependency / Blocked',
  TECHNICAL_ISSUE: 'Technical Issue',
  APPROVAL_PENDING: 'Approval Pending',
  SCOPE_CHANGED: 'Scope Changed',
  MEETING_OVERLOAD: 'Meeting Overload',
  PERSONAL_EMERGENCY: 'Personal Emergency',
  NORMAL_DELAY: 'Normal Delay',
  UNSPECIFIED: 'Unspecified',
}

// Step 158 — Daily history card with Step 164 Daily Timeline
function DailyHistoryCard({ day }: { day: any }) {
  const isAllDone = day.targets.length > 0 && day.targets.every((t: any) => t.status === 'COMPLETED')
  const hasMissed = day.targets.some((t: any) => t.status === 'MISSED')
  const formattedDate = new Date(day.date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })

  return (
    <div
      className={`rounded-2xl border bg-white shadow-xs overflow-hidden transition ${
        hasMissed
          ? 'border-rose-200'
          : isAllDone
          ? 'border-emerald-200'
          : 'border-slate-200'
      }`}
    >
      {/* Day Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-5 bg-slate-50/50">
        <div>
          <h3 className="font-bold text-slate-900 text-base">
            {formattedDate}
          </h3>

          <p className="mt-0.5 text-xs text-slate-500 font-medium">
            {day.completed} completed · {day.partial} partial · {day.missed} missed
          </p>
        </div>

        <div className="flex items-center gap-3 text-right">
          <div>
            <p className="text-2xl font-extrabold text-[#801424]">
              {day.achievement}%
            </p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
              Day Achievement
            </p>
          </div>
        </div>
      </div>

      {/* Targets List for this Day */}
      <div className="divide-y divide-slate-100">
        {day.targets.map((target: any) => {
          const targetValue = Number(target.target_value || 0)
          const actualValue = Number(target.actual_value || 0)
          const achievementPct = Number(target.achievement_percent || 0)
          const carryForwardVal = Number(target.carry_forward_value || 0)
          const health = target.health || 'GREEN'

          return (
            <div key={target.id || `${target.target_id}_${target.target_date}`} className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h4 className="font-bold text-slate-900 text-sm">
                    {target.title || target.target?.title || 'Daily Target'}
                  </h4>

                  <p className="mt-1 text-xs text-slate-500 font-medium">
                    {target.projects?.name || 'General Operations'}
                    {target.project_modules?.name && ` · ${target.project_modules.name}`}
                    {target.sprints?.name && ` · ${target.sprints.name}`}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <HealthBadge health={health} />

                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                      target.status === 'COMPLETED'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : target.status === 'PARTIAL'
                        ? 'bg-orange-50 text-orange-700 border border-orange-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {target.status}
                  </span>
                </div>
              </div>

              {/* Progress and Numbers */}
              <div className="flex items-center justify-between text-xs pt-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800">
                    {actualValue} / {targetValue} {target.unit}
                  </span>
                  <span className="text-slate-400">·</span>
                  <span className="font-extrabold text-[#801424]">
                    {achievementPct}% achieved
                  </span>
                </div>

                {target.deadline_time && (
                  <span className="text-slate-400 text-[11px]">
                    Deadline: {target.deadline_time}
                  </span>
                )}
              </div>

              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#801424] transition-all"
                  style={{ width: `${achievementPct}%` }}
                />
              </div>

              {/* Reason and Notes */}
              {target.result_reason && (
                <div className="flex items-center gap-1.5 text-xs text-orange-700 font-semibold bg-orange-50/60 rounded-lg px-2.5 py-1 border border-orange-200/60">
                  <span>Reason for shortfall:</span>
                  <span className="font-bold">
                    {REASON_LABELS[target.result_reason] || target.result_reason.replaceAll('_', ' ')}
                  </span>
                </div>
              )}

              {target.result_note && (
                <p className="text-xs text-slate-600 bg-slate-50 rounded-lg p-2.5 italic border border-slate-100">
                  "{target.result_note}"
                </p>
              )}

              {carryForwardVal > 0 && (
                <div className="flex items-center gap-1 text-xs font-bold text-orange-700">
                  <Clock size={12} className="shrink-0" />
                  <span>
                    {carryForwardVal} {target.unit} carried forward to next working day
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Step 164 — Daily Timeline */}
      <div className="border-t border-slate-100 bg-slate-50/40 p-4 text-[11px] text-slate-500 space-y-1">
        <p className="font-bold uppercase tracking-wider text-[10px] text-slate-400 font-mono mb-1.5">
          Execution Timeline
        </p>
        <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-slate-600 font-medium">
          <span>• Target assigned</span>
          <span>• Work registered</span>
          <span>• End of day evaluated: {day.completed} completed, {day.partial} partial, {day.missed} missed</span>
          {day.targets.some((t: any) => Number(t.carry_forward_value || 0) > 0) && (
            <span className="text-orange-700 font-bold">• Incomplete work carried forward</span>
          )}
        </div>
      </div>
    </div>
  )
}

export default function EmployeeTargetHistory() {
  const { employeeId: paramEmployeeId } = useParams<{ employeeId?: string }>()
  const { accessToken, profile } = useAuth()
  const navigate = useNavigate()

  // If no employeeId param provided, default to current user's profile ID (Step 163)
  const targetEmployeeId = paramEmployeeId || profile?.id || ''

  const [preset, setPreset] = useState<PresetRange>('THIS_MONTH')
  const [historyData, setHistoryData] = useState<any[]>([])
  const [perfReport, setPerfReport] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedReasonFilter, setSelectedReasonFilter] = useState<string | null>(null)

  async function load() {
    if (!accessToken || !targetEmployeeId) return

    setLoading(true)
    setError('')

    try {
      const { from, to } = getPresetDates(preset)
      const [hist, perf] = await Promise.all([
        getEmployeeTargetHistory(accessToken, targetEmployeeId, from, to),
        getEmployeeTargetPerformance(accessToken, targetEmployeeId, from, to),
      ])

      setHistoryData(hist || [])
      setPerfReport(perf)
    } catch (err: any) {
      setError(err.message || 'Failed to load employee target history.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [accessToken, targetEmployeeId, preset])

  // Step 160 — Trend Chart calculation
  const weeklyTrends = useMemo(() => {
    if (!historyData || historyData.length === 0) return []

    const weekBuckets: Record<string, { sumPct: number; count: number }> = {}

    historyData.forEach((day: any) => {
      const date = new Date(day.date)
      const weekNumber = Math.ceil(date.getDate() / 7)
      const monthName = date.toLocaleString('default', { month: 'short' })
      const key = `${monthName} W${weekNumber}`

      if (!weekBuckets[key]) {
        weekBuckets[key] = { sumPct: 0, count: 0 }
      }
      weekBuckets[key].sumPct += Number(day.achievement || 0)
      weekBuckets[key].count++
    })

    return Object.entries(weekBuckets).map(([week, stats]) => ({
      week,
      achievement: Math.round(stats.sumPct / stats.count),
    }))
  }, [historyData])

  // Step 161 — Filter daily history by selected cause/reason
  const filteredHistory = useMemo(() => {
    if (!selectedReasonFilter) return historyData
    return historyData.filter((day: any) =>
      day.targets.some((t: any) => t.result_reason === selectedReasonFilter),
    )
  }, [historyData, selectedReasonFilter])

  const summary = perfReport?.summary || {
    total: 0,
    completed: 0,
    partial: 0,
    missed: 0,
    achievement: 0,
    carryForward: 0,
    onTimePercent: 0,
  }

  const carryForwardRate =
    summary.total === 0 ? 0 : Math.round((summary.carryForward / summary.total) * 100)
  const missedRate =
    summary.total === 0 ? 0 : Math.round((summary.missed / summary.total) * 100)

  // Average daily achievement
  const avgDailyAchievement =
    historyData.length === 0
      ? 0
      : Math.round(
          historyData.reduce((sum, d) => sum + Number(d.achievement || 0), 0) /
            historyData.length,
        )

  const employeeName =
    historyData[0]?.targets?.[0]?.employee
      ? `${historyData[0].targets[0].employee.first_name} ${historyData[0].targets[0].employee.last_name || ''}`.trim()
      : profile?.id === targetEmployeeId
      ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
      : 'Employee'

  const isSelf = profile?.id === targetEmployeeId

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* HEADER & BREADCRUMB */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-slate-200/80 pb-5">
          <div className="space-y-1">
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-900 cursor-pointer mb-1"
            >
              <ArrowLeft size={14} />
              <span>Back</span>
            </button>

            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              {isSelf ? 'MY TARGET EXECUTION HISTORY' : `${employeeName} · Target History`}
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Complete chronological daily execution log and cause attribution.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Preset Range Selector (Step 149) */}
            <div className="inline-flex rounded-xl bg-white p-1 border border-slate-200 shadow-2xs">
              {(
                [
                  ['THIS_WEEK', 'This Week'],
                  ['THIS_MONTH', 'This Month'],
                  ['LAST_30_DAYS', 'Last 30 Days'],
                  ['ALL', 'All Time'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setPreset(key)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                    preset === key
                      ? 'bg-[#801424] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs cursor-pointer"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
              />
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-700">
            {error}
          </div>
        )}

        {/* 1. OVERVIEW METRICS ROW (Step 159) */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-2xl border border-[#801424]/20 bg-rose-50/50 p-5 shadow-2xs">
            <span className="text-xs font-bold uppercase text-[#801424] font-mono">
              Target Achievement
            </span>
            <p className="mt-2 text-3xl font-extrabold text-[#801424]">
              {summary.achievement}%
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {summary.completed} / {summary.total} targets achieved
            </p>
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5 shadow-2xs">
            <span className="text-xs font-bold uppercase text-blue-700 font-mono">
              On-Time Rate
            </span>
            <p className="mt-2 text-3xl font-extrabold text-blue-900">
              {summary.onTimePercent}%
            </p>
            <p className="mt-1 text-xs text-blue-600">
              Completed on target day
            </p>
          </div>

          <div className="rounded-2xl border border-orange-200 bg-orange-50/50 p-5 shadow-2xs">
            <span className="text-xs font-bold uppercase text-orange-700 font-mono">
              Carry Forward
            </span>
            <p className="mt-2 text-3xl font-extrabold text-orange-800">
              {carryForwardRate}%
            </p>
            <p className="mt-1 text-xs text-orange-600">
              {summary.carryForward} carried forward
            </p>
          </div>

          <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-5 shadow-2xs">
            <span className="text-xs font-bold uppercase text-rose-700 font-mono">
              Missed Rate
            </span>
            <p className="mt-2 text-3xl font-extrabold text-rose-800">
              {missedRate}%
            </p>
            <p className="mt-1 text-xs text-rose-600">
              {summary.missed} targets missed
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <span className="text-xs font-bold uppercase text-slate-400 font-mono">
              Avg Daily Rate
            </span>
            <p className="mt-2 text-3xl font-extrabold text-slate-900">
              {avgDailyAchievement}%
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Across {historyData.length} active days
            </p>
          </div>
        </section>

        {/* 2. REASON BREAKDOWN (Step 161) & TREND CHART (Step 160) */}
        <div className="grid gap-6 lg:grid-cols-12">

          {/* DELAY REASONS (Step 161) */}
          <div className="lg:col-span-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                  WHY TARGETS WERE NOT COMPLETED
                </h3>
                <p className="text-[11px] text-slate-500">
                  Click any reason to filter the daily history log below.
                </p>
              </div>

              {selectedReasonFilter && (
                <button
                  onClick={() => setSelectedReasonFilter(null)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#801424] hover:underline cursor-pointer"
                >
                  <X size={12} /> Clear Filter
                </button>
              )}
            </div>

            {!perfReport?.reasonCounts || Object.keys(perfReport.reasonCounts).length === 0 ? (
              <p className="py-6 text-center text-slate-400 text-xs italic">
                No delays or missed targets in this period.
              </p>
            ) : (
              <div className="space-y-2.5">
                {Object.entries(perfReport.reasonCounts)
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .map(([reason, count]) => {
                    const label = REASON_LABELS[reason] || reason.replaceAll('_', ' ')
                    const isSelected = selectedReasonFilter === reason
                    return (
                      <button
                        key={reason}
                        onClick={() =>
                          setSelectedReasonFilter(isSelected ? null : reason)
                        }
                        className={`w-full text-left p-2.5 rounded-xl border transition cursor-pointer space-y-1.5 ${
                          isSelected
                            ? 'border-[#801424] bg-rose-50/50 shadow-xs'
                            : 'border-slate-100 bg-slate-50/50 hover:bg-slate-100/70'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                          <span>{label}</span>
                          <span className="text-slate-900">{count as number} time(s)</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#801424]"
                            style={{
                              width: `${Math.min(
                                100,
                                ((count as number) / (summary.total || 1)) * 100,
                              )}%`,
                            }}
                          />
                        </div>
                      </button>
                    )
                  })}
              </div>
            )}
          </div>

          {/* TREND CHART (Step 160) */}
          <div className="lg:col-span-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                WEEKLY ACHIEVEMENT TRAJECTORY
              </h3>
              <TrendingUp className="h-4 w-4 text-slate-400" />
            </div>

            {weeklyTrends.length === 0 ? (
              <p className="py-8 text-center text-slate-400 text-xs italic">
                Insufficient data for weekly trends.
              </p>
            ) : (
              <div className="space-y-3 pt-2">
                {weeklyTrends.map((t) => (
                  <div key={t.week} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span>{t.week}</span>
                      <span className="font-extrabold text-slate-900">{t.achievement}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#801424] transition-all"
                        style={{ width: `${t.achievement}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* 3. DAILY HISTORY LIST (Step 157 & 158) */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                DAILY HISTORY LOG ({filteredHistory.length} Days)
              </h2>
              {selectedReasonFilter && (
                <span className="text-xs text-orange-700 font-bold">
                  Filtered by: {REASON_LABELS[selectedReasonFilter] || selectedReasonFilter}
                </span>
              )}
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-400 text-sm">
              Loading daily execution history...
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-slate-500 text-sm">
              No target history recorded matching the criteria.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredHistory.map((day) => (
                <DailyHistoryCard key={day.date} day={day} />
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  )
}
