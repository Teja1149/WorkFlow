import { useEffect, useMemo, useState } from 'react'
import {
  FolderKanban,
  Users,
  CheckSquare,
  AlertTriangle,
  Clock,
  AlertCircle,
  Sparkles,
  TrendingUp,
  Calendar,
  CheckCircle2,
  RefreshCw,
  Play,
  Circle,
  ChevronRight,
  Target,
  Zap,
  ArrowRight,
  User,
  ListTodo,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthContext'
import { getManagerDashboard } from '../../features/dashboard/dashboard.service'
import {
  getEmployeeWorkload,
  type EmployeeWorkload,
} from '../../features/project-targets/project-target.service'
import WorkPlannerModal from '../../components/WorkPlannerModal'

type WorkItem = {
  id: string
  title: string
  description?: string | null
  status: string
  priority: string
  deadline?: string | null
  assigned_to?: string | null
  employee?: {
    id: string
    first_name?: string | null
    last_name?: string | null
  } | null
  projects?: {
    name?: string | null
    project_key?: string | null
  } | null
}

type Filter =
  | 'ATTENTION'
  | 'ONGOING'
  | 'PENDING'
  | 'DUE_SOON'
  | 'OVERDUE'
  | 'BLOCKED'
  | 'ALL'

function dateOnly(value?: string | null) {
  return value
    ? new Date(value).toISOString().split('T')[0]
    : null
}

function todayDate() {
  return dateOnly(new Date().toISOString())!
}

function employeeName(item: WorkItem) {
  return (
    `${item.employee?.first_name || ''} ${
      item.employee?.last_name || ''
    }`.trim() || 'Unassigned'
  )
}

function formatDeadline(value?: string | null) {
  if (!value) return 'No deadline'

  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function WorkRow({ item }: { item: WorkItem }) {
  const today = todayDate()

  const overdue =
    Boolean(item.deadline) &&
    dateOnly(item.deadline)! < today &&
    item.status !== 'DONE'

  const dueToday =
    Boolean(item.deadline) &&
    dateOnly(item.deadline) === today &&
    item.status !== 'DONE'

  const status =
    item.status === 'BLOCKED'
      ? 'BLOCKED'
      : item.status.replace('_', ' ')

  return (
    <Link
      to={`/work-items/${item.id}`}
      className="group block px-5 py-4 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition"
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-1 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
            overdue
              ? 'bg-rose-50 text-rose-600'
              : item.status === 'BLOCKED'
                ? 'bg-orange-50 text-orange-600'
                : item.status === 'IN_PROGRESS'
                  ? 'bg-blue-50 text-blue-600'
                  : 'bg-slate-100 text-slate-500'
          }`}
        >
          {overdue ? (
            <AlertTriangle size={15} />
          ) : item.status === 'BLOCKED' ? (
            <AlertCircle size={15} />
          ) : item.status === 'IN_PROGRESS' ? (
            <Play size={14} />
          ) : (
            <Circle size={14} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {item.projects?.project_key && (
              <span className="font-mono text-[10px] font-bold text-slate-400">
                {item.projects.project_key}
              </span>
            )}

            <span
              className={`px-2 py-0.5 rounded-md border text-[9px] font-bold uppercase ${
                item.priority === 'URGENT'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : item.priority === 'HIGH'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              {item.priority}
            </span>

            <span
              className={`px-2 py-0.5 rounded-md border text-[9px] font-bold uppercase ${
                overdue
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : item.status === 'BLOCKED'
                    ? 'bg-orange-50 text-orange-700 border-orange-200'
                    : item.status === 'IN_PROGRESS'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              {status}
            </span>
          </div>

          <h3 className="mt-1 text-sm font-bold text-slate-900 truncate group-hover:text-[#801424]">
            {item.title}
          </h3>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px]">
            <span className="font-semibold text-slate-600">
              {employeeName(item)}
            </span>

            {item.deadline && (
              <span
                className={`flex items-center gap-1 font-medium ${
                  overdue
                    ? 'text-rose-600 font-bold'
                    : dueToday
                      ? 'text-amber-600 font-bold'
                      : 'text-slate-400'
                }`}
              >
                <Calendar size={11} />

                {overdue
                  ? `Overdue · ${formatDeadline(item.deadline)}`
                  : dueToday
                    ? 'Due today'
                    : `Due ${formatDeadline(item.deadline)}`}
              </span>
            )}
          </div>
        </div>

        <ChevronRight
          size={16}
          className="mt-3 text-slate-300 group-hover:text-slate-500 shrink-0"
        />
      </div>
    </Link>
  )
}

export default function ManagerDashboard() {
  const { accessToken, profile } = useAuth()

  const [activeTab, setActiveTab] = useState<'MY_WORK' | 'TEAM_OVERVIEW'>('MY_WORK')
  const [showPlannerModal, setShowPlannerModal] = useState(false)
  const [dashboard, setDashboard] = useState<any>(null)
  const [myWorkload, setMyWorkload] = useState<EmployeeWorkload | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<Filter>('ATTENTION')

  async function load(showLoading = true) {
    if (!accessToken) return

    if (showLoading) {
      setLoading(true)
    } else {
      setRefreshing(true)
    }

    setError('')

    try {
      const [dashData, workloadData] = await Promise.all([
        getManagerDashboard(accessToken),
        getEmployeeWorkload(accessToken).catch(() => null),
      ])
      setDashboard(dashData)
      setMyWorkload(workloadData)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load manager dashboard.',
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    load()
  }, [accessToken])

  const items: WorkItem[] = ((dashboard?.workItems || []) as WorkItem[]).filter(
    (item: WorkItem) => item.title !== 'PROJECT_DAILY_REPORT_TEMPLATE' && !(item as any).is_template,
  )

  const groups = useMemo(() => {
    const today = todayDate()

    const threeDays = dateOnly(
      new Date(Date.now() + 3 * 86400000).toISOString(),
    )!

    const active = items.filter(
      (item) => item.status !== 'DONE',
    )

    const overdue = active.filter(
      (item) =>
        Boolean(item.deadline) &&
        dateOnly(item.deadline)! < today,
    )

    const blocked = active.filter(
      (item) => item.status === 'BLOCKED',
    )

    const ongoing = active.filter(
      (item) => item.status === 'IN_PROGRESS',
    )

    const pending = active.filter(
      (item) => item.status === 'TODO',
    )

    const dueSoon = active.filter(
      (item) =>
        Boolean(item.deadline) &&
        dateOnly(item.deadline)! >= today &&
        dateOnly(item.deadline)! <= threeDays,
    )

    const attention = active.filter(
      (item) => {
        const overdueItem =
          Boolean(item.deadline) &&
          dateOnly(item.deadline)! < today

        const blockedItem = item.status === 'BLOCKED'

        const dueToday =
          Boolean(item.deadline) &&
          dateOnly(item.deadline) === today

        return (
          overdueItem ||
          blockedItem ||
          dueToday ||
          item.priority === 'URGENT'
        )
      },
    )

    const sortItems = (list: WorkItem[]) =>
      [...list].sort((a, b) => {
        const priority: Record<string, number> = {
          URGENT: 0,
          HIGH: 1,
          MEDIUM: 2,
          LOW: 3,
        }

        const priorityDiff =
          (priority[a.priority] ?? 9) -
          (priority[b.priority] ?? 9)

        if (priorityDiff !== 0) {
          return priorityDiff
        }

        if (!a.deadline) return 1
        if (!b.deadline) return -1

        return (
          new Date(a.deadline).getTime() -
          new Date(b.deadline).getTime()
        )
      })

    return {
      attention: sortItems(attention),
      ongoing: sortItems(ongoing),
      pending: sortItems(pending),
      dueSoon: sortItems(dueSoon),
      overdue: sortItems(overdue),
      blocked: sortItems(blocked),
      all: items,
    }
  }, [items])

  const myItems = useMemo(() => {
    return items.filter(
      (item) => item.assigned_to === profile?.id || item.employee?.id === profile?.id,
    )
  }, [items, profile?.id])

  const currentItems = {
    ATTENTION: groups.attention,
    ONGOING: groups.ongoing,
    PENDING: groups.pending,
    DUE_SOON: groups.dueSoon,
    OVERDUE: groups.overdue,
    BLOCKED: groups.blocked,
    ALL: groups.all,
  }[filter]

  const completed = items.filter(
    (item) => item.status === 'DONE',
  ).length

  const active = items.filter(
    (item) => item.status !== 'DONE',
  ).length

  const stats = [
    {
      title: 'Active Work',
      value: dashboard?.stats?.activeWork || 0,
      icon: CheckSquare,
      bg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      border: 'border-blue-200',
      link: '/work?status=IN_PROGRESS',
    },
    {
      title: 'Overdue Items',
      value: dashboard?.stats?.overdue || 0,
      icon: AlertTriangle,
      bg: 'bg-rose-50/40 hover:bg-rose-50/80',
      iconColor: 'text-rose-600',
      border: 'border-rose-200',
      link: '/work?filter=OVERDUE',
    },
    {
      title: 'Team Members',
      value: dashboard?.stats?.team || 0,
      icon: Users,
      bg: 'bg-slate-50/70 hover:bg-slate-100/70',
      iconColor: 'text-slate-700',
      border: 'border-slate-200',
      link: '/team-today',
    },
    {
      title: 'Managed Projects',
      value: dashboard?.stats?.projects || 0,
      icon: FolderKanban,
      bg: 'bg-emerald-50/40 hover:bg-emerald-50/80',
      iconColor: 'text-emerald-600',
      border: 'border-emerald-200',
      link: '/projects',
    },
  ]

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400 text-xs font-semibold">
        Loading your team workspace...
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 rounded-2xl bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-3">
        <AlertCircle size={20} />
        <span className="text-sm font-semibold">
          {error}
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* HEADER */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
            Team workspace
          </p>

          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Good{' '}
            {new Date().getHours() < 12
              ? 'morning'
              : new Date().getHours() < 17
                ? 'afternoon'
                : 'evening'}
            , {profile?.first_name || 'Manager'}
          </h1>

          <p className="mt-1 text-xs text-slate-500">
            See what your team is working on, what is overdue, and where action is needed.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPlannerModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#801424] hover:bg-[#9f1239] text-xs font-bold text-white shadow-xs cursor-pointer transition"
          >
            <Sparkles size={14} className="text-amber-300" />
            <span>+ Work Planner</span>
          </button>

          <button
            onClick={() => load(false)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              size={14}
              className={
                refreshing ? 'animate-spin' : ''
              }
            />
            Refresh
          </button>
        </div>
      </header>

      {/* ALL-IN-ONE WORK PLANNER MODAL */}
      {showPlannerModal && (
        <WorkPlannerModal
          isOpen={showPlannerModal}
          onClose={() => setShowPlannerModal(false)}
          onSuccess={() => load(false)}
        />
      )}

      {/* TAB SWITCHER: MY ASSIGNED WORK vs TEAM & PROJECT OVERVIEW */}
      <div className="flex items-center gap-4 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('MY_WORK')}
          className={`pb-3 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'MY_WORK'
              ? 'border-[#801424] text-[#801424]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <User size={14} />
          <span>My Assigned Work</span>
          {myItems.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-rose-100 text-[#801424] text-[10px] font-mono">
              {myItems.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('TEAM_OVERVIEW')}
          className={`pb-3 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'TEAM_OVERVIEW'
              ? 'border-[#801424] text-[#801424]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users size={14} />
          <span>Team & Projects Overview</span>
        </button>
      </div>

      {/* TAB 1: MY ASSIGNED WORK */}
      {activeTab === 'MY_WORK' && (
        <div className="space-y-6 animate-fadeIn">
          {/* MY PROJECT WORKLOAD */}
          {myWorkload && myWorkload.projects.length > 0 && (
            <section className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#801424] font-mono flex items-center gap-1.5">
                    <Target size={14} />
                    MY PROJECT WORKLOAD
                  </span>
                </div>
                <Link
                  to="/my-workload"
                  className="text-xs font-bold text-[#801424] hover:underline flex items-center gap-1"
                >
                  <span>View Full Workload</span>
                  <ArrowRight size={13} />
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Active Project Allocations */}
                <div className="space-y-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                    PROJECT TARGET ALLOCATIONS
                  </span>
                  {myWorkload.projects.map((proj) => (
                    <div
                      key={proj.project_id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-slate-900">{proj.project_name}</span>
                        <span className="font-bold text-slate-700 font-mono">
                          {proj.target} {proj.unit}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span><strong>{proj.target}</strong> allocated</span>
                        <span>•</span>
                        <span><strong className="text-emerald-700">{proj.done}</strong> done</span>
                        <span>•</span>
                        <span><strong className="text-rose-700">{proj.pending}</strong> pending</span>
                        <span>•</span>
                        <span><strong className="text-slate-900">{proj.achievement}%</strong></span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="h-full bg-[#801424] rounded-full"
                          style={{ width: `${proj.achievement}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Today's Target Execution */}
                <div className="p-4 rounded-xl border border-rose-200/80 bg-rose-50/30 flex flex-col justify-between space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b border-rose-200/60 pb-2">
                    <span className="font-bold uppercase tracking-wider text-[#801424] font-mono text-[11px] flex items-center gap-1.5">
                      <Zap size={14} />
                      TODAY
                    </span>
                    <span className="text-[11px] font-bold text-slate-600">
                      {myWorkload.today.completed_count} / {myWorkload.today.targets_count} Done
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Target</span>
                      <span className="text-lg font-black text-slate-900">{myWorkload.today.planned_output}</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-emerald-200">
                      <span className="text-[10px] uppercase font-bold text-emerald-600 block">Completed</span>
                      <span className="text-lg font-black text-emerald-700">{myWorkload.today.completed}</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-rose-200">
                      <span className="text-[10px] uppercase font-bold text-rose-600 block">Remaining</span>
                      <span className="text-lg font-black text-rose-700">{myWorkload.today.remaining}</span>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-600 text-center font-medium">
                    {myWorkload.today.remaining === 0 && myWorkload.today.planned_output > 0
                      ? '🎉 All planned daily output completed!'
                      : `${myWorkload.today.remaining} items remaining to deliver today`}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Manager's Assigned Work Items */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">My Assigned Work Tasks</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">Tasks assigned directly to your profile for active execution.</p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                {myItems.length} tasks
              </span>
            </div>

            {myItems.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs font-medium">
                No active work tasks assigned to your manager profile.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {myItems.map((item) => (
                  <WorkRow key={item.id} item={item} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 2: TEAM & PROJECTS OVERVIEW */}
      {activeTab === 'TEAM_OVERVIEW' && (
        <div className="space-y-5 animate-fadeIn">
      {/* ALERT */}
      {(groups.overdue.length > 0 ||
        groups.blocked.length > 0) && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/70 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white border border-rose-200 flex items-center justify-center text-rose-600">
              <AlertTriangle size={17} />
            </div>

            <div>
              <p className="text-xs font-bold text-rose-900">
                {groups.overdue.length > 0
                  ? `${groups.overdue.length} overdue task${
                      groups.overdue.length === 1
                        ? ''
                        : 's'
                    }`
                  : `${groups.blocked.length} task${
                      groups.blocked.length === 1
                        ? ''
                        : 's'
                    } on hold`}
              </p>

              <p className="text-[11px] text-rose-700/70">
                These items need manager attention.
              </p>
            </div>
          </div>

          <button
            onClick={() =>
              setFilter(
                groups.overdue.length > 0
                  ? 'OVERDUE'
                  : 'BLOCKED',
              )
            }
            className="text-[11px] font-bold text-rose-700 cursor-pointer"
          >
            View
          </button>
        </div>
      )}

      {/* QUICK NUMBERS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(
          ({
            title,
            value,
            icon: Icon,
            bg,
            iconColor,
            border,
            link,
          }) => (
            <Link
              key={title}
              to={link || '/work'}
              className={`rounded-2xl border p-4 transition-all duration-200 cursor-pointer hover:shadow-md hover:-translate-y-px group block ${bg} ${border}`}
            >
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                  {title}
                </p>

                <div className={`p-1.5 rounded-lg bg-white/80 ${iconColor} group-hover:scale-110 transition-transform`}>
                  <Icon size={16} />
                </div>
              </div>

              <div className="flex items-baseline justify-between mt-2">
                <p className="text-2xl font-black text-slate-900">
                  {value}
                </p>
                <span className="text-xs text-slate-400 group-hover:text-slate-700 font-bold">→</span>
              </div>
            </Link>
          ),
        )}
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* OVERDUE */}
        <button
          type="button"
          onClick={() => {
            window.location.href = '/team-today'
          }}
          className="group rounded-2xl border border-rose-200 bg-rose-50 p-5 text-left hover:border-rose-300 hover:shadow-sm transition"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-white border border-rose-200 flex items-center justify-center text-rose-600">
              <AlertTriangle size={18} />
            </div>

            <span className="text-xs font-bold text-rose-500 group-hover:translate-x-1 transition">
              View →
            </span>
          </div>

          <p className="mt-4 text-[10px] font-black uppercase tracking-wider text-rose-700">
            Needs Attention
          </p>

          <p className="mt-1 text-3xl font-black text-slate-900">
            {dashboard?.stats?.overdue || 0}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Overdue work requiring manager action.
          </p>
        </button>


        {/* ACTIVE */}
        <button
          type="button"
          onClick={() => {
            window.location.href = '/team-today'
          }}
          className="group rounded-2xl border border-blue-200 bg-blue-50 p-5 text-left hover:border-blue-300 hover:shadow-sm transition"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-white border border-blue-200 flex items-center justify-center text-blue-600">
              <CheckSquare size={18} />
            </div>

            <span className="text-xs font-bold text-blue-500 group-hover:translate-x-1 transition">
              View →
            </span>
          </div>

          <p className="mt-4 text-[10px] font-black uppercase tracking-wider text-blue-700">
            Active Today
          </p>

          <p className="mt-1 text-3xl font-black text-slate-900">
            {dashboard?.stats?.activeWork || 0}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Work currently being handled by your team.
          </p>
        </button>


        {/* TEAM */}
        <button
          type="button"
          onClick={() => {
            window.location.href = '/work-distribution'
          }}
          className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left hover:border-slate-300 hover:shadow-sm transition"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700">
              <Users size={18} />
            </div>

            <span className="text-xs font-bold text-slate-500 group-hover:translate-x-1 transition">
              View →
            </span>
          </div>

          <p className="mt-4 text-[10px] font-black uppercase tracking-wider text-slate-600">
            Team Workload
          </p>

          <p className="mt-1 text-3xl font-black text-slate-900">
            {dashboard?.stats?.team || 0}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Employees currently in your team.
          </p>
        </button>

      </section>

      {/* TEAM WORK */}
      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">

        <div className="px-4 py-3 border-b border-slate-100 overflow-x-auto">
          <div className="flex items-center gap-1 min-w-max">
            {[
              ['ATTENTION', 'Needs Attention', groups.attention.length, AlertTriangle],
              ['ONGOING', 'Ongoing', groups.ongoing.length, Play],
              ['PENDING', 'Pending', groups.pending.length, Circle],
              ['DUE_SOON', 'Due Soon', groups.dueSoon.length, Clock],
              ['OVERDUE', 'Overdue', groups.overdue.length, AlertCircle],
              ['BLOCKED', 'On Hold', groups.blocked.length, AlertTriangle],
              ['ALL', 'All Work', groups.all.length, CheckSquare],
            ].map(
              ([key, label, count, Icon]: any) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold transition ${
                    filter === key
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  <Icon size={13} />
                  {label}

                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[9px] ${
                      filter === key
                        ? 'bg-white/15 text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              ),
            )}
          </div>
        </div>

        <div className="px-5 py-4 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {filter === 'ATTENTION'
                  ? 'Work needing attention'
                  : filter === 'ONGOING'
                    ? 'Team currently working'
                    : filter === 'PENDING'
                      ? 'Pending work'
                      : filter === 'DUE_SOON'
                        ? 'Upcoming deadlines'
                        : filter === 'OVERDUE'
                          ? 'Overdue work'
                          : filter === 'BLOCKED'
                            ? 'Work on hold'
                            : 'All team work'}
              </h2>

              <p className="mt-0.5 text-[11px] text-slate-500">
                {currentItems.length} item
                {currentItems.length === 1 ? '' : 's'}
              </p>
            </div>

            <Link
              to="/work"
              className="text-[11px] font-bold text-[#801424] hover:underline"
            >
              Open workboard →
            </Link>
          </div>
        </div>

        {currentItems.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <CheckCircle2
              size={34}
              className="mx-auto text-emerald-500"
            />

            <p className="mt-3 text-sm font-bold text-slate-800">
              {filter === 'ATTENTION'
                ? 'Nothing needs attention.'
                : filter === 'OVERDUE'
                  ? 'No overdue work.'
                  : filter === 'BLOCKED'
                    ? 'No work is on hold.'
                    : 'No work in this list.'}
            </p>

            <p className="mt-1 text-[11px] text-slate-500">
              Your team is in good shape here.
            </p>
          </div>
        ) : (
          <div>
            {currentItems.map((item) => (
              <WorkRow
                key={item.id}
                item={item}
              />
            ))}
          </div>
        )}
      </section>

      {/* TEAM SUMMARY */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-slate-500" />
            <h3 className="text-sm font-bold text-slate-900">
              Team
            </h3>
          </div>

          <p className="mt-4 text-3xl font-bold text-slate-900">
            {dashboard?.stats?.team || 0}
          </p>

          <p className="mt-1 text-[11px] text-slate-500">
            Team members
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5">
          <div className="flex items-center gap-2">
            <CheckSquare size={16} className="text-blue-500" />
            <h3 className="text-sm font-bold text-slate-900">
              Active workload
            </h3>
          </div>

          <p className="mt-4 text-3xl font-bold text-slate-900">
            {active}
          </p>

          <p className="mt-1 text-[11px] text-slate-500">
            Work items not completed
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-500" />
            <h3 className="text-sm font-bold text-slate-900">
              Completed
            </h3>
          </div>

          <p className="mt-4 text-3xl font-bold text-slate-900">
            {completed}
          </p>

          <p className="mt-1 text-[11px] text-slate-500">
            Completed work items
          </p>
        </div>
      </div>
        </div>
      )}
    </div>
  )
}
