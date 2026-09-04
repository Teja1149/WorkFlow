export interface DailyWorkItem {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  deadline: string | null
  deadline_time: string | null
  progress_percent: number
  health: 'GREEN' | 'AMBER' | 'ORANGE' | 'RED' | 'CRITICAL'
  escalation_level: number
  carry_forward_count: number
  carried_forward_from: string | null
  assigned_to?: string | null
  project_id?: string
  module_id?: string | null
  milestone_id?: string | null
  work_type_id?: string | null

  target_quantity?: number | null
  completed_quantity?: number | null
  quantity_unit?: string | null
  pacing_start_date?: string | null
  pacing_enabled?: boolean
  pacing?: {
    enabled: boolean
    status:
      | 'NOT_TRACKED'
      | 'AHEAD'
      | 'ON_TRACK'
      | 'AT_RISK'
      | 'BEHIND'
      | 'OVERDUE'
    targetQuantity: number
    completedQuantity: number
    expectedQuantity: number
    todayTarget?: number
    backlog?: number
    isBacklog?: boolean
    remainingQuantity: number
    progressPercent: number
    totalDays: number
    elapsedDays: number
    remainingDays: number
    initialPerDay?: number
    requiredPerDay: number
    workloadIncreased?: boolean
    recommendedIntervalDays: number | null
  }

  projects?: {
    id: string
    name: string
    project_key: string
  }

  work_types?: {
    id: string
    name: string
    color?: string | null
    icon?: string | null
  }

  project_modules?: {
    id: string
    name: string
    description?: string | null
  }

  project_milestones?: {
    id: string
    name: string
    deadline?: string | null
    status?: string
  }

  milestone?: {
    id: string
    name: string
    deadline?: string | null
    status?: string
  }

  assignee?: {
    id: string
    first_name: string
    last_name: string
    email?: string
    employee_id?: string
  }
}

export interface TodayWork {
  carryForward: DailyWorkItem[]
  newWork: DailyWorkItem[]
  inProgress: DailyWorkItem[]
  atRisk: DailyWorkItem[]
  overdue: DailyWorkItem[]
  critical: DailyWorkItem[]
}
