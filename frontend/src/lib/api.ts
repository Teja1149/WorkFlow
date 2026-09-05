import { supabase } from './supabase'

const API_URL = import.meta.env.VITE_API_URL || '/api'

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })

  // Transparent token refresh on 401
  if (response.status === 401) {
    try {
      const { data, error } = await supabase.auth.refreshSession()
      if (!error && data.session?.access_token) {
        const newAccessToken = data.session.access_token
        localStorage.setItem('ewm_auth_token', newAccessToken)
        localStorage.setItem('ewm_access_token', newAccessToken)
        if (data.session.refresh_token) {
          localStorage.setItem('ewm_refresh_token', data.session.refresh_token)
        }
        try {
          await supabase.realtime.setAuth(newAccessToken)
        } catch {}

        const headers = new Headers(options.headers || {})
        headers.set('Content-Type', 'application/json')
        headers.set('Authorization', `Bearer ${newAccessToken}`)

        response = await fetch(`${API_URL}${path}`, {
          ...options,
          headers,
        })
      }
    } catch {}
  }

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.message || 'Request failed.')
  }

  return data
}

