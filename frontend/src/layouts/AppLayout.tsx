import { useEffect } from 'react'
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
  Plus,
} from 'lucide-react'
import { useAuth } from '../features/auth/AuthContext'
import { useNotifications } from '../features/notifications/NotificationContext'

const navGroups = [
  {
    title: 'OVERVIEW',
    items: [
      { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
      { name: 'My Work', path: '/work', icon: Briefcase },
      { name: 'Notifications', path: '/notifications', icon: Bell, hasBadge: true },
    ],
  },
  {
    title: 'WORK',
    items: [
      { name: 'Projects', path: '/projects', icon: FolderKanban },
      { name: 'Conversations', path: '/conversations', icon: MessageSquare },
      { name: 'Sprints', path: '/sprints', icon: Flame },
    ],
  },
  {
    title: 'DAILY',
    items: [
      { name: 'Employees', path: '/employees', icon: Users },
    ],
  },
]

export default function AppLayout() {
  const { profile, logout } = useAuth()
  const { unreadCount } = useNotifications()
  const navigate = useNavigate()
  const location = useLocation()

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
            {navGroups.map((group) => (
              <div key={group.title} className="space-y-1">
                <div className="px-3 text-[11px] font-bold text-[#71717a] tracking-wider uppercase">
                  {group.title}
                </div>
                <div className="space-y-0.5 mt-1.5">
                  {group.items.map(({ name, path, icon: Icon, hasBadge }) => (
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
                      {hasBadge && unreadCount > 0 && (
                        <span className="bg-[#9f1239] text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                          {unreadCount}
                        </span>
                      )}
                    </NavLink>
                  ))}
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

            <button
              onClick={() => navigate('/work')}
              className="bg-[#801424] text-white text-xs font-bold px-3.5 py-2 rounded-xl hover:bg-[#9f1239] transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus size={15} />
              <span>New Item</span>
            </button>
          </div>
        </header>

        <main className="p-8 max-w-7xl mx-auto w-full flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}