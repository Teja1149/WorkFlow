import { useEffect, useMemo, useState, useRef } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
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

const navGroups = [
  {
    title: 'OVERVIEW',
    items: [
      { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
      { name: 'My Day', path: '/my-day', icon: CalendarDays },
      { name: 'My Work', path: '/work', icon: Briefcase },
      { name: 'Daily Work', path: '/daily-work', icon: CalendarDays },
      { name: 'Notifications', path: '/notifications', icon: Bell, hasBadge: true },
    ],
  },
  {
    title: 'WORK',
    items: [
      { name: 'Execution Board', path: '/execution-board', icon: LayoutDashboard },
      { name: 'Projects', path: '/projects', icon: FolderKanban },
      { name: 'Conversations', path: '/conversations', icon: MessageSquare },
      { name: 'Sprints', path: '/sprints', icon: Flame },
    ],
  },
  {
    title: 'MANAGEMENT',
    items: [
      { name: 'Company Operations', path: '/company-operations', icon: ShieldAlert },
      { name: 'Team Today', path: '/team-today', icon: Users },
      { name: 'Command Center', path: '/company-command-center', icon: ShieldAlert },
      { name: 'Performance', path: '/employee-performance', icon: Award },
      { name: 'Work Settings', path: '/organization-settings', icon: Settings },
      { name: 'Work Types', path: '/work-types', icon: Layers3 },
      { name: 'Employees', path: '/employees', icon: Users },
    ],
  },
]

export default function AppLayout() {
  const { accessToken, profile, logout } = useAuth()
  const { unreadCount, playTestSound } = useNotifications()
  const navigate = useNavigate()
  const location = useLocation()
  const [attentionCounts, setAttentionCounts] = useState<AttentionCounts | null>(null)
  const [showCreateMenu, setShowCreateMenu] = useState(false)
  const createMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (createMenuRef.current && !createMenuRef.current.contains(event.target as Node)) {
        setShowCreateMenu(false)
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

  const filteredNavGroups = useMemo(() => {
    if (isSuperAdminOrAdmin) {
      return [
        {
          title: 'OPERATIONS',
          items: [
            { name: 'Dashboard', path: '/admin-workboard', icon: LayoutDashboard },
            { name: 'Projects', path: '/projects', icon: FolderKanban },
            { name: 'Work Overview', path: '/work-overview', icon: Activity },
            { name: 'Work Planner', path: '/work-distribution', icon: UserCheck },
            { name: 'Work Types', path: '/work-types', icon: Layers3 },
            { name: 'Employees', path: '/employees', icon: Users },
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
          title: 'EXECUTION',
          items: [
            { name: 'Team Execution', path: '/admin-workboard', icon: LayoutDashboard },
            { name: 'Work Distribution', path: '/work-distribution', icon: UserCheck },
            { name: 'My Workload', path: '/my-workload', icon: Gauge },
            { name: 'Set Daily Target', path: '/set-daily-target', icon: Target },
            { name: 'Team Today', path: '/team-today', icon: Users, hasBadge: true },
          ],
        },
        {
          title: 'WORK',
          items: [
            { name: 'Projects', path: '/projects', icon: FolderKanban },
            { name: 'Sprints', path: '/sprints', icon: Flame },
            { name: 'Work Items', path: '/work', icon: Briefcase },
            { name: 'Conversations', path: '/conversations', icon: MessageSquare },
          ],
        },
        {
          title: 'REPORTS',
          items: [
            { name: 'Daily Results', path: '/daily-results', icon: CalendarDays },
            { name: 'Team Performance', path: '/employee-performance', icon: Award },
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
          { name: 'Execution Board', path: '/execution-board', icon: LayoutDashboard },
          { name: 'My Results', path: '/my-target-history', icon: Award },
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
  }, [profile?.role, isSuperAdminOrAdmin, isManager])

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-900 font-sans flex">
      {/* Dark Obsidian Sidebar matching screenshot colors */}
      <aside className="w-64 bg-[#121214] text-slate-300 border-r border-[#222226] flex flex-col justify-between fixed inset-y-0 left-0 z-30 select-none shadow-lg">
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
            {filteredNavGroups.map((group: any) => (
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

      {/* Main Canvas Area */}
      <div className="flex-1 ml-64 flex flex-col min-w-0">
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-8 flex items-center justify-between sticky top-0 z-20">
          <div>
            <h1 className="font-bold text-lg text-slate-900 tracking-tight">
              Workspace
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={playTestSound}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors text-slate-700 cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
              title="Test Notification Sound & Unlock Audio"
            >
              <Volume2 size={16} className="text-slate-600" />
              <span className="hidden sm:inline">Test Sound</span>
            </button>

            <button
              onClick={() => navigate('/notifications')}
              className="relative p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 transition-colors text-slate-700 cursor-pointer"
              title="Notifications"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-[#9f1239] text-white text-[9px] font-bold flex items-center justify-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

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

        <main className="p-8 max-w-7xl mx-auto w-full flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}