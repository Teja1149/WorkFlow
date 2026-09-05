import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import type { UserProfile } from './auth.types'
import { getProfile, login } from './auth.service'
import { supabase } from '../../lib/supabase'
import { api } from '../../lib/api'

const TOKEN_KEY = 'ewm_auth_token'
const ACCESS_KEY = 'ewm_access_token'
const REFRESH_KEY = 'ewm_refresh_token'

interface AuthContextType {
  profile: UserProfile | null
  token: string | null
  accessToken: string | null
  loading: boolean
  loginUser: (email: string, password: string) => Promise<UserProfile>
  logout: () => Promise<void>
  refreshSession: () => Promise<string | null>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [token, setToken] = useState<string | null>(
    localStorage.getItem(TOKEN_KEY) || localStorage.getItem(ACCESS_KEY),
  )
  const [loading, setLoading] = useState<boolean>(true)
  const lastSyncedDateRef = useRef<string>(new Date().toISOString().slice(0, 10))

  const syncTodayRecurring = useCallback((authToken: string) => {
    if (!authToken) return
    api('/recurring-work/sync-my-today', {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
    }).catch((err) => console.warn('[Recurring Work Sync notice]:', err))
  }, [])

  const refreshSession = useCallback(async (): Promise<string | null> => {
    try {
      const storedRefreshToken = localStorage.getItem(REFRESH_KEY)
      const { data, error } = storedRefreshToken
        ? await supabase.auth.refreshSession({ refresh_token: storedRefreshToken })
        : await supabase.auth.refreshSession()

      if (error || !data.session) {
        return null
      }

      const newAccessToken = data.session.access_token
      const newRefreshToken = data.session.refresh_token

      localStorage.setItem(TOKEN_KEY, newAccessToken)
      localStorage.setItem(ACCESS_KEY, newAccessToken)
      if (newRefreshToken) {
        localStorage.setItem(REFRESH_KEY, newRefreshToken)
      }

      try {
        await supabase.realtime.setAuth(newAccessToken)
      } catch {}

      setToken(newAccessToken)
      return newAccessToken
    } catch {
      return null
    }
  }, [])

  // 1. Initial Session Restoration
  useEffect(() => {
    let isMounted = true

    async function restoreSession() {
      try {
        // Step A: Check Supabase client session
        let activeToken: string | null = null
        let { data: { session } } = await supabase.auth.getSession()

        if (session?.access_token) {
          activeToken = session.access_token
          if (session.refresh_token) {
            localStorage.setItem(REFRESH_KEY, session.refresh_token)
          }
        } else {
          // Step B: Check stored tokens in localStorage
          const storedToken =
            localStorage.getItem(TOKEN_KEY) || localStorage.getItem(ACCESS_KEY)
          const storedRefreshToken = localStorage.getItem(REFRESH_KEY)

          if (storedRefreshToken) {
            const { data: refreshData, error: refreshErr } =
              await supabase.auth.refreshSession({ refresh_token: storedRefreshToken })

            if (!refreshErr && refreshData.session?.access_token) {
              activeToken = refreshData.session.access_token
              if (refreshData.session.refresh_token) {
                localStorage.setItem(REFRESH_KEY, refreshData.session.refresh_token)
              }
            }
          } else if (storedToken) {
            activeToken = storedToken
          }
        }

        if (!activeToken) {
          if (isMounted) {
            setToken(null)
            setProfile(null)
            setLoading(false)
          }
          return
        }

        // Step C: Verify and load profile with activeToken
        let userProfile: UserProfile | null = null
        try {
          userProfile = await getProfile(activeToken)
        } catch {
          // Token might be expired: attempt refresh
          const refreshedToken = await refreshSession()
          if (refreshedToken) {
            activeToken = refreshedToken
            userProfile = await getProfile(refreshedToken).catch(() => null)
          }
        }

        if (!isMounted) return

        if (userProfile && userProfile.status === 'ACTIVE') {
          localStorage.setItem(TOKEN_KEY, activeToken)
          localStorage.setItem(ACCESS_KEY, activeToken)

          try {
            await supabase.realtime.setAuth(activeToken)
          } catch (realtimeErr) {
            console.warn('[Realtime setAuth warning]:', realtimeErr)
          }

          setToken(activeToken)
          setProfile(userProfile)

          // Run daily recurring check for today
          syncTodayRecurring(activeToken)
        } else {
          // Session invalid or user inactive -> clear stale state
          localStorage.removeItem(TOKEN_KEY)
          localStorage.removeItem(ACCESS_KEY)
          localStorage.removeItem(REFRESH_KEY)
          setToken(null)
          setProfile(null)
          try {
            void supabase.auth.signOut().catch(() => {})
          } catch {}
        }
      } catch (err) {
        console.warn('[Auth restore session notice]:', err)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    void restoreSession()

    // Step D: Listen to Supabase auth state changes (e.g. background token refresh)
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!isMounted) return

        if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
          if (newSession?.access_token) {
            const newToken = newSession.access_token
            localStorage.setItem(TOKEN_KEY, newToken)
            localStorage.setItem(ACCESS_KEY, newToken)
            if (newSession.refresh_token) {
              localStorage.setItem(REFRESH_KEY, newSession.refresh_token)
            }
            setToken(newToken)
            try {
              await supabase.realtime.setAuth(newToken)
            } catch {}
          }
        } else if (event === 'SIGNED_OUT') {
          localStorage.removeItem(TOKEN_KEY)
          localStorage.removeItem(ACCESS_KEY)
          localStorage.removeItem(REFRESH_KEY)
          setToken(null)
          setProfile(null)
        }
      },
    )

