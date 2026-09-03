export interface EmployeeCapacityData {
  employee: {
    id: string
    first_name: string
    last_name?: string
    employee_id?: string
  }
  dailyCapacityHours: number
  assignedWork: number
  estimatedRemainingHours: number
  utilizationPercent: number
  workloadStatus: 'AVAILABLE' | 'NORMAL' | 'HIGH' | 'OVERLOADED'
  assignedItems?: Array<{
    id: string
    title: string
    estimatedRemainingHours: number
  }>
  overdueCount: number
  criticalCount: number
}

const API_URL = import.meta.env.VITE_API_URL || '/api'

export async function getEmployeeCapacity(
  token: string,
): Promise<EmployeeCapacityData[]> {
  const response = await fetch(`${API_URL}/work-execution/employee-capacity`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.message || 'Unable to load employee capacity.')
  }

  return result.data
}
