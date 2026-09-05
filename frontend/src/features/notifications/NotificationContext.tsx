import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useAuth } from '../auth/AuthContext'
import {
  getNotifications,
  getUnreadCount,
  markAllNotificationsRead as apiMarkAllRead,
  markNotificationRead as apiMarkRead,
  markNotificationUnread as apiMarkUnread,
  type NotificationItem,
} from './notification.service'
import {
  playNotificationSound,
  playConversationNotificationSound,
  playWorkNotificationSound,
  unlockNotificationSound,
} from './notification.sound'
import { NotificationType } from './notification.types'
import { supabase } from '../../lib/supabase'

interface ToastItem {
  id: string
  title: string
  message: string
  type: string
}

interface NotificationContextType {
  notifications: NotificationItem[]
  unreadCount: number
  refreshNotifications: () => Promise<void>
  markRead: (id: string) => Promise<void>
  markUnread: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
  playTestSound: (category?: 'CONVERSATION' | 'WORK') => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
)

export function parseNotificationRow(row: any): NotificationItem {
  if (!row) return row
  let logicalType = row.type
  let cleanTitle = row.title || ''

  const match = cleanTitle.match(/^\[([A-Z_]+)\]\s*(.*)$/)
  if (match) {
    logicalType = match[1]
    cleanTitle = match[2]
  } else if (
    cleanTitle.toLowerCase().includes('message from') ||
    cleanTitle.toLowerCase().includes('team chat')
  ) {
    logicalType = 'MESSAGE_RECEIVED'
  } else if (cleanTitle.includes('Completed')) {
    logicalType = 'WORK_COMPLETED'
  } else if (cleanTitle.includes('Sent Back')) {
    logicalType = 'WORK_SENT_BACK'
  } else if (cleanTitle.includes('Reassigned')) {
    logicalType = 'WORK_REASSIGNED'
  } else if (cleanTitle.includes('Concern Resolved')) {
    logicalType = 'CONCERN_RESOLVED'
  } else if (
    cleanTitle.includes('New comment') ||
    cleanTitle.includes('commented')
  ) {
    logicalType = 'COMMENT_ADDED'
  }

  return {
    ...row,
    type: logicalType,
    title: cleanTitle,
  }
}

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { accessToken, profile } = useAuth()

  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [activeToast, setActiveToast] = useState<ToastItem | null>(null)
  const previousUnread = useRef<number>(0)
  const isInitialized = useRef<boolean>(false)

  // Critical deduplication guard to prevent duplicate sound & toast between Realtime & Polling
  const handledNotificationIds = useRef<Set<string>>(new Set())

  function showNotificationToast(rawNotification: NotificationItem) {
    const notification = parseNotificationRow(rawNotification)
    if (handledNotificationIds.current.has(notification.id)) {
      return
    }

    handledNotificationIds.current.add(notification.id)

    setActiveToast({
      id: notification.id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
    })

    // Play distinct sound based on notification category (Conversation vs Work)
    playNotificationSound(notification.type)

    // Keep handled set bounded
    if (handledNotificationIds.current.size > 300) {
      const firstItem = handledNotificationIds.current.values().next().value
      if (firstItem) handledNotificationIds.current.delete(firstItem)
    }

    window.setTimeout(() => {
      setActiveToast((current) =>
        current?.id === notification.id ? null : current,
      )
    }, 6000)
  }

  function playTestSound(category: 'CONVERSATION' | 'WORK' = 'WORK') {
    unlockNotificationSound()
    if (category === 'CONVERSATION') {
      playConversationNotificationSound()
      setActiveToast({
        id: String(Date.now()),
        title: '💬 Conversation Sound Test',
        message: 'Chat message chime is playing properly!',
        type: NotificationType.MESSAGE_RECEIVED,
      })
    } else {
      playWorkNotificationSound()
      setActiveToast({
        id: String(Date.now()),
        title: '🔔 Work Notification Sound Test',
        message: 'Work & system notification chime is playing properly!',
        type: NotificationType.WORK_ASSIGNED,
      })
    }
    setTimeout(() => {
      setActiveToast(null)
    }, 4500)
  }

  useEffect(() => {
    const unlock = () => {
      unlockNotificationSound()
    }

    window.addEventListener('click', unlock, { passive: true })
    window.addEventListener('pointerdown', unlock, { passive: true })
    window.addEventListener('keydown', unlock, { passive: true })
    window.addEventListener('touchstart', unlock, { passive: true })
    window.addEventListener('focus', unlock, { passive: true })

    return () => {
      window.removeEventListener('click', unlock)
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
      window.removeEventListener('touchstart', unlock)
      window.removeEventListener('focus', unlock)
    }
  }, [])

  async function refreshNotifications() {
    if (!accessToken) return

    try {
      const [notificationData, countData] = await Promise.all([
        getNotifications(accessToken),
        getUnreadCount(accessToken),
      ])

      const rawList = notificationData || []
      const parsedList = rawList.map(parseNotificationRow)
      const newCount = countData.count

      if (isInitialized.current && newCount > previousUnread.current) {
        // Find newest unread notification not yet handled
        const unhandledUnread = parsedList.find(
          (notification) =>
            !notification.is_read &&
            !handledNotificationIds.current.has(notification.id),
        )

        if (unhandledUnread) {
          showNotificationToast(unhandledUnread)
        }
      } else if (!isInitialized.current) {
        // Mark all initial historical notifications as handled so no sounds play on page refresh
        for (const notif of parsedList) {
          handledNotificationIds.current.add(notif.id)
        }
      }

      setNotifications(parsedList)
      setUnreadCount(newCount)
      previousUnread.current = newCount
      isInitialized.current = true
    } catch (error) {
      console.error('[Notifications] refresh failed:', error)
    }
  }

  async function markRead(id: string) {
    if (!accessToken) return
    try {
      await apiMarkRead(accessToken, id)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      )
      setUnreadCount((prev) => {
        const next = Math.max(0, prev - 1)
        previousUnread.current = next
        return next
      })
    } catch (err) {
      console.error('Failed to mark notification read:', err)
    }
  }

  async function markUnread(id: string) {
    if (!accessToken) return
    try {
      await apiMarkUnread(accessToken, id)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: false } : n)),
      )
      setUnreadCount((prev) => {
        const next = prev + 1
        previousUnread.current = next
        return next
      })
    } catch (err) {
      console.error('Failed to mark notification unread:', err)
    }
  }

  async function markAllRead() {
    if (!accessToken) return
    try {
      await apiMarkAllRead(accessToken)
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      setUnreadCount(0)
      previousUnread.current = 0
    } catch (err) {
      console.error('Failed to mark all read:', err)
    }
  }

  useEffect(() => {
    if (!accessToken || !profile) {
      return
    }

    // Initial load
    void refreshNotifications()

    // 1. Supabase Realtime Channel: Listen to postgres changes on notifications table
    const channel = supabase
      .channel(`user-notifications-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          const row = (payload.new || payload.old) as NotificationItem
          if (!row || row.user_id !== profile.id) {
            return
          }

          if (payload.eventType === 'INSERT') {
            const newNotif = payload.new as NotificationItem
            if (newNotif && !newNotif.is_read) {
              showNotificationToast(newNotif)
            }
          }

          void refreshNotifications()
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Notification Realtime] Subscribed successfully for:', profile.id)
        }
      })

    // 2. High-frequency 3s fallback poll to guarantee real-time delivery
    const interval = window.setInterval(() => {
      void refreshNotifications()
    }, 3000)

    // 3. Sync immediately when tab becomes visible or focused
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        void refreshNotifications()
      }
    }

    const handleCustomSync = () => {
      void refreshNotifications()
    }

    window.addEventListener('visibilitychange', handleVisibilityOrFocus)
    window.addEventListener('focus', handleVisibilityOrFocus)
    window.addEventListener('notification-refresh', handleCustomSync)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('visibilitychange', handleVisibilityOrFocus)
      window.removeEventListener('focus', handleVisibilityOrFocus)
      window.removeEventListener('notification-refresh', handleCustomSync)
      void supabase.removeChannel(channel)
    }
  }, [accessToken, profile])

  const isChatToast =
    activeToast?.type === NotificationType.MESSAGE_RECEIVED ||
    activeToast?.type === 'MESSAGE_RECEIVED'

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        refreshNotifications,
        markRead,
        markUnread,
        markAllRead,
        playTestSound,
      }}
    >
      {children}

      {/* Categorized In-App Toast Banner */}
      {activeToast && (
        <div
          className={`fixed top-5 right-5 z-50 max-w-sm w-full rounded-2xl p-4 shadow-2xl border flex items-start justify-between gap-3 animate-in fade-in slide-in-from-top-3 duration-300 ${
            isChatToast
              ? 'bg-slate-900 text-white border-indigo-500/50 shadow-indigo-950/30'
              : activeToast.type === 'CONCERN_REPORTED' ||
                activeToast.type === 'WORK_EMERGENCY' ||
                activeToast.type === 'SYSTEM_ALERT'
              ? 'bg-slate-900 text-white border-rose-500/60 shadow-rose-950/30'
              : 'bg-slate-900 text-white border-slate-700/80 shadow-slate-950/30'
          }`}
        >
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">
                {isChatToast
                  ? '💬'
                  : activeToast.type === 'CONCERN_REPORTED'
                  ? '🚨'
                  : '🔔'}
              </span>
              <span
                className={`w-2 h-2 rounded-full ${
                  isChatToast
                    ? 'bg-indigo-400 animate-ping'
                    : activeToast.type === 'CONCERN_REPORTED'
                    ? 'bg-rose-500 animate-ping'
                    : 'bg-emerald-400 animate-ping'
                }`}
              />
              <h4 className="font-black text-xs uppercase tracking-wider text-slate-200">
                {isChatToast
                  ? 'New Message'
                  : activeToast.type === 'WORK_ASSIGNED'
                  ? 'Work Assigned'
                  : activeToast.type === 'WORK_REASSIGNED'
                  ? 'Work Reassigned'
                  : activeToast.type === 'WORK_COMPLETED'
                  ? 'Work Completed'
                  : activeToast.type === 'WORK_SENT_BACK'
                  ? 'Work Sent Back'
                  : activeToast.type === 'CONCERN_REPORTED'
                  ? 'Concern Reported'
                  : 'Notification'}
              </h4>
            </div>
            <h5 className="text-xs font-bold text-white mb-0.5">
              {activeToast.title}
            </h5>
            <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
              {activeToast.message}
            </p>
          </div>
          <button
            onClick={() => setActiveToast(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)

  if (!context) {
    throw new Error(
      'useNotifications must be used inside NotificationProvider',
    )
  }

  return context
}