    return () => {
      isMounted = false
      authListener.subscription.unsubscribe()
    }
  }, [refreshSession, syncTodayRecurring])

  // 2. Midnight / Daily Rollover Monitor
  // Keeps session alive across midnight and auto-triggers next day's recurring work without requiring re-login
  useEffect(() => {
    if (!token || !profile) return

    function checkDateRollover() {
      const todayStr = new Date().toISOString().slice(0, 10)
      if (todayStr !== lastSyncedDateRef.current) {
        console.log(`[Date Rollover] Day rolled over from ${lastSyncedDateRef.current} to ${todayStr}. Running recurring work check...`)
        lastSyncedDateRef.current = todayStr
        if (token) {
          syncTodayRecurring(token)
          window.dispatchEvent(new CustomEvent('notification-refresh'))
        }
      }
    }

    const interval = setInterval(checkDateRollover, 5 * 60 * 1000) // Check every 5 mins
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkDateRollover()
      }
    }

    window.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', checkDateRollover)

    return () => {
      clearInterval(interval)
      window.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', checkDateRollover)
    }
  }, [token, profile, syncTodayRecurring])

  // 3. Login
  async function loginUser(email: string, password: string): Promise<UserProfile> {
    const result = await login(email, password)

    const accessToken = result.session.access_token
    const refreshToken = result.session.refresh_token

    localStorage.setItem(TOKEN_KEY, accessToken)
    localStorage.setItem(ACCESS_KEY, accessToken)
    if (refreshToken) {
      localStorage.setItem(REFRESH_KEY, refreshToken)
    }

    try {
      if (accessToken && refreshToken) {
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
      }
    } catch (setSessionErr) {
      console.warn('[Supabase setSession warning]:', setSessionErr)
    }

    try {
      await supabase.realtime.setAuth(accessToken)
    } catch (realtimeErr) {
      console.warn('[Realtime setAuth warning]:', realtimeErr)
    }

    setToken(accessToken)
    setProfile(result.user)

    // Sync today's recurring work immediately on login
    syncTodayRecurring(accessToken)

    return result.user
  }

  // 4. Explicit Logout
  async function logout(): Promise<void> {
    try {
      await supabase.auth.signOut().catch(() => {})
    } catch {}

    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)

    setToken(null)
    setProfile(null)

    try {
      void supabase.realtime.setAuth(null as any)
    } catch {}
  }

  return (
    <AuthContext.Provider
      value={{
        profile,
        token,
        accessToken: token,
        loading,
        loginUser,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }

  return context
}

