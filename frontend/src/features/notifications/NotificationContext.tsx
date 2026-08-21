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

interface NotificationContextType {
  notifications: NotificationItem[]
  unreadCount: number
  refreshNotifications: () => Promise<void>
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
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
  const previousUnread = useRef<number>(0)
  const isInitialized = useRef<boolean>(false)

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
        () => {
          playNotificationSound()
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
    }, 10000)

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
      }}
    >
      {children}
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

