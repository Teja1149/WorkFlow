import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FolderKanban,
  CheckSquare,
  Clock,
  Calendar,
  ArrowRight,
  User,
  Briefcase,
  AlertCircle,
  AlertTriangle,
  RotateCw,
  Zap,
} from 'lucide-react'
import { useAuth } from '../features/auth/AuthContext'
import { getLiveOverview, type LiveOverviewData } from '../features/dashboard/dashboard.service'
import { supabase } from '../lib/supabase'

export type LiveStatus = 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED'

export default function Dashboard() {
  const { profile, accessToken } = useAuth()
  const navigate = useNavigate()

  // Realtime & Connection Status
  const [liveStatus, setLiveStatus] = useState<LiveStatus>('CONNECTED')
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [secondsAgo, setSecondsAgo] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [liveData, setLiveData] = useState<LiveOverviewData | null>(null)

  // Fetch canonical live overview from the backend
  const loadDashboardData = useCallback(async (isSilent = false) => {
    if (!accessToken) return
    if (!isSilent && !liveData) setLoading(true)
    else setRefreshing(true)

    try {
      const data = await getLiveOverview(accessToken)
      if (data) {
        setLiveData(data)
        setLastUpdated(new Date())
        setSecondsAgo(0)
        setLiveStatus('CONNECTED')
      }
    } catch (err) {
      console.error('[WorkOverview] Failed to load canonical overview:', err)
      setLiveStatus('RECONNECTING')
      // Do NOT wipe out existing data on network/API failure!
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [accessToken, liveData])

  // Initial Load
  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  // Freshness Tick Timer (every second)
  useEffect(() => {
    const timer = setInterval(() => {
      const diffSec = Math.floor((Date.now() - lastUpdated.getTime()) / 1000)
      setSecondsAgo(Math.max(0, diffSec))

      if (diffSec > 90 && liveStatus === 'CONNECTED') {
        setLiveStatus('RECONNECTING')
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [lastUpdated, liveStatus])

  // Fallback Polling (Safety net every 30 seconds)
  useEffect(() => {
    const safetyNet = setInterval(() => {
      loadDashboardData(true)
    }, 30000)

    return () => clearInterval(safetyNet)
  }, [loadDashboardData])

  // Supabase Realtime Subscriptions (Event-driven instant invalidation)
  useEffect(() => {
    if (!profile?.organization_id) return

    const orgId = profile.organization_id

    const channel = supabase
      .channel(`live-overview-${orgId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'work_items',
          filter: `organization_id=eq.${orgId}`,
        },
        () => {
          setLiveStatus('CONNECTED')
          loadDashboardData(true)
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects',
          filter: `organization_id=eq.${orgId}`,
        },
        () => {
          setLiveStatus('CONNECTED')
          loadDashboardData(true)
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_work_targets',
          filter: `organization_id=eq.${orgId}`,
        },
        () => {
          setLiveStatus('CONNECTED')
          loadDashboardData(true)
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'work_updates',
        },
        () => {
          setLiveStatus('CONNECTED')
          loadDashboardData(true)
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setLiveStatus('CONNECTED')
        } else if (status === 'TIMED_OUT' || status === 'CLOSED') {
          setLiveStatus('DISCONNECTED')
        } else if (status === 'CHANNEL_ERROR') {
          setLiveStatus('RECONNECTING')
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile?.organization_id, loadDashboardData])

  // Render Skeleton while initial load
  if (loading && !liveData) {
    return (
      <div className="space-y-6 animate-pulse pb-12">
        <div className="h-24 bg-slate-200 rounded-2xl w-full" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-200 rounded-2xl" />
          ))}
        </div>
        <div className="h-40 bg-slate-200 rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 bg-slate-200 rounded-2xl" />
          <div className="h-64 bg-slate-200 rounded-2xl" />
        </div>
      </div>
    )
  }

  // Safe fallback shape
  const data = liveData || {
    generatedAt: new Date().toISOString(),
    timezone: 'Asia/Kolkata',
    today: new Date().toISOString().slice(0, 10),
    summary: {
      projects: 0,
      assigned: 0,
      active: 0,
      completedToday: 0,
      overdue: 0,
      carriedForward: 0,
      dueToday: 0,
      atRisk: 0,
      blocked: 0,
    },
    pulse: {
      assigned: 0,
      completed: 0,
      inProgress: 0,
      overdue: 0,
      pending: 0,
      percentage: 0,
    },
    attention: {
      overdue: [],
      carriedForward: [],
      atRisk: [],
      blocked: [],
    },
    projectHealth: [],
    teamWorkload: [],
    liveActivity: [],
    freshness: {
      generatedAt: new Date().toISOString(),
      source: 'database',
    },
  }

  const formatFreshness = () => {
    if (secondsAgo < 5) return 'Updated just now'
    if (secondsAgo < 60) return `Updated ${secondsAgo}s ago`
    const mins = Math.floor(secondsAgo / 60)
    return `Updated ${mins}m ago`
  }

  return (
    <div className="space-y-6 pb-12">
      {/* 1. WELCOME HEADER WITH TRUTHFUL LIVE FRESHNESS INDICATOR */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            WORK OVERVIEW
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 font-medium">
            Live organization-wide work, targets, workload and progress ({data.timezone})
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Truthful Realtime Status Indicator */}
          <div
            className={`px-3.5 py-1.5 rounded-xl border flex items-center gap-2 text-xs font-bold transition shadow-2xs ${
              liveStatus === 'CONNECTED'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : liveStatus === 'RECONNECTING'
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            {liveStatus === 'CONNECTED' && (
              <>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600"></span>
                </span>
                <span>● LIVE • {formatFreshness()}</span>
              </>
            )}

            {liveStatus === 'RECONNECTING' && (
              <>
                <span className="animate-spin text-amber-600 font-bold">◐</span>
                <span>RECONNECTING • Last {formatFreshness()}</span>
              </>
            )}

            {liveStatus === 'DISCONNECTED' && (
              <>
                <span>○ OFFLINE • Last {formatFreshness()}</span>
                <button
                  onClick={() => loadDashboardData(true)}
                  className="underline hover:text-rose-950 font-black cursor-pointer ml-1"
                >
                  Retry
                </button>
              </>
            )}
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => loadDashboardData(true)}
            disabled={refreshing}
            className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition shadow-2xs disabled:opacity-50"
          >
            <RotateCw size={13} className={refreshing ? 'animate-spin text-[#801424]' : 'text-slate-500'} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 2. 8 PRIMARY LIVE CARDS WITH EXACT MATHEMATICAL DEFINITIONS & DEEP LINKS */}
      <div className="space-y-3">
        {/* Row 1: Core Flow */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: 🟣 Projects */}
          <button
            type="button"
            onClick={() => navigate('/projects')}
            className="group text-left border border-purple-200 bg-purple-50/20 rounded-2xl p-4.5 shadow-xs hover:shadow-md hover:border-purple-300 transition-all cursor-pointer hover:-translate-y-px"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-purple-700 font-mono uppercase tracking-wider">
                PROJECTS
              </span>
              <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                <FolderKanban size={15} />
              </div>
            </div>
            <p className="mt-2 text-2xl sm:text-3xl font-black text-purple-950 group-hover:text-purple-700 transition">
              {data.summary.projects}
            </p>
            <p className="mt-0.5 text-[11px] text-purple-600 font-medium">Active Projects</p>
          </button>

          {/* Card 2: 🔵 Assigned */}
          <button
            type="button"
            onClick={() => navigate('/work')}
            className="group text-left border border-blue-200 bg-blue-50/20 rounded-2xl p-4.5 shadow-xs hover:shadow-md hover:border-blue-300 transition-all cursor-pointer hover:-translate-y-px"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-blue-700 font-mono uppercase tracking-wider">
                ASSIGNED
              </span>
              <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                <Briefcase size={15} />
              </div>
            </div>
            <p className="mt-2 text-2xl sm:text-3xl font-black text-blue-950 group-hover:text-blue-700 transition">
              {data.summary.assigned}
            </p>
            <p className="mt-0.5 text-[11px] text-blue-600 font-medium">Total Work Assigned</p>
          </button>

          {/* Card 3: 🟡 Active */}
          <button
            type="button"
            onClick={() => navigate('/work?status=IN_PROGRESS')}
            className="group text-left border border-amber-200 bg-amber-50/20 rounded-2xl p-4.5 shadow-xs hover:shadow-md hover:border-amber-300 transition-all cursor-pointer hover:-translate-y-px"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-700 font-mono uppercase tracking-wider">
                ACTIVE
              </span>
              <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                <Clock size={15} />
              </div>
            </div>
            <p className="mt-2 text-2xl sm:text-3xl font-black text-amber-950 group-hover:text-amber-700 transition">
              {data.summary.active}
            </p>
            <p className="mt-0.5 text-[11px] text-amber-600 font-medium">In Progress Now</p>
          </button>

          {/* Card 4: 🟢 Done */}
          <button
            type="button"
            onClick={() => navigate('/work?status=DONE')}
            className="group text-left border border-emerald-200 bg-emerald-50/20 rounded-2xl p-4.5 shadow-xs hover:shadow-md hover:border-emerald-300 transition-all cursor-pointer hover:-translate-y-px"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-700 font-mono uppercase tracking-wider">
                DONE
              </span>
              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <CheckSquare size={15} />
              </div>
            </div>
            <p className="mt-2 text-2xl sm:text-3xl font-black text-emerald-950 group-hover:text-emerald-700 transition">
              {data.summary.completedToday}
            </p>
            <p className="mt-0.5 text-[11px] text-emerald-600 font-medium">Completed Today</p>
          </button>
        </div>

        {/* Row 2: Status / Attention */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 5: 🔴 Overdue */}
          <button
            type="button"
            onClick={() => navigate('/work?filter=OVERDUE')}
            className="group text-left border border-rose-200 bg-rose-50/20 rounded-2xl p-4.5 shadow-xs hover:shadow-md hover:border-rose-300 transition-all cursor-pointer hover:-translate-y-px"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-rose-700 font-mono uppercase tracking-wider">
                OVERDUE 🔴
              </span>
              <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
                <AlertTriangle size={15} />
              </div>
            </div>
            <p className="mt-2 text-2xl sm:text-3xl font-black text-rose-700 group-hover:text-rose-800 transition">
              {data.summary.overdue}
            </p>
            <p className="mt-0.5 text-[11px] text-rose-600 font-medium">Needs Attention</p>
          </button>

          {/* Card 6: 🟠 Carry Forward */}
          <button
            type="button"
            onClick={() => navigate('/work?filter=CARRY_FORWARD')}
            className="group text-left border border-orange-200 bg-orange-50/20 rounded-2xl p-4.5 shadow-xs hover:shadow-md hover:border-orange-300 transition-all cursor-pointer hover:-translate-y-px"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-orange-700 font-mono uppercase tracking-wider">
                CARRY 🟠
              </span>
              <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center">
                <RotateCw size={15} />
              </div>
            </div>
            <p className="mt-2 text-2xl sm:text-3xl font-black text-orange-800 group-hover:text-orange-900 transition">
              {data.summary.carriedForward}
            </p>
            <p className="mt-0.5 text-[11px] text-orange-600 font-medium">From Previous Days</p>
          </button>

          {/* Card 7: 🟡 Due Today */}
          <button
            type="button"
            onClick={() => navigate('/work?filter=DUE_TODAY')}
            className="group text-left border border-amber-200 bg-amber-50/20 rounded-2xl p-4.5 shadow-xs hover:shadow-md hover:border-amber-300 transition-all cursor-pointer hover:-translate-y-px"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-700 font-mono uppercase tracking-wider">
                DUE 🟡
              </span>
              <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                <Calendar size={15} />
              </div>
            </div>
            <p className="mt-2 text-2xl sm:text-3xl font-black text-amber-900 group-hover:text-amber-700 transition">
              {data.summary.dueToday}
            </p>
            <p className="mt-0.5 text-[11px] text-amber-600 font-medium">Due Today</p>
          </button>

          {/* Card 8: 🔴 At Risk */}
          <button
            type="button"
            onClick={() => navigate('/work?health=RED')}
            className="group text-left border border-rose-200 bg-rose-50/20 rounded-2xl p-4.5 shadow-xs hover:shadow-md hover:border-rose-300 transition-all cursor-pointer hover:-translate-y-px"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-rose-700 font-mono uppercase tracking-wider">
                AT RISK 🔴
              </span>
              <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
                <AlertCircle size={15} />
              </div>
            </div>
            <p className="mt-2 text-2xl sm:text-3xl font-black text-rose-700 group-hover:text-rose-800 transition">
              {data.summary.atRisk}
            </p>
            <p className="mt-0.5 text-[11px] text-rose-600 font-medium">Critical / Blocked</p>
          </button>
        </div>
      </div>

      {/* 3. NEEDS ATTENTION STRIP (DIRECT ACTION PANEL) */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
            NEEDS ATTENTION
          </h2>
          <span className="text-[11px] font-mono text-slate-400">Direct Actions</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Overdue Pill */}
          <button
            type="button"
            onClick={() => navigate('/work?filter=OVERDUE')}
            className="px-3.5 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold flex items-center gap-2 cursor-pointer transition shadow-2xs hover:-translate-y-px"
          >
            <span>🔴 Overdue</span>
            <span className="bg-rose-200/80 text-rose-900 px-1.5 py-0.5 rounded-md text-[11px] font-mono font-black">
              {data.summary.overdue}
            </span>
          </button>

          {/* Carry Forward Pill */}
          <button
            type="button"
            onClick={() => navigate('/work?filter=CARRY_FORWARD')}
            className="px-3.5 py-1.5 rounded-xl border border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-800 text-xs font-bold flex items-center gap-2 cursor-pointer transition shadow-2xs hover:-translate-y-px"
          >
            <span>🟠 Carry Forward</span>
            <span className="bg-orange-200/80 text-orange-900 px-1.5 py-0.5 rounded-md text-[11px] font-mono font-black">
              {data.summary.carriedForward}
            </span>
          </button>

          {/* At Risk Pill */}
          <button
            type="button"
            onClick={() => navigate('/work?health=RED')}
            className="px-3.5 py-1.5 rounded-xl border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-800 text-xs font-bold flex items-center gap-2 cursor-pointer transition shadow-2xs hover:-translate-y-px"
          >
            <span>🔴 At Risk</span>
            <span className="bg-rose-200/80 text-rose-900 px-1.5 py-0.5 rounded-md text-[11px] font-mono font-black">
              {data.summary.atRisk}
            </span>
          </button>

          {/* Blocked Pill */}
          <button
            type="button"
            onClick={() => navigate('/work?status=BLOCKED')}
            className="px-3.5 py-1.5 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold flex items-center gap-2 cursor-pointer transition shadow-2xs hover:-translate-y-px"
          >
            <span>🟡 Blocked</span>
            <span className="bg-amber-200/80 text-amber-900 px-1.5 py-0.5 rounded-md text-[11px] font-mono font-black">
              {data.summary.blocked}
            </span>
          </button>
        </div>
      </div>

      {/* 4. TODAY'S WORK PULSE */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-[#801424]" />
            <h2 className="text-xs font-black text-slate-900 font-mono tracking-wider uppercase">
              TODAY'S WORK PULSE
            </h2>
          </div>
          <span className="font-mono text-xs font-bold text-slate-700">
            {data.pulse.assigned} Assigned
          </span>
        </div>

        {/* Big Progress Bar */}
        <div className="space-y-2">
          <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
            <div
              className="h-full bg-linear-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-700"
              style={{ width: `${data.pulse.percentage}%` }}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between text-xs font-bold text-slate-600 pt-1">
            <span className="text-emerald-700">✓ {data.pulse.completed} Completed</span>
            <span className="text-blue-700">⚡ {data.pulse.inProgress} In Progress</span>
            <span className="text-rose-700">⚠ {data.pulse.overdue} Overdue</span>
            <span className="text-slate-500">○ {data.pulse.pending} Pending</span>
            <span className="font-black text-slate-900 font-mono">{data.pulse.percentage}%</span>
          </div>
        </div>
      </div>

      {/* 5. SIDE-BY-SIDE PANELS: PROJECT HEALTH & TEAM WORKLOAD */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project Health */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-xs font-black text-slate-900 font-mono tracking-wider uppercase flex items-center gap-1.5">
              <FolderKanban size={15} className="text-[#801424]" />
              PROJECT HEALTH
            </h2>
            <button
              onClick={() => navigate('/projects')}
              className="text-xs font-bold text-[#801424] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>View All</span>
              <ArrowRight size={12} />
            </button>
          </div>

          <div className="space-y-3.5">
            {data.projectHealth.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No active projects</p>
            ) : (
              data.projectHealth.map((p) => (
                <div
                  key={p.id}
                  onClick={() => navigate(`/projects/${p.id}`)}
                  className="p-3.5 rounded-xl border border-slate-100 hover:border-slate-300 hover:bg-slate-50/60 transition cursor-pointer space-y-2 group"
                >
                  <div className="flex items-center justify-between text-xs">
                    <strong className="font-bold text-slate-900 group-hover:text-[#801424]">
                      {p.name}
                    </strong>
                    <span className="font-bold flex items-center gap-1 text-[11px]">
                      {p.health === 'GREEN' && <span className="text-emerald-600">🟢 {p.progress}%</span>}
                      {p.health === 'AMBER' && <span className="text-amber-600">🟠 {p.progress}%</span>}
                      {p.health === 'ORANGE' && <span className="text-orange-600">🟠 {p.progress}%</span>}
                      {p.health === 'RED' && <span className="text-rose-600">🔴 {p.progress}%</span>}
                    </span>
                  </div>

                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        p.health === 'GREEN'
                          ? 'bg-emerald-500'
                          : p.health === 'AMBER'
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${p.progress}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span>{p.completed} / {p.total} tasks</span>
                    <span>{p.overdue > 0 ? `${p.overdue} overdue` : `${p.inProgress} active`}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Team Workload */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-xs font-black text-slate-900 font-mono tracking-wider uppercase flex items-center gap-1.5">
              <User size={15} className="text-[#801424]" />
              TEAM WORKLOAD
            </h2>
            <button
              onClick={() => navigate('/team-today')}
              className="text-xs font-bold text-[#801424] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Team Today</span>
              <ArrowRight size={12} />
            </button>
          </div>

          <div className="space-y-3.5">
            {data.teamWorkload.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No team members</p>
            ) : (
              data.teamWorkload.map((emp) => {
                const total = emp.activeTasks + emp.completedToday
                const pct = total > 0 ? Math.min(100, Math.round((emp.completedToday / total) * 100)) : 0
                return (
                  <div
                    key={emp.id}
                    onClick={() => navigate(`/employees/${emp.id}/work`)}
                    className="p-3.5 rounded-xl border border-slate-100 hover:border-slate-300 hover:bg-slate-50/60 transition cursor-pointer space-y-2 group"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <strong className="font-bold text-slate-900 group-hover:text-[#801424]">
                        {emp.name} {emp.role ? `(${emp.role})` : ''}
                      </strong>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-slate-500">
                          {emp.completedToday}/{total} ({pct}%)
                        </span>
                        <span>
                          {emp.loadStatus === 'NORMAL' && '🟢'}
                          {emp.loadStatus === 'HIGH' && '🟠'}
                          {emp.loadStatus === 'OVERLOADED' && '🔴'}
                        </span>
                      </div>
                    </div>

                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          emp.loadStatus === 'NORMAL'
                            ? 'bg-emerald-500'
                            : emp.loadStatus === 'HIGH'
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* 6. LIVE ACTIVITY FEED */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-[#801424]" />
            <h2 className="text-xs font-black text-slate-900 font-mono tracking-wider uppercase">
              LIVE ACTIVITY
            </h2>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Realtime database events
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {data.liveActivity.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No recent activity</p>
          ) : (
            data.liveActivity.map((act) => (
              <div key={act.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                  <p className="text-slate-800">
                    <span className="font-mono text-slate-400 font-bold mr-2">
                      ● {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <strong className="text-slate-900">{act.actorName}:</strong>{' '}
                    <span>{act.updateText || `Updated ${act.workItemTitle}`}</span>
                  </p>
                </div>
                <span className="text-emerald-700 font-mono text-[11px] font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shrink-0">
                  Live
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
