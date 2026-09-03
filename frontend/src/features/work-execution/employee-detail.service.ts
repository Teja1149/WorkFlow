import type { DailyWorkItem } from './work-execution.types'

export interface EmployeeWorkDetailData {
  employee: {
    id: string
    first_name: string
    last_name: string
    email: string
    employee_id: string
    role: string
  }
  summary: {
    total: number
    completed: number
    inProgress: number
    overdue: number
    critical: number
    blocked: number
    carriedForward: number
  }
  work: DailyWorkItem[]
}

const API_URL = import.meta.env.VITE_API_URL || '/api'

export async function getEmployeeWorkDetail(
  token: string,
  employeeId: string,
): Promise<EmployeeWorkDetailData> {
  const response = await fetch(
    `${API_URL}/work-execution/employees/${employeeId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  )

  const result = await response.json()

  if (!response.ok) {
    throw new Error(
      result.message || 'Unable to load employee work details.',
    )
  }

  return result.data
}
