export interface EmployeePerformance {
  employee: {
    id: string
    first_name: string
    last_name: string
    email?: string
    employee_id?: string
    role: string
  }

  totalAssigned: number
  completed: number
  completedOnTime: number
  completedLate: number
  onTimeCompletionRate: number
  averageDelayDays: number
  active: number
  overdue: number
  critical: number
  blocked: number
  carriedForward: number
  completionRate: number
  projectCount: number
  moduleCount: number

  work: any[]
}

const API_URL = import.meta.env.VITE_API_URL || '/api'

export async function getEmployeePerformance(
  token: string,
) {
  const response = await fetch(
    `${API_URL}/work-execution/employee-performance`,
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
        'Unable to load employee performance.',
    )
  }

  return result.data as EmployeePerformance[]
}
