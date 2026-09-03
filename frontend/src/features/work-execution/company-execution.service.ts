import type { DailyWorkItem } from './work-execution.types'

export interface CompanyExecutionSummary {
  totalWork: number
  completed: number
  inProgress: number
  pending: number
  overdue: number
  critical: number
  blocked: number
  carriedForward: number
  completionRate: number
}

export interface CompanyExecutionData {
  summary: CompanyExecutionSummary
  work: DailyWorkItem[]
}

const API_URL = import.meta.env.VITE_API_URL || '/api'

export async function getCompanyExecution(
  token: string,
): Promise<CompanyExecutionData> {
  const response = await fetch(
    `${API_URL}/work-execution/company`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  )

  const result = await response.json()

  if (!response.ok) {
    throw new Error(
      result.message || 'Unable to load company execution data.',
    )
  }

  return result.data
}
