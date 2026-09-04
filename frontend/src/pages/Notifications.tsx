import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  CheckCheck,
  Check,
  CircleAlert,
  Briefcase,
  CheckCircle2,
  Clock,
  Volume2,
  Play,
  MessageSquare,
  AlertTriangle,
  ExternalLink,
  Eye,
  EyeOff,
} from 'lucide-react'
import { useNotifications } from '../features/notifications/NotificationContext'
import { NotificationType } from '../features/notifications/notification.types'

type FilterType =
  | 'All'
  | 'Unread'
  | 'Messages'
  | 'Work'
  | 'Projects'
  | 'Critical'
  | 'Mentions'

export default function Notifications() {
  const {
    notifications,
    unreadCount,
    markRead,
    markUnread,
    markAllRead,
    playTestSound,
  } = useNotifications()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<FilterType>('All')

  function handleNavigate(item: any) {
    if (!item.is_read) {
      void markRead(item.id)
    }

    if (
      item.type === NotificationType.MESSAGE_RECEIVED ||
      item.type === 'MESSAGE_RECEIVED'
    ) {
      navigate('/conversations')
      return
    }

    if (item.target_id || item.daily_target_id) {
      navigate('/team-today')
    } else if (item.sprint_id) {
      navigate(`/sprints/${item.sprint_id}`)
    } else if (item.work_item_id) {
      navigate(`/work-items/${item.work_item_id}`)
    } else if (item.project_id) {
      navigate(`/projects/${item.project_id}`)
    }
  }

  const filteredNotifications = notifications.filter((item) => {
    if (filter === 'Unread') return !item.is_read
    if (filter === 'Messages')
      return (
        item.type === NotificationType.MESSAGE_RECEIVED ||
        item.type === 'MESSAGE_RECEIVED'
      )
    if (filter === 'Critical')
      return (
        item.type === NotificationType.CONCERN_REPORTED ||
        item.type === NotificationType.WORK_EMERGENCY ||
        item.type === NotificationType.SYSTEM_ALERT ||
        item.type === 'CONCERN_REPORTED' ||
        item.type === 'WORK_EMERGENCY' ||
        item.type === 'SYSTEM_ALERT'
      )
    if (filter === 'Work')
      return (
        item.type === NotificationType.WORK_ASSIGNED ||
        item.type === NotificationType.WORK_REASSIGNED ||
        item.type === NotificationType.WORK_UPDATED ||
        item.type === NotificationType.WORK_COMPLETED ||
        item.type === NotificationType.WORK_SENT_BACK ||
        item.type === NotificationType.WORK_CARRIED_FORWARD ||
        item.type === NotificationType.COMMENT_ADDED ||
        item.type === 'WORK_ASSIGNED' ||
        item.type === 'WORK_REASSIGNED' ||
        item.type === 'WORK_UPDATED' ||
        item.type === 'WORK_COMPLETED' ||
        item.type === 'WORK_SENT_BACK' ||
        item.type === 'WORK_CARRIED_FORWARD' ||
        item.type === 'COMMENT_ADDED' ||
        item.type === 'WORK_COMMENT' ||
        !!item.work_item_id
      )
    if (filter === 'Projects')
      return (
        item.type === NotificationType.PROJECT_UPDATED ||
        item.type === NotificationType.MILESTONE_UPDATED ||
        item.type === NotificationType.TARGET_UPDATED ||
        item.type === 'PROJECT_UPDATED' ||
        item.type === 'MILESTONE_UPDATED' ||
        item.type === 'TARGET_UPDATED' ||
        !!item.project_id
      )
    if (filter === 'Mentions')
      return (
        item.type === NotificationType.MENTION ||
        item.type === 'MENTION' ||
        item.message?.includes('@')
      )
    return true
  })

  // Count helper for tabs
  const getTabCount = (tab: FilterType) => {
    if (tab === 'All') return notifications.length
    if (tab === 'Unread') return unreadCount
    if (tab === 'Messages')
      return notifications.filter(
        (n) =>
          n.type === NotificationType.MESSAGE_RECEIVED ||
          n.type === 'MESSAGE_RECEIVED',
      ).length
    if (tab === 'Critical')
      return notifications.filter(
        (n) =>
          n.type === 'CONCERN_REPORTED' ||
          n.type === 'WORK_EMERGENCY' ||
          n.type === 'SYSTEM_ALERT',
      ).length
    if (tab === 'Work')
      return notifications.filter(
        (n) =>
          n.type?.startsWith('WORK_') ||
          n.type === 'COMMENT_ADDED' ||
          !!n.work_item_id,
      ).length
    if (tab === 'Projects')
      return notifications.filter(
        (n) => n.type?.startsWith('PROJECT_') || !!n.project_id,
      ).length
    if (tab === 'Mentions')
      return notifications.filter(
        (n) => n.type === 'MENTION' || n.message?.includes('@'),
      ).length
    return 0
  }

  const filterTabs: FilterType[] = [
    'All',
    'Unread',
    'Messages',
    'Work',
    'Projects',
    'Critical',
    'Mentions',
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Notification Center
            </h1>
            {unreadCount > 0 ? (
              <span className="bg-[#801424] text-white text-xs font-bold px-3 py-0.5 rounded-full shadow-xs">
                {unreadCount} unread
              </span>
            ) : (
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-2.5 py-0.5 rounded-full">
                All caught up
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time feed of work assignments, status updates, conversation messages, and blockers.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={() => void markAllRead()}
            className="flex items-center gap-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 px-4 py-2.5 rounded-xl transition shadow-xs cursor-pointer self-start sm:self-auto"
          >
            <CheckCheck size={16} />
            <span>Mark all as read</span>
          </button>
        )}
      </div>

      {/* Dual Notification Sound Test Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center shrink-0 border border-slate-200">
            <Volume2 size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs font-bold text-slate-900">
                Audible Alert Categories
              </h3>
              <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                💬 Chat Chime
              </span>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                🔔 Work Bell
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Two distinct sound synthesizers provide immediate audio distinction without looking at the screen.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => playTestSound('CONVERSATION')}
            className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-xl transition shadow-2xs cursor-pointer"
          >
            <Play size={11} className="fill-indigo-700" />
            <span>💬 Chat Sound</span>
          </button>
          <button
            onClick={() => playTestSound('WORK')}
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 px-3 py-1.5 rounded-xl transition shadow-2xs cursor-pointer"
          >
            <Play size={11} className="fill-white" />
            <span>🔔 Work Sound</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        {filterTabs.map((tab) => {
          const count = getTabCount(tab)
          return (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                filter === tab
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>{tab === 'Messages' ? '💬 Messages' : tab}</span>
              {count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    filter === tab
                      ? 'bg-slate-700 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Notifications List */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        {filteredNotifications.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Bell size={24} />
            </div>
            <p className="font-semibold text-slate-700">No notifications found</p>
            <p className="text-xs text-slate-400">
              No alerts match the "{filter}" filter.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredNotifications.map((item) => {
              const isMessage =
                item.type === NotificationType.MESSAGE_RECEIVED ||
                item.type === 'MESSAGE_RECEIVED'

              return (
                <div
                  key={item.id}
                  className={`p-4 sm:p-5 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/90 ${
                    !item.is_read ? 'bg-amber-50/20' : ''
                  }`}
                >
                  {/* Left: Icon & Text Info */}
                  <div
                    onClick={() => handleNavigate(item)}
                    className="flex items-start gap-3.5 flex-1 cursor-pointer min-w-0"
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                        isMessage
                          ? 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                          : item.type === 'WORK_ASSIGNED' ||
                            item.type === 'WORK_REASSIGNED'
                          ? 'bg-blue-50 text-blue-600 border border-blue-100'
                          : item.type === 'WORK_SENT_BACK'
                          ? 'bg-amber-50 text-amber-600 border border-amber-100'
                          : item.type === 'WORK_COMMENT' ||
                            item.type === 'COMMENT_ADDED'
                          ? 'bg-purple-50 text-purple-600 border border-purple-100'
                          : item.type === 'CONCERN_REPORTED' ||
                            item.type === 'SYSTEM_ALERT' ||
                            item.type === 'WORK_EMERGENCY'
                          ? 'bg-rose-50 text-rose-600 border border-rose-100'
                          : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                      }`}
                    >
                      {isMessage ? (
                        <MessageSquare size={19} />
                      ) : item.type === 'WORK_ASSIGNED' ||
                        item.type === 'WORK_REASSIGNED' ? (
                        <Briefcase size={19} />
                      ) : item.type === 'WORK_SENT_BACK' ? (
                        <AlertTriangle size={19} />
                      ) : item.type === 'WORK_COMMENT' ||
                        item.type === 'COMMENT_ADDED' ? (
                        <MessageSquare size={19} />
                      ) : item.type === 'CONCERN_REPORTED' ||
                        item.type === 'SYSTEM_ALERT' ||
                        item.type === 'WORK_EMERGENCY' ? (
                        <CircleAlert size={19} />
                      ) : (
                        <CheckCircle2 size={19} />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3
                          className={`text-xs font-semibold ${
                            !item.is_read
                              ? 'text-slate-900 font-bold'
                              : 'text-slate-700'
                          }`}
                        >
                          {item.title}
                        </h3>
                        {!item.is_read && (
                          <span className="w-2 h-2 rounded-full bg-[#801424]" title="Unread notification" />
                        )}
                        <span className="text-[10px] text-slate-400 flex items-center gap-1 ml-auto sm:ml-0">
                          <Clock size={11} />
                          {new Date(item.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        {item.message}
                      </p>
                    </div>
                  </div>

                  {/* Right: Actions (Mark Read / Mark Unread & Open Link) */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {!item.is_read ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          void markRead(item.id)
                        }}
                        className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                        title="Mark this notification as read"
                      >
                        <Check size={13} />
                        <span>Mark read</span>
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          void markUnread(item.id)
                        }}
                        className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                        title="Mark this notification as unread"
                      >
                        <EyeOff size={13} />
                        <span>Mark unread</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleNavigate(item)}
                      className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                      title="Open related item"
                    >
                      <span>Open</span>
                      <ExternalLink size={12} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
