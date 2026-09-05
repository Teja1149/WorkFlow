import React, { createContext, useContext, useEffect, useState } from 'react'
import type { UserProfile } from './auth.types'
import { getProfile, login } from './auth.service'
import { supabase } from '../../lib/supabase'
import { api } from '../../lib/api'

const TOKEN_KEY = 'ewm_auth_token'

interface AuthContextType {
  profile: UserProfile | null
  token: string | null
  accessToken: string | null
  loading: boolean
  loginUser: (email: string, password: string) => Promise<UserProfile>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [token, setToken] = useState<string | null>(
    localStorage.getItem(TOKEN_KEY) || localStorage.getItem('ewm_access_token'),
  )
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    async function restore() {
      const storedToken = localStorage.getItem(TOKEN_KEY) || localStorage.getItem('ewm_access_token')
      if (!storedToken) {
        setLoading(false)
        return
      }

      try {
        try {
          await supabase.realtime.setAuth(storedToken)
        } catch (realtimeErr) {
          console.warn('[Realtime setAuth warning]:', realtimeErr)
        }
        const userProfile = await getProfile(storedToken)
        setToken(storedToken)
        setProfile(userProfile)

        // Sync daily recurring work for today (idempotent)
        api('/recurring-work/sync-my-today', {
          method: 'POST',
          headers: { Authorization: `Bearer ${storedToken}` },
        }).catch((err) => console.warn('[Recurring Work Sync error]:', err))
      } catch {
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem('ewm_access_token')
        setToken(null)
        setProfile(null)
      } finally {
        setLoading(false)
      }
    }

    restore()
  }, [])

  async function loginUser(email: string, password: string): Promise<UserProfile> {
    const result = await login(email, password)

    localStorage.setItem(TOKEN_KEY, result.session.access_token)
    localStorage.setItem('ewm_access_token', result.session.access_token)

    try {
      await supabase.realtime.setAuth(result.session.access_token)
    } catch (realtimeErr) {
      console.warn('[Realtime setAuth warning]:', realtimeErr)
    }

    setToken(result.session.access_token)
    setProfile(result.user)

    // Sync daily recurring work for today (idempotent)
    api('/recurring-work/sync-my-today', {
      method: 'POST',
      headers: { Authorization: `Bearer ${result.session.access_token}` },
    }).catch((err) => console.warn('[Recurring Work Sync error]:', err))

    return result.user
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem('ewm_access_token')
    setToken(null)
    setProfile(null)
    try {
      void supabase.realtime.setAuth(null as any)
    } catch {
      // ignore
    }
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
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error(
      'useAuth must be used inside AuthProvider',
    )
  }

  return context
}
