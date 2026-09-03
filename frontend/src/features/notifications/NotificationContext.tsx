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
  type NotificationItem,
} from './notification.service'
import { playNotificationSound, unlockNotificationSound } from './notification.sound'
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
  markAllRead: () => Promise<void>
  playTestSound: () => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
)

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

  function playTestSound() {
    unlockNotificationSound()
    playNotificationSound()
    setActiveToast({
      id: String(Date.now()),
      title: 'Sound Test',
      message: 'Notification chime is working properly!',
      type: 'SYSTEM',
    })
    setTimeout(() => {
      setActiveToast(null)
    }, 4000)
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

      const newCount = countData.count

      if (isInitialized.current && newCount > previousUnread.current) {
        playNotificationSound()
        const latest = notificationData[0]
        if (latest) {
          setActiveToast({
            id: latest.id,
            title: latest.title,
            message: latest.message,
            type: latest.type,
          })
          setTimeout(() => {
            setActiveToast(null)
          }, 5000)
        }
      }

      setNotifications(notificationData)
      setUnreadCount(newCount)
      previousUnread.current = newCount
      isInitialized.current = true
    } catch (error) {
      console.error('Notification refresh failed:', error)
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

    // Supabase Realtime subscription for live notifications
    const channel = supabase
      .channel(`notifications-live-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        (payload) => {
          playNotificationSound()
          const newNotif = payload.new as NotificationItem
          if (newNotif) {
            setActiveToast({
              id: newNotif.id,
              title: newNotif.title,
              message: newNotif.message,
              type: newNotif.type,
            })
            setTimeout(() => {
              setActiveToast(null)
            }, 5000)
          }
          void refreshNotifications()
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Realtime notifications channel active for profile:', profile.id)
        }
      })

    /**
     * Realtime is primary.
     * Polling protects against temporary
     * realtime connection problems.
     */
    const interval = window.setInterval(() => {
      void refreshNotifications()
    }, 5000)

    return () => {
      window.clearInterval(interval)
      void supabase.removeChannel(channel)
    }
  }, [accessToken, profile])

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        refreshNotifications,
        markRead,
        markAllRead,
        playTestSound,
      }}
    >
      {children}

      {/* Floating In-App Toast Banner */}
      {activeToast && (
        <div className="fixed top-5 right-5 z-50 max-w-sm w-full bg-slate-900 text-white rounded-2xl p-4 shadow-2xl border border-slate-700/80 flex items-start justify-between gap-3 animate-in fade-in slide-in-from-top-3 duration-300">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              <h4 className="font-bold text-sm text-white">{activeToast.title}</h4>
            </div>
            <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
              {activeToast.message}
            </p>
          </div>
          <button
            onClick={() => setActiveToast(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition"
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

