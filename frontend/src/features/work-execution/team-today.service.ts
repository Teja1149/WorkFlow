import type { TodayWork, DailyWorkItem } from './work-execution.types'

export interface TeamTodayData {
  total: number
  critical: DailyWorkItem[]
  overdue: DailyWorkItem[]
  atRisk: DailyWorkItem[]
  carriedForward: DailyWorkItem[]
  inProgress: DailyWorkItem[]
  newWork: DailyWorkItem[]
  openConcerns?: Array<{
    id: string
    workItemId: string
    workItemTitle: string
    projectName: string
    reporterName: string
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    concern: string
    createdAt: string
  }>
  work: DailyWorkItem[]
}

const API_URL = import.meta.env.VITE_API_URL || '/api'

export async function getTeamToday(
  token: string,
) {
  const response = await fetch(
    `${API_URL}/work-execution/team-today`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  )

  const result = await response.json()

  if (!response.ok) {
    throw new Error(
      result.message ||
        'Unable to load team work.',
    )
  }

  return result.data as TeamTodayData
}
