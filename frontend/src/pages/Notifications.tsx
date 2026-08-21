import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, CircleAlert, Briefcase, CheckCircle2, Clock, Volume2, Play } from 'lucide-react'
import { useNotifications } from '../features/notifications/NotificationContext'
import { playNotificationSound } from '../features/notifications/notification.sound'

export default function Notifications() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications()
  const navigate = useNavigate()

  function handleItemClick(item: any) {
    if (!item.is_read) {
      void markRead(item.id)
    }

    if (item.work_item_id) {
      navigate(`/work-items/${item.work_item_id}`)
    } else if (item.project_id) {
      navigate(`/projects/${item.project_id}`)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Notifications</h1>
            {unreadCount > 0 && (
              <span className="bg-[#9f1239] text-white text-xs font-bold px-3 py-0.5 rounded-full shadow-xs">
                {unreadCount} unread
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Stay updated on work assignments, status updates, and team alerts.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={() => void markAllRead()}
            className="flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3.5 py-2 rounded-xl transition"
          >
            <CheckCheck size={16} />
            Mark all as read
          </button>
        )}
      </div>

      {/* Notification Sound Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center shrink-0 border border-slate-200">
            <Volume2 size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-slate-900">Notification Sound</h3>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                Pentatonic Marimba
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Organic, warm wooden double-tap tone active for all system alerts.
            </p>
          </div>
        </div>

        <button
          onClick={() => playNotificationSound()}
          className="flex items-center gap-2 text-xs font-semibold text-white bg-[#09090b] hover:bg-[#18181b] px-3.5 py-2 rounded-xl transition shrink-0 shadow-xs"
        >
          <Play size={13} className="fill-white" />
          Test Sound
        </button>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        {notifications.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Bell size={24} />
            </div>
            <p className="font-medium text-slate-600">No notifications yet</p>
            <p className="text-xs text-slate-400">You're all caught up! New alerts will appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {notifications.map((item) => (
              <div
                key={item.id}
                onClick={() => handleItemClick(item)}
                className={`p-5 transition flex items-start gap-4 cursor-pointer hover:bg-slate-50 ${
                  !item.is_read ? 'bg-slate-50/70' : ''
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    item.type === 'WORK_ASSIGNED'
                      ? 'bg-blue-50 text-blue-600 border border-blue-100'
                      : item.type === 'CONCERN_REPORTED'
                      ? 'bg-rose-50 text-rose-600 border border-rose-100'
                      : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                  }`}
                >
                  {item.type === 'WORK_ASSIGNED' ? (
                    <Briefcase size={18} />
                  ) : item.type === 'CONCERN_REPORTED' ? (
                    <CircleAlert size={18} />
                  ) : (
                    <CheckCircle2 size={18} />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className={`text-xs font-semibold ${!item.is_read ? 'text-slate-900 font-bold' : 'text-slate-700'}`}>
                      {item.title}
                    </h3>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock size={11} />
                        {new Date(item.created_at).toLocaleString()}
                      </span>
                      {!item.is_read && (
                        <span className="w-2 h-2 rounded-full bg-[#9f1239]" title="Unread" />
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 line-clamp-2">{item.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
