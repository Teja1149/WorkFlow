import type { TodayWork } from './work-execution.types'

const API_URL = import.meta.env.VITE_API_URL || '/api'

async function request<T>(
  token: string,
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_URL}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options?.headers || {}),
    },
  })

  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.message || 'Request failed.')
  }

  return result.data
}

export async function getTodayWork(token: string) {
  return request<TodayWork>(
    token,
    '/work-execution/today',
  )
}

export async function refreshWorkHealth(token: string) {
  return request<{
    processed: number
    updated: number
  }>(
    token,
    '/work-execution/refresh-health',
    {
      method: 'POST',
    },
  )
}

export async function processCarryForward(
  token: string,
) {
  return request<{
    processed: number
    carriedForward: number
    nextWorkingDay: string
  }>(
    token,
    '/work-execution/process-carry-forward',
    {
      method: 'POST',
    },
  )
}

export interface AttentionCounts {
  critical: number
  overdue: number
  atRisk: number
  blocked: number
  openConcerns: number
}

export async function getAttentionCounts(token: string) {
  return request<AttentionCounts>(token, '/work-execution/attention')
}
