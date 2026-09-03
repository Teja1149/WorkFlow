import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Award,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  FolderKanban,
  HelpCircle,
  Info,
  Layers,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'

import { useAuth } from '../features/auth/AuthContext'
import { getCompanyTargetSummary } from '../features/daily-targets/daily-target.service'
import MetricCard from '../components/ui/MetricCard'
import HealthBadge from '../components/ui/HealthBadge'

type PresetRange = 'TODAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'THIS_MONTH' | 'ALL'

function getPresetDates(preset: PresetRange) {
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]

  if (preset === 'TODAY') {
    return { from: todayStr, to: todayStr }
  }

  if (preset === 'LAST_7_DAYS') {
    const d = new Date(now)
    d.setDate(now.getDate() - 7)
    return { from: d.toISOString().split('T')[0], to: todayStr }
  }

  if (preset === 'LAST_30_DAYS') {
    const d = new Date(now)
    d.setDate(now.getDate() - 30)
    return { from: d.toISOString().split('T')[0], to: todayStr }
  }

  if (preset === 'THIS_MONTH') {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    return { from: firstDay.toISOString().split('T')[0], to: todayStr }
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

export default function CompanyTargetAnalytics() {
  const { accessToken } = useAuth()
  const navigate = useNavigate()

  const [preset, setPreset] = useState<PresetRange>('LAST_30_DAYS')
  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [projectSearch, setProjectSearch] = useState('')
  const [employeeSearch, setEmployeeSearch] = useState('')

  async function load() {
    if (!accessToken) return

    setLoading(true)
    setError('')

    try {
      const { from, to } = getPresetDates(preset)
      const res = await getCompanyTargetSummary(accessToken, from, to)
      setData(res)
    } catch (err: any) {
      setError(err.message || 'Failed to load company target analytics.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [accessToken, preset])

  const summary = data?.summary || {
    total: 0,
    completed: 0,
    partial: 0,
    missed: 0,
    carriedForward: 0,
    targetValue: 0,
    actualValue: 0,
    achievement: 0,
    onTimePercent: 0,
  }

  const filteredProjects = useMemo(() => {
    if (!data?.projects) return []
    return data.projects.filter((p: any) =>
      p.name.toLowerCase().includes(projectSearch.toLowerCase()),
    )
  }, [data?.projects, projectSearch])

  const filteredEmployees = useMemo(() => {
    if (!data?.employees) return []
    return data.employees.filter((emp: any) => {
      const name = `${emp.employee?.first_name || ''} ${emp.employee?.last_name || ''}`.toLowerCase()
      const empId = (emp.employee?.employee_id || '').toLowerCase()
      const term = employeeSearch.toLowerCase()
      return name.includes(term) || empId.includes(term)
    })
  }, [data?.employees, employeeSearch])

  const carryForwardRate =
    summary.total === 0 ? 0 : Math.round((summary.carriedForward / summary.total) * 100)
  const missedRate =
    summary.total === 0 ? 0 : Math.round((summary.missed / summary.total) * 100)

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-8">

        {/* HEADER & CONTROLS */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
              HISTORICAL VELOCITY & OUTCOMES
            </span>
            <h1 className="mt-0.5 text-3xl font-extrabold text-slate-900 tracking-tight">
              COMPANY TARGET ANALYTICS
            </h1>
            <p className="mt-1 text-sm text-slate-500 font-medium">
              Objective planned vs. achieved outcomes, causal delays, and cross-functional performance.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Date Preset Chips (Step 149) */}
            <div className="inline-flex rounded-xl bg-white p-1 border border-slate-200 shadow-2xs">
              {(
                [
                  ['TODAY', 'Today'],
                  ['LAST_7_DAYS', 'Last 7 Days'],
                  ['LAST_30_DAYS', 'Last 30 Days'],
                  ['THIS_MONTH', 'This Month'],
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
              onClick={() => navigate('/company-operations')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs cursor-pointer"
            >
              <Zap size={14} className="text-slate-500" />
              Live Operations
            </button>

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
          <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-6 text-xs text-rose-900 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-black text-rose-900">
                Unable to load target analytics.
              </h3>
              <p className="text-xs text-rose-700 font-medium">
                The analytics data could not be loaded. Please try again.
              </p>
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#801424] hover:bg-[#9f1239] text-white text-xs font-bold transition shadow-xs cursor-pointer shrink-0 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* 1. OVERALL KPIS (Step 145) */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
              TARGET EXECUTION SUMMARY
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
            <MetricCard label="Targets Planned" value={summary.total} />
            <MetricCard label="Completed" value={summary.completed} />
            <MetricCard label="Partial" value={summary.partial} />
            <MetricCard label="Missed" value={summary.missed} />
            <MetricCard label="Carried Forward" value={`${summary.carriedForward} (${carryForwardRate}%)`} />
            <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5 shadow-2xs">
              <span className="text-xs font-bold uppercase text-blue-700 font-mono">On-Time Rate</span>
              <p className="mt-2 text-3xl font-extrabold text-blue-900">{summary.onTimePercent}%</p>
            </div>
            <div className="rounded-2xl border border-[#801424]/20 bg-rose-50/50 p-5 shadow-2xs">
              <span className="text-xs font-bold uppercase text-[#801424] font-mono">Achievement</span>
              <p className="mt-2 text-3xl font-extrabold text-[#801424]">{summary.achievement}%</p>
            </div>
          </div>
        </section>

        {/* 2. DAILY TREND & CAUSAL REASONS (Step 145) */}
        <div className="grid gap-6 lg:grid-cols-12">

          {/* DAILY TREND (Step 145) */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                DAILY ACHIEVEMENT TREND
              </h2>
              <span className="text-xs text-slate-400 font-medium">
                {data?.daily?.length || 0} active days recorded
              </span>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              {loading ? (
                <div className="py-12 text-center text-slate-400 text-sm">
                  Loading daily trends...
                </div>
              ) : !data?.daily || data.daily.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm italic">
                  No execution activity recorded for this period.
                </div>
              ) : (
                <div className="space-y-3">
                  {data.daily.map((day: any) => (
                    <div
                      key={day.date}
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition text-xs"
                    >
                      <div className="min-w-28">
                        <span className="font-bold text-slate-900">
                          {new Date(day.date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                        <p className="text-[11px] text-slate-500 font-medium">
                          {day.completed} / {day.targets} targets completed
                        </p>
                      </div>

                      <div className="flex items-center gap-4 flex-1 max-w-xs mx-4">
                        <div className="flex-1 h-2.5 rounded-full bg-slate-200/80 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#801424]"
                            style={{ width: `${day.achievement}%` }}
                          />
                        </div>
                        <span className="font-extrabold text-[#801424] w-10 text-right">
                          {day.achievement}%
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-[11px]">
                        {day.partial > 0 && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 font-bold text-amber-800">
                            {day.partial} partial
                          </span>
                        )}
                        {day.missed > 0 && (
                          <span className="rounded bg-rose-100 px-1.5 py-0.5 font-bold text-rose-800">
                            {day.missed} missed
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* CAUSAL REASONS BREAKDOWN (Step 145) */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                WHY TARGETS WERE MISSED
              </h2>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              {!data?.reasonCounts || Object.keys(data.reasonCounts).length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm italic">
                  All targets completed on time! No delays recorded.
                </div>
              ) : (
                <div className="space-y-3">
                  {Object.entries(data.reasonCounts)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .map(([reason, count]) => {
                      const label = REASON_LABELS[reason] || reason.replaceAll('_', ' ')
                      const countNum = count as number
                      const pct = Math.round((countNum / (summary.total || 1)) * 100)
                      return (
                        <div key={reason} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                            <span>{label}</span>
                            <span className="font-bold text-slate-900">{countNum} target(s) ({pct}%)</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-orange-600"
                              style={{ width: `${Math.min(100, pct * 2)}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* 3. WORK TYPE PERFORMANCE (Step 146) */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                WORK TYPE PERFORMANCE
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Normalized percentage achievement comparison across diverse units and departments.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {!data?.workTypes || data.workTypes.length === 0 ? (
              <p className="col-span-full py-8 text-center text-slate-400 text-sm italic">
                No work type performance recorded.
              </p>
            ) : (
              data.workTypes.map((wt: any) => (
                <div
                  key={wt.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-sm">
                      {wt.name}
                    </span>
                    <span className="font-extrabold text-[#801424] text-base">
                      {wt.achievement}%
                    </span>
                  </div>

                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#801424]"
                      style={{ width: `${wt.achievement}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-1 pt-2 border-t border-slate-100 text-center text-[11px]">
                    <div className="bg-slate-50 p-1.5 rounded-lg">
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">Planned</span>
                      <span className="font-bold text-slate-900">{wt.total}</span>
                    </div>
                    <div className="bg-emerald-50 p-1.5 rounded-lg text-emerald-900">
                      <span className="text-emerald-700 block text-[9px] uppercase font-bold">Done</span>
                      <span className="font-bold">{wt.completed}</span>
                    </div>
                    <div className="bg-amber-50 p-1.5 rounded-lg text-amber-900">
                      <span className="text-amber-700 block text-[9px] uppercase font-bold">Partial</span>
                      <span className="font-bold">{wt.partial}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* 4. PROJECT PERFORMANCE (Step 150) */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden space-y-0">
          <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                PROJECT PERFORMANCE
              </h2>
              <p className="text-xs text-slate-500">
                Which projects are executing effectively and hitting daily target milestones.
              </p>
            </div>

            <div className="relative min-w-60">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Filter project name..."
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 outline-none focus:border-[#801424]"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="py-3 px-6">Project</th>
                  <th className="py-3 px-4 text-center">Targets</th>
                  <th className="py-3 px-4 text-center">Achievement</th>
                  <th className="py-3 px-4 text-center">On-Time %</th>
                  <th className="py-3 px-4 text-center">Carry Forward</th>
                  <th className="py-3 px-4 text-center">Health</th>
                  <th className="py-3 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredProjects.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                      No project target history matches your search.
                    </td>
                  </tr>
                ) : (
                  filteredProjects.map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-6 font-bold text-slate-900">
                        {p.name}
                      </td>
                      <td className="py-3.5 px-4 text-center font-semibold">
                        {p.total}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-extrabold text-[#801424] text-sm">
                          {p.achievement}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-blue-700">
                        {p.onTimeRate}%
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`font-semibold ${
                            p.carryForwardRate > 15 ? 'text-orange-700 font-bold' : 'text-slate-600'
                          }`}
                        >
                          {p.carryForwardRate}% ({p.carryForward})
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <HealthBadge health={p.health || 'GREEN'} />
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        {p.id !== 'unassigned' ? (
                          <Link
                            to={`/projects/${p.id}`}
                            className="inline-flex items-center gap-1 font-bold text-[#801424] hover:underline"
                          >
                            Details <ArrowRight size={12} />
                          </Link>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* 5. TEAM PERFORMANCE (Steps 147 & 148) */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden space-y-0">
          <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                TEAM PERFORMANCE
              </h2>
              <p className="text-xs text-slate-500">
                Operational throughput, delivery velocity, and carry-forward metrics by team member.
              </p>
            </div>

            <div className="relative min-w-60">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Filter employee..."
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 outline-none focus:border-[#801424]"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="py-3 px-6">Employee</th>
                  <th className="py-3 px-4 text-center">Targets</th>
                  <th className="py-3 px-4 text-center">Achievement</th>
                  <th className="py-3 px-4 text-center">On-Time Rate</th>
                  <th className="py-3 px-4 text-center">Carry Forward</th>
                  <th className="py-3 px-4 text-center">Missed</th>
                  <th className="py-3 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                      No team members match your filter.
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp: any) => (
                    <tr
                      key={emp.employee?.id || Math.random()}
                      className="hover:bg-slate-50/80 transition cursor-pointer"
                      onClick={() => {
                        if (emp.employee?.id) {
                          navigate('/employee-performance')
                        }
                      }}
                    >
                      <td className="py-3.5 px-6">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-700 font-bold text-xs">
                            {emp.employee?.first_name?.slice(0, 2).toUpperCase() || 'EM'}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">
                              {emp.employee?.first_name} {emp.employee?.last_name || ''}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              {emp.employee?.employee_id || emp.employee?.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-900">
                        {emp.total}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-extrabold text-[#801424] text-sm">
                          {emp.achievement}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-blue-700">
                        {emp.onTimeRate}%
                      </td>
                      <td className="py-3.5 px-4 text-center font-semibold text-orange-700">
                        {emp.carryForwardRate}% ({emp.carryForward})
                      </td>
                      <td className="py-3.5 px-4 text-center font-semibold text-rose-700">
                        {emp.missedRate}% ({emp.missed})
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <span className="inline-flex items-center gap-1 font-bold text-[#801424] hover:underline">
                          View Performance <ArrowRight size={12} />
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </div>
  )
}
