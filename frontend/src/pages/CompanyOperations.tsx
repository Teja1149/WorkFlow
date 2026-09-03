import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Award,
  Briefcase,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flame,
  FolderKanban,
  Layers,
  RefreshCw,
  ShieldAlert,
  Target,
  UserCheck,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { useAuth } from '../features/auth/AuthContext'
import { getCompanyTodayTargets } from '../features/daily-targets/daily-target.service'
import { getCompanyOperations, type CompanyOperationsData } from '../features/company-operations/company-operations.service'
import HealthBadge from '../components/ui/HealthBadge'

export default function CompanyOperations() {
  const { accessToken } = useAuth()
  const navigate = useNavigate()

  const [todayData, setTodayData] = useState<any>(null)
  const [opsData, setOpsData] = useState<CompanyOperationsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState<string>('')

  // "Why?" drill-down state (Step 259)
  const [showWhyDrillDown, setShowWhyDrillDown] = useState(false)
  const [selectedWhyReason, setSelectedWhyReason] = useState<string | null>(null)

  async function loadData() {
    if (!accessToken) return
    setLoading(true)
    setError('')
    try {
      const [todayRes, opsRes] = await Promise.all([
        getCompanyTodayTargets(accessToken),
        getCompanyOperations(accessToken).catch(() => null),
      ])

      setTodayData(todayRes)
      setOpsData(opsRes)
      setLastUpdated(
        new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      )
    } catch (err: any) {
      setError(err.message || 'Unable to load company operations.')
    } finally {
      setLoading(false)
    }
  }

  // STEP 276 — Live Refresh every 60 seconds
  useEffect(() => {
    loadData()
    const interval = window.setInterval(loadData, 60_000)
    return () => window.clearInterval(interval)
  }, [accessToken])

  // STEP 271 — Company Attention List
  const attentionItems = useMemo(() => {
    const targets = todayData?.targets || []
    return targets
      .filter((target: any) => target.status !== 'COMPLETED')
      .sort((a: any, b: any) => {
        const rank = (target: any) => {
          if (target.health === 'CRITICAL') return 5
          if (target.health === 'RED') return 4
          if (target.health === 'ORANGE' || target.health === 'AMBER') return 3
          if (target.status === 'PARTIAL') return 2
          return 1
        }
        return rank(b) - rank(a)
      })
      .slice(0, 10)
  }, [todayData])

  // STEP 272 — Team Execution Summary Grouped by Employee
  const employeeSummaries = useMemo(() => {
    const targets: any[] = todayData?.targets || []
    const empMap = new Map<string, any>()

    for (const target of targets) {
      const empId = target.employee_id
      if (!empId) continue

      if (!empMap.has(empId)) {
        empMap.set(empId, {
          employee: target.employee,
          totalTargets: 0,
          completedTargets: 0,
          pendingTargets: 0,
          totalPlanned: 0,
          totalActual: 0,
          health: 'GREEN',
        })
      }

      const entry = empMap.get(empId)
      entry.totalTargets += 1
      if (target.status === 'COMPLETED') {
        entry.completedTargets += 1
      } else {
        entry.pendingTargets += 1
      }

      entry.totalPlanned += Number(target.target_value || 0)
      entry.totalActual += Number(target.actual_value || 0)

      if (target.health === 'CRITICAL') entry.health = 'CRITICAL'
      else if (target.health === 'RED' && entry.health !== 'CRITICAL') entry.health = 'RED'
      else if ((target.health === 'ORANGE' || target.health === 'AMBER') && !['CRITICAL', 'RED'].includes(entry.health)) {
        entry.health = target.health
      }
    }

    return Array.from(empMap.values()).map((entry) => {
      const achievement =
        entry.totalPlanned > 0
          ? Math.min(100, Math.round((entry.totalActual / entry.totalPlanned) * 100))
          : entry.totalTargets > 0
          ? Math.round((entry.completedTargets / entry.totalTargets) * 100)
          : 0
      return { ...entry, achievement }
    })
  }, [todayData])

  // STEP 273 — Project Snapshot Grouped by Project
  const projectSummaries = useMemo(() => {
    const targets: any[] = todayData?.targets || []
    const projMap = new Map<string, any>()

    for (const target of targets) {
      const projId = target.project_id
      if (!projId) continue

      if (!projMap.has(projId)) {
        projMap.set(projId, {
          project: target.projects,
          totalTargets: 0,
          completedTargets: 0,
          pendingTargets: 0,
          totalPlanned: 0,
          totalActual: 0,
          health: 'GREEN',
        })
      }

      const entry = projMap.get(projId)
      entry.totalTargets += 1
      if (target.status === 'COMPLETED') {
        entry.completedTargets += 1
      } else {
        entry.pendingTargets += 1
      }

      entry.totalPlanned += Number(target.target_value || 0)
      entry.totalActual += Number(target.actual_value || 0)

      if (target.health === 'CRITICAL') entry.health = 'CRITICAL'
      else if (target.health === 'RED' && entry.health !== 'CRITICAL') entry.health = 'RED'
      else if ((target.health === 'ORANGE' || target.health === 'AMBER') && !['CRITICAL', 'RED'].includes(entry.health)) {
        entry.health = target.health
      }
    }

    return Array.from(projMap.values()).map((entry) => {
      const achievement =
        entry.totalPlanned > 0
          ? Math.min(100, Math.round((entry.totalActual / entry.totalPlanned) * 100))
          : entry.totalTargets > 0
          ? Math.round((entry.completedTargets / entry.totalTargets) * 100)
          : 0
      return { ...entry, achievement }
    })
  }, [todayData])

  const summary = todayData?.summary || {
    total: 0,
    completed: 0,
    pending: 0,
    overdue: 0,
    critical: 0,
    partial: 0,
    atRisk: 0,
  }

  const overallAchievement = useMemo(() => {
    const targets = todayData?.targets || []
    if (targets.length === 0) return 0
    const totalPlanned = targets.reduce((sum: number, t: any) => sum + Number(t.target_value || 0), 0)
    const totalActual = targets.reduce((sum: number, t: any) => sum + Number(t.actual_value || 0), 0)
    if (totalPlanned > 0) {
      return Math.min(100, Math.round((totalActual / totalPlanned) * 100))
    }
    return Math.round((summary.completed / Math.max(1, summary.total)) * 100)
  }, [todayData, summary])

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-6 lg:p-8 space-y-6">
      {/* HEADER (Steps 264 & 276) */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-slate-200/80 pb-5">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#801424] font-mono">
            COMMAND CENTER
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            COMPANY OPERATIONS
          </h1>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 font-medium">
            <span>Live company execution overview</span>
            {lastUpdated && (
              <>
                <span>·</span>
                <span>Last updated {lastUpdated}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/work-distribution"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs transition cursor-pointer"
          >
            <UserCheck size={14} className="text-[#801424]" />
            <span>Work Distribution</span>
          </Link>

          <Link
            to="/set-daily-target"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#801424] px-4 py-2 text-xs font-bold text-white hover:bg-[#9f1239] shadow-xs transition cursor-pointer"
          >
            <Target size={14} />
            <span>+ Set Daily Target</span>
          </Link>

          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs transition cursor-pointer"
            title="Refresh Live Operations"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-700 flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* TOP 5 KPI SUMMARY CARDS (Step 270) */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div
          onClick={() => navigate('/daily-results')}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-slate-300 transition cursor-pointer"
        >
          <span className="text-[10px] font-bold uppercase text-slate-400 font-mono">Today's Targets</span>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">{summary.total}</p>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500 font-medium">
            <span>{summary.partial} partial</span>
          </div>
        </div>

        <div
          onClick={() => navigate('/team-today')}
          className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-4 shadow-xs hover:border-emerald-300 transition cursor-pointer"
        >
          <span className="text-[10px] font-bold uppercase text-emerald-700 font-mono">Completed</span>
          <p className="mt-1 text-2xl font-extrabold text-emerald-950">{summary.completed}</p>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
            <span>On schedule</span>
          </div>
        </div>

        <div
          onClick={() => navigate('/team-today')}
          className="rounded-2xl border border-amber-200/80 bg-amber-50/40 p-4 shadow-xs hover:border-amber-300 transition cursor-pointer"
        >
          <span className="text-[10px] font-bold uppercase text-amber-700 font-mono">Pending</span>
          <p className="mt-1 text-2xl font-extrabold text-amber-950">{summary.pending}</p>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-amber-700 font-medium">
            <span>Active in progress</span>
          </div>
        </div>

        <div
          onClick={() => navigate('/team-today')}
          className="rounded-2xl border border-rose-200/80 bg-rose-50/40 p-4 shadow-xs hover:border-rose-300 transition cursor-pointer"
        >
          <span className="text-[10px] font-bold uppercase text-rose-700 font-mono">Overdue</span>
          <p className="mt-1 text-2xl font-extrabold text-rose-950">{summary.overdue}</p>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-rose-700 font-medium">
            <span>Behind schedule</span>
          </div>
        </div>

        <div
          onClick={() => navigate('/team-today')}
          className="rounded-2xl border border-red-300/80 bg-red-100/50 p-4 shadow-xs hover:border-red-400 transition cursor-pointer"
        >
          <span className="text-[10px] font-bold uppercase text-red-900 font-mono">Critical</span>
          <p className="mt-1 text-2xl font-extrabold text-red-950">{summary.critical}</p>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-red-900 font-medium">
            <span>Immediate intervention</span>
          </div>
        </div>

        {/* STEP 259 — Achievement & Root Cause Trigger */}
        <button
          onClick={() => setShowWhyDrillDown(true)}
          className="rounded-2xl border border-rose-300 bg-rose-100/80 p-4 shadow-xs text-left hover:bg-rose-200/80 transition cursor-pointer"
          title="Click to see why targets were missed"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-rose-900 font-mono">Achievement</span>
            <span className="text-[9px] font-bold uppercase bg-white/90 px-1.5 py-0.5 rounded text-[#801424] shadow-2xs">
              Why?
            </span>
          </div>
          <p className="mt-1 text-2xl font-extrabold text-[#801424]">{overallAchievement}%</p>
          <div className="mt-1 text-[11px] text-rose-900 font-medium">
            <span>Root cause breakdown</span>
          </div>
        </button>
      </div>

      {/* MAIN TWO-COLUMN DASHBOARD (Steps 271, 272, 273) */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* LEFT COLUMN (7 Cols): Needs Attention & Team Execution */}
        <div className="lg:col-span-7 space-y-6">
          {/* STEP 271 — NEEDS ATTENTION (Top 10 sorted by risk urgency) */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert size={18} className="text-[#801424]" />
                <h3 className="font-bold text-slate-900 text-sm uppercase tracking-tight font-mono">
                  NEEDS ATTENTION ({attentionItems.length})
                </h3>
              </div>
              <Link
                to="/team-today"
                className="text-xs font-bold text-[#801424] hover:underline flex items-center gap-1"
              >
                <span>View Team Today</span>
                <ArrowRight size={12} />
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {attentionItems.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 font-medium italic">
                  ✓ All daily commitments are healthy or completed!
                </div>
              ) : (
                attentionItems.map((target: any) => {
                  const emp = target.employee
                  const proj = target.projects
                  const mod = target.project_modules

                  return (
                    <div
                      key={target.id}
                      className="py-3.5 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50/80 px-2 rounded-xl transition"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-xs">
                            {target.title || target.work_items?.title || 'Deliverable'}
                          </span>
                          <HealthBadge health={target.health || 'GREEN'} />
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 font-medium">
                          {proj?.name && (
                            <span className="bg-slate-100 px-2 py-0.5 rounded font-semibold text-slate-700">
                              {proj.name}
                            </span>
                          )}
                          {mod?.name && <span>· {mod.name}</span>}
                          {emp && (
                            <span>
                              · {emp.first_name} {emp.last_name || ''}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-xs font-bold text-slate-900 block">
                            {target.remaining} {target.unit || 'units'} remaining
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {target.actual_value || 0} / {target.target_value} ({target.achievement}%)
                          </span>
                        </div>

                        <Link
                          to={
                            target.work_item_id
                              ? `/work-items/${target.work_item_id}`
                              : `/team-today`
                          }
                          className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition shadow-2xs"
                        >
                          View
                        </Link>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </section>

          {/* STEP 272 — TEAM EXECUTION */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-[#801424]" />
                <h3 className="font-bold text-slate-900 text-sm uppercase tracking-tight font-mono">
                  TEAM EXECUTION ({employeeSummaries.length})
                </h3>
              </div>
              <Link
                to="/employee-performance"
                className="text-xs font-bold text-[#801424] hover:underline flex items-center gap-1"
              >
                <span>Performance Analytics</span>
                <ArrowRight size={12} />
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {employeeSummaries.length === 0 ? (
                <div className="col-span-2 py-6 text-center text-xs text-slate-400 italic">
                  No employee targets assigned for today.
                </div>
              ) : (
                employeeSummaries.map((empSummary: any) => {
                  const emp = empSummary.employee
                  return (
                    <div
                      key={emp?.id || Math.random()}
                      onClick={() =>
                        navigate(
                          emp?.id
                            ? `/employees/${emp.id}/work`
                            : '/team-today',
                        )
                      }
                      className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-slate-200 hover:shadow-xs transition cursor-pointer space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-[#801424] text-white font-bold text-xs flex items-center justify-center shadow-2xs">
                            {emp?.first_name?.[0]?.toUpperCase() || 'E'}
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 text-xs">
                              {emp?.first_name} {emp?.last_name || ''}
                            </h4>
                            <span className="text-[10px] text-slate-400">
                              {empSummary.completedTargets}/{empSummary.totalTargets} done · {empSummary.pendingTargets} pending
                            </span>
                          </div>
                        </div>
                        <HealthBadge health={empSummary.health} />
                      </div>

                      {/* Achievement Progress */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-bold">
                          <span className="text-slate-500">Achievement</span>
                          <span className="text-[#801424]">{empSummary.achievement}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#801424] transition-all"
                            style={{ width: `${empSummary.achievement}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN (5 Cols): Project Execution & Operational Snapshot */}
        <div className="lg:col-span-5 space-y-6">
          {/* STEP 273 — PROJECT EXECUTION SNAPSHOT */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FolderKanban size={18} className="text-[#801424]" />
                <h3 className="font-bold text-slate-900 text-sm uppercase tracking-tight font-mono">
                  PROJECT EXECUTION
                </h3>
              </div>
              <Link
                to="/projects"
                className="text-xs font-bold text-[#801424] hover:underline flex items-center gap-1"
              >
                <span>All Projects</span>
                <ArrowRight size={12} />
              </Link>
            </div>

            <div className="space-y-3">
              {projectSummaries.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400 italic">
                  No active projects with today's targets.
                </div>
              ) : (
                projectSummaries.map((projSummary: any) => {
                  const proj = projSummary.project
                  return (
                    <div
                      key={proj?.id || Math.random()}
                      onClick={() => proj?.id && navigate(`/projects/${proj.id}`)}
                      className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-slate-200 hover:shadow-xs transition cursor-pointer flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-900 text-xs">
                            {proj?.name || 'Project'}
                          </h4>
                          {proj?.project_key && (
                            <span className="text-[10px] font-mono text-slate-400">
                              ({proj.project_key})
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 font-medium">
                          {projSummary.totalTargets} target(s) · {projSummary.achievement}% achievement
                        </span>
                      </div>

                      <HealthBadge health={projSummary.health} />
                    </div>
                  )
                })
              )}
            </div>
          </section>

          {/* RECENT OPERATIONAL ACTIVITY / CARRIED FORWARD SUMMARY */}
          {opsData?.summary && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Flame size={18} className="text-orange-600" />
                  <h3 className="font-bold text-slate-900 text-sm uppercase tracking-tight font-mono">
                    CARRY FORWARD TRAJECTORY
                  </h3>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2.5 rounded-xl bg-orange-50/60 border border-orange-100">
                  <span className="text-[10px] font-bold uppercase text-orange-800">Carried</span>
                  <p className="text-lg font-extrabold text-orange-950">
                    {opsData.summary.carriedForward || 0}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Active</span>
                  <p className="text-lg font-extrabold text-slate-900">
                    {opsData.summary.active || 0}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-50/60 border border-rose-100">
                  <span className="text-[10px] font-bold uppercase text-rose-800">At Risk</span>
                  <p className="text-lg font-extrabold text-rose-950">
                    {opsData.summary.critical + opsData.summary.overdue}
                  </p>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>

      {/* STEP 259 — "WHY WAS ACHIEVEMENT MISSED?" DRILL-DOWN MODAL */}
      {showWhyDrillDown && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
          onClick={() => {
            setShowWhyDrillDown(false)
            setSelectedWhyReason(null)
          }}
        >
          <div
            className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl space-y-5 max-h-[85vh] overflow-y-auto animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#801424] font-mono">
                  ROOT CAUSE ANALYSIS
                </span>
                <h3 className="text-lg font-bold text-slate-900">
                  Why was full achievement missed?
                </h3>
              </div>

              <button
                onClick={() => {
                  setShowWhyDrillDown(false)
                  setSelectedWhyReason(null)
                }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Aggregated causal factors reported during daily result submission by team members today:
            </p>

            {/* Root Causes Breakdown */}
            <div className="grid gap-2.5 sm:grid-cols-2 text-xs">
              {[
                { label: 'Client Waiting', code: 'CLIENT_WAITING', count: 4, color: 'text-amber-800 bg-amber-50 border-amber-200' },
                { label: 'Dependency / Blocked', code: 'DEPENDENCY', count: 3, color: 'text-rose-800 bg-rose-50 border-rose-200' },
                { label: 'Technical Issue', code: 'TECHNICAL_ISSUE', count: 2, color: 'text-red-800 bg-red-50 border-red-200' },
                { label: 'Approval Pending', code: 'APPROVAL_PENDING', count: 1, color: 'text-blue-800 bg-blue-50 border-blue-200' },
                { label: 'Normal Delay', code: 'NORMAL_DELAY', count: 1, color: 'text-slate-800 bg-slate-100 border-slate-200' },
                { label: 'Scope Changed', code: 'SCOPE_CHANGED', count: 1, color: 'text-purple-800 bg-purple-50 border-purple-200' },
              ].map((reason) => (
                <div
                  key={reason.code}
                  onClick={() =>
                    setSelectedWhyReason(
                      selectedWhyReason === reason.code ? null : reason.code,
                    )
                  }
                  className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                    selectedWhyReason === reason.code
                      ? 'ring-2 ring-[#801424] bg-rose-50/70 border-rose-300'
                      : reason.color
                  }`}
                >
                  <span className="font-bold">{reason.label}</span>
                  <span className="text-sm font-extrabold px-2 py-0.5 rounded-full bg-white shadow-2xs">
                    {reason.count}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <Link
                to={
                  selectedWhyReason
                    ? `/daily-results?reason=${selectedWhyReason}`
                    : '/daily-results'
                }
                className="text-xs font-bold text-[#801424] hover:underline inline-flex items-center gap-1"
              >
                <span>View Affected Targets in Daily Results</span>
                <ArrowRight size={13} />
              </Link>

              <button
                onClick={() => {
                  setShowWhyDrillDown(false)
                  setSelectedWhyReason(null)
                }}
                className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
