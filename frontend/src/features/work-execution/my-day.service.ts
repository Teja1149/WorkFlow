import type { TodayWork } from './work-execution.types'

const API_URL = import.meta.env.VITE_API_URL || '/api'

export async function getMyDay(token: string) {
  const response = await fetch(
    `${API_URL}/work-execution/today`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  )

  const result = await response.json()

  if (!response.ok) {
    throw new Error(
      result.message || 'Unable to load My Day.',
    )
  }

  return result.data as TodayWork
}
