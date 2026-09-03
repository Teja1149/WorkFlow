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
    throw new Error(result.error || result.message || 'Request failed.')
  }

  return result.data
}

export type ProjectTargetPeriod =
  | 'DAILY'
  | 'WEEKLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'CUSTOM'

export type ProjectTargetType =
  | 'COUNT'
  | 'HOURS'
  | 'POINTS'
  | 'PERCENTAGE'
  | 'CUSTOM'

export interface EmployeeAllocation {
  id?: string
  target_id?: string
  employee_id: string
  allocated_value: number
  actual_value?: number
  employee_name?: string
  completed_value?: number
  pending_value?: number
  remaining?: number
  achievement?: number
  days_remaining?: number
  required_pace?: number
}

export interface ProjectTargetMilestone {
  id?: string
  target_id?: string
  milestone_id?: string | null
  name: string
  target_value: number
  actual_value?: number
  completed_value?: number
  pending_value?: number
  remaining?: number
  achievement?: number
  deadline?: string | null
  health?: string
  status?: string
  order_index?: number
}

export interface ProjectTarget {
  id: string
  project_id: string
  project_name?: string
  name: string
  description?: string | null
  target_type: ProjectTargetType
  unit: string
  target_value: number
  actual_value: number
  completed_value: number
  pending_value: number
  remaining: number
  achievement: number
  status: string
  health: 'GREEN' | 'AMBER' | 'RED'
  period_type: ProjectTargetPeriod
  period_start: string
  period_end: string
  deadline_date?: string | null
  deadline_time?: string | null
  schedule_mode?: string
  work_type_id?: string | null
  days_remaining: number
  required_pace: number
  allocations: EmployeeAllocation[]
  milestones: ProjectTargetMilestone[]
  created_at: string
  updated_at: string
}

export interface CreateProjectTargetInput {
  project_id: string
  name: string
  target_type?: ProjectTargetType
  unit?: string
  target_value: number
  period_type?: ProjectTargetPeriod
  period_start: string
  period_end: string
  deadline_date?: string | null
  deadline_time?: string | null
  schedule_mode?: 'AUTOMATIC_DAILY' | 'MILESTONE' | 'MANUAL' | string
  description?: string | null
  work_type_id?: string | null
  allocations?: Array<{
    employee_id: string
    allocated_value: number
  }>
  milestones?: Array<{
    milestone_id?: string | null
    name: string
    target_value: number
    deadline?: string | null
  }>
}

export interface UpdateProjectTargetInput {
  name?: string
  description?: string | null
  target_type?: ProjectTargetType
  unit?: string
  target_value?: number
  period_type?: ProjectTargetPeriod
  period_start?: string
  period_end?: string
  deadline_date?: string | null
  deadline_time?: string | null
  schedule_mode?: string
  status?: string
  health?: 'GREEN' | 'AMBER' | 'RED'
  work_type_id?: string | null
  allocations?: Array<{
    employee_id: string
    allocated_value: number
  }>
  milestones?: Array<{
    id?: string
    milestone_id?: string | null
    name: string
    target_value: number
    deadline?: string | null
    status?: string
    health?: string
  }>
}

export interface ProjectTargetSummary {
  id?: string
  project_id: string
  project_name: string
  name?: string
  work_type_id?: string | null
  target_type?: ProjectTargetType
  target_value: number
  actual_value?: number
  completed_value: number
  pending_value: number
  remaining?: number
  achievement: number
  unit: string
  period: string
  period_type?: ProjectTargetPeriod
  period_start?: string
  period_end?: string
  deadline_date: string
  deadline_time?: string | null
  days_remaining: number
  required_pace: number
  health: 'GREEN' | 'AMBER' | 'RED'
  status?: string
  allocations: EmployeeAllocation[]
  milestones: Array<{
    id: string
    name: string
    target_value: number
    completed_value: number
    pending_value: number
    deadline: string | null
    health: string
    status: string
  }>
}

export interface SetProjectTargetInput {
  name?: string
  work_type_id?: string | null
  target_type?: ProjectTargetType
  target_value: number
  unit: string
  period?: string
  period_type?: ProjectTargetPeriod
  period_start?: string
  period_end?: string
  deadline_date: string
  deadline_time?: string | null
  allocations?: Array<{
    employee_id: string
    allocated_value: number
  }>
}

export interface EmployeeWorkload {
  projects: Array<{
    project_id: string
    project_name: string
    target: number
    done: number
    pending: number
    achievement: number
    unit: string
    days_remaining: number
    required_pace: number
    deadline_date: string
  }>
  totals: {
    target: number
    done: number
    pending: number
    achievement: number
  }
  today: {
    planned_output: number
    completed: number
    remaining: number
    targets_count: number
    completed_count: number
  }
}

export async function createProjectTarget(
  token: string,
  input: CreateProjectTargetInput,
): Promise<ProjectTarget> {
  return request<ProjectTarget>(token, '/project-targets', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function getProjectTargets(
  token: string,
  projectId: string,
): Promise<ProjectTarget[]> {
  return request<ProjectTarget[]>(token, `/project-targets/project/${projectId}`)
}

export async function getProjectTargetById(
  token: string,
  targetId: string,
): Promise<ProjectTarget> {
  return request<ProjectTarget>(token, `/project-targets/details/${targetId}`)
}

export async function updateProjectTarget(
  token: string,
  targetId: string,
  input: UpdateProjectTargetInput,
): Promise<ProjectTarget> {
  return request<ProjectTarget>(token, `/project-targets/${targetId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function deleteProjectTarget(
  token: string,
  targetId: string,
): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(token, `/project-targets/${targetId}`, {
    method: 'DELETE',
  })
}

export async function getProjectTargetSummary(
  token: string,
  projectId: string,
): Promise<ProjectTargetSummary | null> {
  return request<ProjectTargetSummary | null>(
    token,
    `/project-targets/${projectId}`,
  )
}

export async function setProjectTarget(
  token: string,
  projectId: string,
  input: SetProjectTargetInput,
): Promise<ProjectTargetSummary> {
  return request<ProjectTargetSummary>(
    token,
    `/project-targets/${projectId}`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
}

export async function generateDailyTargetsFromProject(
  token: string,
  projectId: string,
) {
  return request<any[]>(
    token,
    `/project-targets/${projectId}/generate-daily`,
    {
      method: 'POST',
    },
  )
}

export async function getEmployeeWorkload(
  token: string,
  employeeId?: string,
): Promise<EmployeeWorkload> {
  const path = employeeId
    ? `/project-targets/workload/${employeeId}`
    : '/project-targets/workload'
  return request<EmployeeWorkload>(token, path)
}

export interface TeamCapacityItem {
  employee_id: string
  name: string
  current_workload: number
  daily_capacity: number
  status: 'OVERLOADED' | 'TIGHT' | 'CAPACITY_AVAILABLE'
}

export async function getTeamCapacityPreview(
  token: string,
): Promise<TeamCapacityItem[]> {
  return request<TeamCapacityItem[]>(token, '/project-targets/team-capacity-preview')
}
