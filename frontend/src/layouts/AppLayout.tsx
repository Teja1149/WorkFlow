import { useEffect, useMemo, useState, useRef } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  Check,
  CheckCheck,
  Clock,
  LayoutDashboard,
  Users,
  FolderKanban,
  Briefcase,
  Flame,
  LogOut,
  Bell,
  MessageSquare,
  Layers,
  Layers3,
  Plus,
  Volume2,
  CalendarDays,
  ShieldAlert,
  Award,
  Settings,
  Target,
  ChevronDown,
  UserCheck,
  Gauge,
  Activity,
} from 'lucide-react'
import { useAuth } from '../features/auth/AuthContext'
import { useNotifications } from '../features/notifications/NotificationContext'
import { getAttentionCounts, type AttentionCounts } from '../features/work-execution/work-execution.service'
import type { AppRole } from '../features/auth/auth.types'

function getNavGroups(role?: AppRole) {
  const isManager = role === 'MANAGER'
  const isSuperAdminOrAdmin =
    role === 'ADMIN' || role === 'SUPER_ADMIN'

  if (isSuperAdminOrAdmin) {
    return [
      {
        title: 'OPERATIONS',
        items: [
          {
            name: 'Work Overview',
            path: '/work-overview',
            icon: Activity,
          },
          {
            name: 'Company Workboard',
            path: '/admin-workboard',
            icon: LayoutDashboard,
          },
          {
            name: 'Work Planner',
            path: '/work-distribution',
            icon: UserCheck,
          },
          {
            name: 'Employees',
            path: '/employees',
            icon: Users,
          },
          {
            name: 'Projects',
            path: '/projects',
            icon: FolderKanban,
          },
          {
            name: 'Work Types',
            path: '/work-types',
            icon: Layers3,
          },
        ],
      },
      {
        title: 'EXECUTION',
        items: [
          {
            name: 'Team Today',
            path: '/team-today',
            icon: Users,
            hasBadge: true,
          },
          {
            name: 'Team Execution Board',
            path: '/execution-board',
            icon: LayoutDashboard,
          },
        ],
      },
      {
        title: 'REPORTS',
        items: [
          { name: 'Reports', path: '/reports', icon: CalendarDays },
          { name: 'Target Analytics', path: '/company-analytics', icon: Target },
        ],
      },
      {
        title: 'COMMUNICATION',
        items: [
          { name: 'Conversations', path: '/conversations', icon: MessageSquare },
        ],
      },
      {
        title: 'SETTINGS',
        items: [
          { name: 'Settings', path: '/settings', icon: Settings },
        ],
      },
    ]
  }

  if (isManager) {
    return [
      {
        title: 'OPERATIONS',
        items: [
          { name: 'Work Overview', path: '/work-overview', icon: Activity },
          { name: 'Company Workboard', path: '/admin-workboard', icon: LayoutDashboard },
          { name: 'Work Planner', path: '/work-distribution', icon: UserCheck },
          { name: 'Employees', path: '/employees', icon: Users },
          { name: 'Projects', path: '/projects', icon: FolderKanban },
          { name: 'Work Types', path: '/work-types', icon: Layers3 },
        ],
      },
      {
        title: 'EXECUTION',
        items: [
          { name: 'Daily Execution Board', path: '/execution-board', icon: LayoutDashboard },
          { name: 'Team Today', path: '/team-today', icon: Users, hasBadge: true },
          { name: 'My Day', path: '/my-day', icon: CalendarDays, hasBadge: true },
          { name: 'My Workload', path: '/my-workload', icon: Gauge },
        ],
      },
      {
        title: 'WORK',
        items: [
          { name: 'Work Items', path: '/work', icon: Briefcase },
          { name: 'Sprints', path: '/sprints', icon: Flame },
          { name: 'Conversations', path: '/conversations', icon: MessageSquare },
        ],
      },
      {
        title: 'REPORTS',
        items: [
          { name: 'Reports', path: '/reports', icon: CalendarDays },
          { name: 'Daily Results', path: '/daily-results', icon: CalendarDays },
          { name: 'Target Analytics', path: '/company-analytics', icon: Target },
          { name: 'Team Performance', path: '/employee-performance', icon: Award },
        ],
      },
      {
        title: 'NOTIFICATIONS',
        items: [
          { name: 'Notifications', path: '/notifications', icon: Bell, hasBadge: true },
        ],
      },
    ]
  }

  return [
    {
      title: 'MY WORK',
      items: [
        { name: 'My Day', path: '/my-day', icon: CalendarDays, hasBadge: true },
        { name: 'My Workload', path: '/my-workload', icon: Gauge },
        { name: 'Team Execution Board', path: '/execution-board', icon: LayoutDashboard },
        { name: 'My Results', path: '/daily-work', icon: CalendarDays },
      ],
    },
    {
      title: 'PROJECTS',
      items: [
        { name: 'My Projects', path: '/projects', icon: FolderKanban },
        { name: 'Conversations', path: '/conversations', icon: MessageSquare },
      ],
    },
    {
      title: 'NOTIFICATIONS',
      items: [
        { name: 'Notifications', path: '/notifications', icon: Bell, hasBadge: true },
      ],
    },
  ]
}

