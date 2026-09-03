import type {
  DailyTarget,
} from './daily-target.types'

const API_URL =
  import.meta.env.VITE_API_URL || '/api'

async function request<T>(
  token: string,
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(
    `${API_URL}${url}`,
    {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization:
          `Bearer ${token}`,
        ...(options?.headers || {}),
      },
    },
  )

  const result =
    await response.json()

  if (!response.ok) {
    throw new Error(
      result.message ||
        'Request failed.',
    )
  }

  return result.data
}

export async function createDailyTarget(
  token: string,
  input: Record<string, unknown>,
) {
  return request<DailyTarget>(
    token,
    '/daily-targets',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
}

export async function createDailyTargetWithWorkItem(
  token: string,
  input: Record<string, unknown>,
) {
  return request<{ workItem: any; target: DailyTarget }>(
    token,
    '/daily-targets/with-work-item',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
}

export async function getEmployeeDailyTargets(
  token: string,
  employeeId: string,
  date?: string,
) {
  const params =
    date
      ? `?date=${encodeURIComponent(date)}`
      : ''

  return request<DailyTarget[]>(
    token,
    `/daily-targets/employees/${employeeId}${params}`,
  )
}

export async function getTeamDailyTargets(
  token: string,
  date?: string,
) {
  const query = date
    ? `?date=${encodeURIComponent(date)}`
    : ''

  return request<{
    date: string
    summary: {
      total: number
      completed: number
      partial: number
      missed?: number
      pending: number
      carriedForward: number
      achievement: number
    }
    employees: any[]
    targets: DailyTarget[]
  }>(
    token,
    `/daily-targets/team${query}`,
  )
}

export async function updateDailyTargetResult(
  token: string,
  targetId: string,
  input: {
    actual_value: number
    actual_hours?: number | null
    result_reason?: string | null
    result_note?: string
  },
) {
  return request<DailyTarget>(
    token,
    `/daily-targets/${targetId}/result`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  )
}

export async function updateDailyTarget(
  token: string,
  targetId: string,
  input: {
    title?: string
    target_value?: number
    deadline_date?: string
    deadline_time?: string | null
    priority?: string
  },
) {
  return request<DailyTarget>(
    token,
    `/daily-targets/${targetId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  )
}

export async function cancelDailyTarget(
  token: string,
  targetId: string,
) {
  return request<DailyTarget>(
    token,
    `/daily-targets/${targetId}/cancel`,
    {
      method: 'POST',
    },
  )
}

export async function getEmployeeTargetPerformance(
  token: string,
  employeeId: string,
  from?: string,
  to?: string,
) {
  const params = new URLSearchParams()

  if (from) params.set('from', from)
  if (to) params.set('to', to)

  const query =
    params.toString()
      ? `?${params.toString()}`
      : ''

  return request<{
    employeeId: string
    summary: {
      total: number
      completed: number
      partial: number
      missed: number
      totalTarget: number
      totalActual: number
      achievement: number
      carryForward: number
      onTimePercent: number
    }
    reasonCounts: Record<string, number>
    results: any[]
  }>(
    token,
    `/daily-targets/performance/employees/${employeeId}${query}`,
  )
}

export async function getTeamTargetPerformance(
  token: string,
  from?: string,
  to?: string,
) {
  const params = new URLSearchParams()

  if (from) params.set('from', from)
  if (to) params.set('to', to)

  const query =
    params.toString()
      ? `?${params.toString()}`
      : ''

  return request<
    Array<{
      employee: {
        id: string
        first_name: string
        last_name: string
        employee_id?: string
      }
      total: number
      completed: number
      partial: number
      missed: number
      carryForward: number
      targetValue: number
      actualValue: number
      achievement: number
    }>
  >(
    token,
    `/daily-targets/performance/team${query}`,
  )
}

export async function getCompanyTargetSummary(
  token: string,
  from?: string,
  to?: string,
) {
  const params = new URLSearchParams()

  if (from) {
    params.set('from', from)
  }

  if (to) {
    params.set('to', to)
  }

  const query =
    params.toString()
      ? `?${params.toString()}`
      : ''

  return request<{
    summary: {
      total: number
      completed: number
      partial: number
      missed: number
      carriedForward: number
      targetValue: number
      actualValue: number
      achievement: number
      onTimePercent: number
    }
    reasonCounts: Record<string, number>
    daily: Array<{
      date: string
      targets: number
      completed: number
      partial: number
      missed: number
      targetValue: number
      actualValue: number
      achievement: number
    }>
    projects: Array<{
      id: string
      name: string
      total: number
      completed: number
      partial: number
      missed: number
      carryForward: number
      carryForwardRate: number
      achievement: number
      onTimeRate: number
      health: string
    }>
    workTypes: Array<{
      id: string
      name: string
      total: number
      completed: number
      partial: number
      missed: number
      achievement: number
    }>
    employees: Array<{
      employee: {
        id: string
        first_name: string
        last_name: string
        employee_id?: string
        email?: string
      }
      total: number
      completed: number
      partial: number
      missed: number
      carryForward: number
      carryForwardRate: number
      missedRate: number
      onTimeRate: number
      achievement: number
    }>
  }>(
    token,
    `/daily-targets/performance/company${query}`,
  )
}

export async function getEmployeeTargetHistory(
  token: string,
  employeeId: string,
  from?: string,
  to?: string,
) {
  const params = new URLSearchParams()

  if (from) {
    params.set('from', from)
  }

  if (to) {
    params.set('to', to)
  }

  const query =
    params.toString()
      ? `?${params.toString()}`
      : ''

  return request<any[]>(
    token,
    `/daily-targets/history/employees/${employeeId}${query}`,
  )
}

export async function getProjectDailyTargets(
  token: string,
  projectId: string,
  date?: string,
) {
  const params = date ? `?date=${encodeURIComponent(date)}` : ''
  return request<DailyTarget[]>(
    token,
    `/daily-targets/projects/${projectId}${params}`,
  )
}

export async function getDailyResultsReport(
  token: string,
  filters: {
    from?: string
    to?: string
    employeeId?: string
    projectId?: string
    status?: string
    reason?: string
  } = {},
) {
  const params = new URLSearchParams()
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  if (filters.employeeId) params.set('employeeId', filters.employeeId)
  if (filters.projectId) params.set('projectId', filters.projectId)
  if (filters.status) params.set('status', filters.status)
  if (filters.reason) params.set('reason', filters.reason)

  const query = params.toString() ? `?${params.toString()}` : ''
  return request<any[]>(token, `/daily-targets/results${query}`)
}

export async function getCompanyTodayTargets(
  token: string,
  date?: string,
) {
  const query = date
    ? `?date=${encodeURIComponent(date)}`
    : ''

  return request<any>(
    token,
    `/daily-targets/company-today${query}`,
  )
}
