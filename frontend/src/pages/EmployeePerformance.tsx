import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Award,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock3,
  HelpCircle,
  Info,
  RefreshCw,
  Search,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react'

import { useAuth } from '../features/auth/AuthContext'
import {
  getEmployeeTargetPerformance,
  getTeamTargetPerformance,
} from '../features/daily-targets/daily-target.service'
import MetricCard from '../components/ui/MetricCard'
import HealthBadge from '../components/ui/HealthBadge'

type TimeFilter = 'THIS_WEEK' | 'THIS_MONTH' | 'LAST_30_DAYS' | 'ALL'

function getDateRange(filter: TimeFilter) {
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]

  if (filter === 'THIS_WEEK') {
    const day = now.getDay()
    const diffToMon = (day === 0 ? -6 : 1) - day
    const monday = new Date(now)
    monday.setDate(now.getDate() + diffToMon)
    return {
      from: monday.toISOString().split('T')[0],
      to: todayStr,
    }
  }

  if (filter === 'THIS_MONTH') {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    return {
      from: firstDay.toISOString().split('T')[0],
      to: todayStr,
    }
  }

  if (filter === 'LAST_30_DAYS') {
    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(now.getDate() - 30)
    return {
      from: thirtyDaysAgo.toISOString().split('T')[0],
      to: todayStr,
    }
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

export default function EmployeePerformance() {
  const { accessToken, profile } = useAuth()

  const [timeFilter, setTimeFilter] = useState<TimeFilter>('THIS_MONTH')
  const [teamPerformance, setTeamPerformance] = useState<any[]>([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  const [employeeReport, setEmployeeReport] = useState<any | null>(null)

  const [loadingTeam, setLoadingTeam] = useState(true)
  const [loadingEmployee, setLoadingEmployee] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const isManagerOrAdmin =
    profile?.role === 'SUPER_ADMIN' ||
    profile?.role === 'ADMIN' ||
    profile?.role === 'MANAGER'

  // Load team summary
  async function loadTeamData() {
    if (!accessToken) return

    setLoadingTeam(true)
    setError('')

    try {
      const { from, to } = getDateRange(timeFilter)
      if (isManagerOrAdmin) {
        const teamData = await getTeamTargetPerformance(accessToken, from, to)
        setTeamPerformance(teamData || [])
        if (!selectedEmployeeId && teamData && teamData.length > 0) {
          setSelectedEmployeeId(teamData[0].employee?.id || null)
        }
      } else if (profile?.id) {
        setSelectedEmployeeId(profile.id)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load team target performance.')
    } finally {
      setLoadingTeam(false)
    }
  }

  // Load individual employee report
  async function loadEmployeeReport(employeeId: string) {
    if (!accessToken || !employeeId) return

    setLoadingEmployee(true)
    setError('')

    try {
      const { from, to } = getDateRange(timeFilter)
      const data = await getEmployeeTargetPerformance(accessToken, employeeId, from, to)
      setEmployeeReport(data)
    } catch (err: any) {
      setError(err.message || 'Failed to load employee target performance.')
    } finally {
      setLoadingEmployee(false)
    }
  }

  useEffect(() => {
    loadTeamData()
  }, [accessToken, timeFilter, isManagerOrAdmin])

  useEffect(() => {
    if (selectedEmployeeId) {
      loadEmployeeReport(selectedEmployeeId)
    }
  }, [accessToken, selectedEmployeeId, timeFilter])

  const selectedEmployeeInfo = useMemo(() => {
    if (!selectedEmployeeId) return null
    const fromTeam = teamPerformance.find((t) => t.employee?.id === selectedEmployeeId)
    if (fromTeam) return fromTeam.employee
    if (profile?.id === selectedEmployeeId) return profile
    return null
  }, [selectedEmployeeId, teamPerformance, profile])

  // Weekly Trend calculation from result history
  const weeklyTrends = useMemo(() => {
    if (!employeeReport?.results || employeeReport.results.length === 0) return []

    const weekBuckets: Record<string, { total: number; sumPct: number; count: number }> = {}

    employeeReport.results.forEach((r: any) => {
      const date = new Date(r.target_date)
      const weekNumber = Math.ceil(date.getDate() / 7)
      const monthName = date.toLocaleString('default', { month: 'short' })
      const key = `${monthName} W${weekNumber}`

      if (!weekBuckets[key]) {
        weekBuckets[key] = { total: 0, sumPct: 0, count: 0 }
      }
      weekBuckets[key].sumPct += Number(r.achievement_percent || 0)
      weekBuckets[key].count++
    })

    return Object.entries(weekBuckets).map(([week, stats]) => ({
      week,
      achievement: Math.round(stats.sumPct / stats.count),
      count: stats.count,
    }))
  }, [employeeReport])

  const filteredTeam = useMemo(() => {
    return teamPerformance.filter((t) => {
      const name = `${t.employee?.first_name || ''} ${t.employee?.last_name || ''}`.toLowerCase()
      const empId = (t.employee?.employee_id || '').toLowerCase()
      const term = search.toLowerCase()
      return name.includes(term) || empId.includes(term)
    })
  }, [teamPerformance, search])

  const summary = employeeReport?.summary || {
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

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* HEADER */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              EMPLOYEE PERFORMANCE
            </h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Causal target execution analytics and objective achievement history.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Time Filter Chips */}
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
                  onClick={() => setTimeFilter(key)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                    timeFilter === key
                      ? 'bg-[#801424] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                loadTeamData()
                if (selectedEmployeeId) loadEmployeeReport(selectedEmployeeId)
              }}
              disabled={loadingTeam || loadingEmployee}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loadingTeam || loadingEmployee ? 'animate-spin' : ''}`}
              />
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* TEAM SELECTOR (FOR MANAGERS & ADMINS) */}
        {isManagerOrAdmin && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
                  TEAM ROSTER ({teamPerformance.length})
                </h2>
              </div>

              <div className="relative min-w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter team member..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 outline-none focus:border-[#801424]"
                />
              </div>
            </div>

            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {filteredTeam.map((item) => {
                const emp = item.employee
                const isSelected = selectedEmployeeId === emp?.id
                return (
                  <button
                    key={emp?.id}
                    onClick={() => setSelectedEmployeeId(emp?.id)}
                    className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2 text-left shrink-0 transition cursor-pointer ${
                      isSelected
                        ? 'border-[#801424] bg-rose-50/50 shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 font-bold text-xs text-slate-700">
                      {emp?.first_name?.slice(0, 2).toUpperCase() || 'EM'}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 leading-tight">
                        {emp?.first_name} {emp?.last_name || ''}
                      </p>
                      <p className="text-[10px] font-semibold text-slate-500">
                        {item.achievement}% achievement · {item.total} targets
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* SELECTED EMPLOYEE DRILLDOWN */}
        {selectedEmployeeInfo && (
          <div className="space-y-6">

            {/* EMPLOYEE SUMMARY CARD */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-slate-100 pb-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#801424] text-white text-xl font-bold shadow-xs">
                    {selectedEmployeeInfo.first_name?.slice(0, 2).toUpperCase() || 'EM'}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">
                      {selectedEmployeeInfo.first_name} {selectedEmployeeInfo.last_name || ''}
                    </h2>
                    <p className="text-xs text-slate-500 font-medium">
                      {selectedEmployeeInfo.employee_id && `ID: ${selectedEmployeeInfo.employee_id} · `}
                      {selectedEmployeeInfo.email || 'Employee'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                    {summary.total} Total Targets
                  </span>
                </div>
              </div>

              {/* Step 138 — 4 Primary Performance Metric Cards */}
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-linear-to-br from-slate-50 to-white p-5 shadow-2xs">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                    Target Achievement
                  </p>
                  <p className="mt-2 text-4xl font-extrabold text-[#801424]">
                    {summary.achievement}%
                  </p>
                  <p className="mt-1 text-xs text-slate-500 font-medium">
                    {summary.completed} completed of {summary.total}
                  </p>
                </div>

                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-2xs">
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 font-mono">
                    On-Time Rate
                  </p>
                  <p className="mt-2 text-4xl font-extrabold text-emerald-800">
                    {summary.onTimePercent}%
                  </p>
                  <p className="mt-1 text-xs text-emerald-600 font-medium">
                    Completed without carry-forward
                  </p>
                </div>

                <div className="rounded-2xl border border-orange-200 bg-orange-50/50 p-5 shadow-2xs">
                  <p className="text-xs font-bold uppercase tracking-wider text-orange-700 font-mono">
                    Carry Forward
                  </p>
                  <p className="mt-2 text-4xl font-extrabold text-orange-800">
                    {carryForwardRate}%
                  </p>
                  <p className="mt-1 text-xs text-orange-600 font-medium">
                    {summary.carryForward} carried forward
                  </p>
                </div>

                <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-5 shadow-2xs">
                  <p className="text-xs font-bold uppercase tracking-wider text-rose-700 font-mono">
                    Missed Rate
                  </p>
                  <p className="mt-2 text-4xl font-extrabold text-rose-800">
                    {missedRate}%
                  </p>
                  <p className="mt-1 text-xs text-rose-600 font-medium">
                    {summary.missed} targets missed (0 completed)
                  </p>
                </div>
              </div>
            </div>

            {/* Step 139 — Important Fairness Rule Banner */}
            <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 shadow-2xs flex items-start gap-3.5 text-blue-900">
              <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-bold text-blue-950 text-sm">
                  Fair Performance Evaluation: Execution vs. Cause
                </p>
                <p className="text-blue-800 leading-relaxed">
                  Lower target achievement is not automatically an employee execution shortfall. Targets blocked by client feedback, external approvals, or technical outages are attributed directly in the reason breakdown below.
                </p>
              </div>
            </div>

            {/* 2-COLUMN SECTION: TARGET HISTORY & REASON BREAKDOWN */}
            <div className="grid gap-6 lg:grid-cols-12">

              {/* LEFT: TARGET HISTORY (Step 138) */}
              <div className="lg:col-span-7 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                    TARGET HISTORY
                  </h3>
                  <span className="text-xs font-medium text-slate-500">
                    {employeeReport?.results?.length || 0} recorded daily results
                  </span>
                </div>

                {loadingEmployee ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-400 text-sm">
                    Loading historical results...
                  </div>
                ) : !employeeReport?.results || employeeReport.results.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-slate-500 text-sm">
                    No target results recorded for this date range.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {employeeReport.results.map((res: any) => {
                      const achievementPct = Number(res.achievement_percent || 0)
                      return (
                        <div
                          key={res.id || `${res.target_id}_${res.target_date}`}
                          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-slate-300 transition"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-400 font-mono">
                                {new Date(res.target_date).toLocaleDateString('en-US', {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </p>

                              <h4 className="mt-0.5 font-bold text-slate-900 text-sm">
                                {res.target_value} {res.unit} targeted
                              </h4>

                              <p className="mt-1 text-xs text-slate-500">
                                {res.projects?.name || 'General Project'}
                                {res.project_modules?.name && ` · ${res.project_modules.name}`}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <HealthBadge health={res.health || 'GREEN'} />

                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                                  res.status === 'COMPLETED'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : res.status === 'PARTIAL'
                                    ? 'bg-orange-50 text-orange-700 border border-orange-200'
                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                                }`}
                              >
                                {res.status}
                              </span>
                            </div>
                          </div>

                          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-800">
                                {res.actual_value} / {res.target_value} {res.unit}
                              </span>
                              <span className="text-slate-400">·</span>
                              <span className="font-extrabold text-[#801424]">
                                {achievementPct}%
                              </span>
                            </div>

                            {res.result_reason && (
                              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                                {REASON_LABELS[res.result_reason] || res.result_reason}
                              </span>
                            )}
                          </div>

                          {res.result_note && (
                            <p className="mt-2 text-xs text-slate-600 bg-slate-50 rounded-lg p-2 italic border border-slate-100">
                              "{res.result_note}"
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* RIGHT: REASONS & TREND (Step 138) */}
              <div className="lg:col-span-5 space-y-6">

                {/* REASONS FOR MISSED / PARTIAL */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                      REASONS FOR MISSED / PARTIAL
                    </h3>
                  </div>

                  {!employeeReport?.reasonCounts ||
                  Object.keys(employeeReport.reasonCounts).length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-4 text-center">
                      No delay or missed reasons recorded.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {Object.entries(employeeReport.reasonCounts)
                        .sort(([, a], [, b]) => (b as number) - (a as number))
                        .map(([reason, count]) => {
                          const label = REASON_LABELS[reason] || reason.replaceAll('_', ' ')
                          return (
                            <div key={reason} className="space-y-1.5">
                              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                                <span>{label}</span>
                                <span className="font-bold text-slate-900">{count as number}</span>
                              </div>
                              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
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
                            </div>
                          )
                        })}
                    </div>
                  )}
                </div>

                {/* TREND (Step 138) */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                      ACHIEVEMENT TREND
                    </h3>
                    <TrendingUp className="h-4 w-4 text-slate-400" />
                  </div>

                  {weeklyTrends.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-4 text-center">
                      Insufficient trend history.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {weeklyTrends.map((t) => (
                        <div key={t.week} className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-600">{t.week}</span>
                          <div className="flex items-center gap-3">
                            <div className="w-24 h-2 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-[#801424]"
                                style={{ width: `${t.achievement}%` }}
                              />
                            </div>
                            <span className="font-bold text-slate-900 w-8 text-right">
                              {t.achievement}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

            </div>

          </div>
        )}

      </div>
    </div>
  )
}