export default function AppLayout() {
  const { accessToken, profile, logout } = useAuth()
  const { notifications, unreadCount, markRead, markAllRead, playTestSound } =
    useNotifications()
  const navigate = useNavigate()
  const location = useLocation()
  const [attentionCounts, setAttentionCounts] = useState<AttentionCounts | null>(null)
  const [showCreateMenu, setShowCreateMenu] = useState(false)
  const [showNotificationMenu, setShowNotificationMenu] = useState(false)
  const createMenuRef = useRef<HTMLDivElement>(null)
  const notificationMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (createMenuRef.current && !createMenuRef.current.contains(event.target as Node)) {
        setShowCreateMenu(false)
      }
      if (
        notificationMenuRef.current &&
        !notificationMenuRef.current.contains(event.target as Node)
      ) {
        setShowNotificationMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!accessToken) return
    const fetchCounts = () => {
      getAttentionCounts(accessToken)
        .then(setAttentionCounts)
        .catch(() => {})
    }

    fetchCounts()
    const interval = window.setInterval(fetchCounts, 60_000)
    return () => window.clearInterval(interval)
  }, [accessToken])

  useEffect(() => {
    const unlockAudio = () => {
      window.dispatchEvent(new Event('ewm-audio-unlock'))
      window.removeEventListener('click', unlockAudio)
    }

    window.addEventListener('click', unlockAudio)

    return () => {
      window.removeEventListener('click', unlockAudio)
    }
  }, [])

  const isSuperAdminOrAdmin = profile?.role === 'SUPER_ADMIN' || profile?.role === 'ADMIN'
  const isManager = profile?.role === 'MANAGER'

  const navGroups = useMemo(
    () => getNavGroups(profile?.role),
    [profile?.role],
  )

  const currentTitle = useMemo(() => {
    if (location.pathname === '/admin-workboard') return 'Company Workboard'
    if (location.pathname === '/dashboard' || location.pathname === '/work-overview') return 'Work Overview'
    if (location.pathname === '/execution-board') return 'Team Execution Board'
    if (location.pathname === '/team-today') return 'Team Today'
    if (location.pathname === '/my-day') return 'My Day'
    if (location.pathname === '/my-workload') return 'My Workload'
    if (location.pathname === '/employees') return 'Employees'
    if (location.pathname === '/projects') return 'Projects'
    if (location.pathname === '/reports') return 'Reports'
    if (location.pathname === '/company-analytics' || location.pathname === '/target-analytics') return 'Target Analytics'
    if (location.pathname === '/conversations') return 'Conversations'
    if (location.pathname === '/settings' || location.pathname === '/organization-settings') return 'Settings'
    if (location.pathname === '/work' || location.pathname === '/work-items') return 'Work Items'
    if (location.pathname === '/sprints') return 'Sprints'
    if (location.pathname === '/work-distribution') return 'Work Distribution'
    if (location.pathname === '/set-daily-target') return 'Set Daily Target'
    if (location.pathname === '/work-types') return 'Work Types'
    if (location.pathname === '/notifications') return 'Notifications'

    for (const group of navGroups) {
      for (const item of (group as any).items) {
        if (location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)) {
          return item.name
        }
      }
    }
    return 'Workflow'
  }, [navGroups, location.pathname])

  return (
    <div className="h-screen w-screen bg-[#F8F9FA] text-slate-900 font-sans flex overflow-hidden">
      {/* Dark Obsidian Sidebar matching screenshot colors */}
      <aside className="w-64 bg-[#121214] text-slate-300 border-r border-[#222226] flex flex-col justify-between shrink-0 select-none shadow-lg h-full overflow-y-auto">
        <div className="p-4 space-y-6">
          {/* Brand Header */}
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-9 h-9 rounded-xl bg-[#801424] text-white flex items-center justify-center shadow-md border border-rose-500/20 shrink-0">
              <Layers size={20} className="text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-white text-base tracking-wider uppercase">
                WORKFLOW
              </span>
            </div>
          </div>

          {/* Grouped Navigation */}
          <nav className="space-y-5">
            {navGroups.map((group: any) => (
              <div key={group.title} className="space-y-1">
                <div className="px-3 text-[11px] font-bold text-[#71717a] tracking-wider uppercase">
                  {group.title}
                </div>
                <div className="space-y-0.5 mt-1.5">
                  {group.items.map(({ name, path, icon: Icon, hasBadge }: any) => {
                    let badgeValue = 0
                    if (hasBadge && unreadCount > 0) {
                      badgeValue = unreadCount
                    } else if (path === '/company-operations' && attentionCounts) {
                      badgeValue = attentionCounts.critical + attentionCounts.overdue + attentionCounts.atRisk + attentionCounts.blocked
                    } else if (path === '/team-today' && attentionCounts) {
                      badgeValue = attentionCounts.critical + attentionCounts.overdue
                    } else if (path === '/my-day' && attentionCounts) {
                      badgeValue = attentionCounts.critical
                    }

                    return (
                      <NavLink
                        key={path}
                        to={path}
                        className={({ isActive }) =>
                          `flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 ${
                            isActive
                              ? 'bg-[#27272a] text-white font-semibold shadow-xs'
                              : 'text-[#a1a1aa] hover:bg-[#1f1f23] hover:text-white'
                          }`
                        }
                      >
                        <div className="flex items-center gap-3">
                          <Icon size={17} className="shrink-0" />
                          <span>{name}</span>
                        </div>
                        {badgeValue > 0 && (
                          <span className="bg-[#9f1239] text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs font-mono">
                            {badgeValue}
                          </span>
                        )}
                      </NavLink>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* User Profile & Sign Out Footer */}
        <div className="p-4 border-t border-[#222226] space-y-3">
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[#1a1a1e] border border-[#2a2a30]">
            <div className="w-8 h-8 rounded-lg bg-[#801424] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
              {profile?.first_name?.[0] || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-xs text-white truncate">
                {profile?.first_name} {profile?.last_name}
              </div>
              <div className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-wider truncate">
                {profile?.role || 'EMPLOYEE'}
              </div>
            </div>
          </div>

          <button
            onClick={logout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[#a1a1aa] hover:bg-[#1f1f23] hover:text-rose-400 transition-colors cursor-pointer"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Canvas Area: 100% full web layout */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <header className="h-16 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-6 sm:px-8 flex items-center justify-between shrink-0 z-20">
          <div>
            <h1 className="font-bold text-lg text-slate-900 tracking-tight">
              {currentTitle}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => playTestSound('WORK')}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors text-slate-700 cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
              title="Test Notification Sound & Unlock Audio"
            >
              <Volume2 size={16} className="text-slate-600" />
              <span className="hidden sm:inline">Test Sound</span>
            </button>

            <div className="relative" ref={notificationMenuRef}>
              <button
                onClick={() => setShowNotificationMenu(!showNotificationMenu)}
                className="relative p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 transition-colors text-slate-700 cursor-pointer"
                title="Notifications"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-[#801424] text-white text-[9px] font-bold flex items-center justify-center">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotificationMenu && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white border border-slate-200 shadow-2xl z-50 overflow-hidden animate-fadeIn">
                  <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900">Notifications</span>
                      {unreadCount > 0 ? (
                        <span className="bg-[#801424] text-white text-[10px] font-bold px-2 py-0.2 rounded-full">
                          {unreadCount} unread
                        </span>
                      ) : (
                        <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.2 rounded-full">
                          All caught up
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={() => void markAllRead()}
                        className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCheck size={13} />
                        <span>Mark all read</span>
                      </button>
                    )}
                  </div>

                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400">
                        No notifications yet.
                      </div>
                    ) : (
                      notifications.slice(0, 6).map((item) => {
                        const isMsg = item.type === 'MESSAGE_RECEIVED'
                        return (
                          <div
                            key={item.id}
                            onClick={() => {
                              if (!item.is_read) void markRead(item.id)
                              setShowNotificationMenu(false)
                              if (isMsg) navigate('/conversations')
                              else if (item.work_item_id) navigate(`/work-items/${item.work_item_id}`)
                              else if (item.project_id) navigate(`/projects/${item.project_id}`)
                              else navigate('/notifications')
                            }}
                            className={`p-3 transition flex items-start gap-2.5 cursor-pointer hover:bg-slate-50 ${
                              !item.is_read ? 'bg-rose-50/20' : ''
                            }`}
                          >
                            <span className="text-sm mt-0.5">
                              {isMsg ? '💬' : item.type === 'CONCERN_REPORTED' ? '🚨' : '🔔'}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <h5 className={`text-xs truncate ${!item.is_read ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                                  {item.title}
                                </h5>
                                {!item.is_read && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      void markRead(item.id)
                                    }}
                                    className="text-slate-400 hover:text-emerald-600 p-0.5 rounded cursor-pointer shrink-0"
                                    title="Mark as read"
                                  >
                                    <Check size={13} />
                                  </button>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                                {item.message}
                              </p>
                              <span className="text-[9px] text-slate-400 flex items-center gap-1 mt-1">
                                <Clock size={9} />
                                {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>

                  <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center">
                    <button
                      onClick={() => {
                        setShowNotificationMenu(false)
                        navigate('/notifications')
                      }}
                      className="text-xs font-bold text-[#801424] hover:text-[#9f1239] transition cursor-pointer"
                    >
                      View all in Notification Center →
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Step 253 — Global Context-Sensitive Create Menu */}
            {(isSuperAdminOrAdmin || isManager) ? (
              <div className="relative" ref={createMenuRef}>
                <button
                  onClick={() => setShowCreateMenu(!showCreateMenu)}
                  className="bg-[#801424] text-white text-xs font-bold px-3.5 py-2 rounded-xl hover:bg-[#9f1239] transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus size={15} />
                  <span>Create</span>
                  <ChevronDown size={14} className={`transition-transform ${showCreateMenu ? 'rotate-180' : ''}`} />
                </button>

                {showCreateMenu && (
                  <div className="absolute right-0 mt-2 w-48 rounded-xl bg-white border border-slate-200 shadow-xl py-1.5 z-50 text-xs font-semibold text-slate-700 animate-fadeIn">
                    <button
                      onClick={() => {
                        setShowCreateMenu(false)
                        navigate('/set-daily-target')
                      }}
                      className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex items-center gap-2 cursor-pointer font-bold text-[#801424]"
                    >
                      <Target size={14} />
                      <span>Daily Target</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowCreateMenu(false)
                        navigate('/work')
                      }}
                      className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                    >
                      <Briefcase size={14} className="text-slate-400" />
                      <span>Work Item</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowCreateMenu(false)
                        navigate('/projects')
                      }}
                      className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                    >
                      <FolderKanban size={14} className="text-slate-400" />
                      <span>Project</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowCreateMenu(false)
                        navigate('/sprints')
                      }}
                      className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                    >
                      <Flame size={14} className="text-slate-400" />
                      <span>Sprint</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => navigate('/work')}
                className="bg-[#801424] text-white text-xs font-bold px-3.5 py-2 rounded-xl hover:bg-[#9f1239] transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus size={15} />
                <span>New Item</span>
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto w-full p-4 sm:p-6 lg:p-8">
          <div className="w-full max-w-full mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}