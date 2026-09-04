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

  work_type_id?: string | null
  tracking_mode?: 'COMBINED' | 'SEPARATE'
  schedule_mode?: string
  description?: string | null

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

  tracking_mode?: 'COMBINED' | 'SEPARATE'

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

export interface ProjectTargetMetrics {
  target: number
  actual: number
  remaining: number
  achievement: number
}

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
  id: string
  target_id: string
  milestone_id?: string | null
  name: string
  target_value: number
  actual_value: number
  completed_value: number
  pending_value: number
  remaining: number
  achievement: number
  deadline: string | null
  health: string
  status: string
  order_index?: number
}

export interface ProjectTargetResponse {
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

// Backward compatibility interfaces
export interface ProjectTargetConfig {
  work_type_id?: string | null
  target_value: number
  unit: string
  period: string
  deadline_date: string
  allocations: EmployeeAllocation[]
}

export interface ProjectTargetSummary {
  id?: string
  project_id: string
  project_name: string
  name?: string
  work_type_id?: string | null
  work_type_name?: string | null
  target_type?: ProjectTargetType
  target_value: number
  actual_value: number
  completed_value: number
  pending_value: number
  remaining: number
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
