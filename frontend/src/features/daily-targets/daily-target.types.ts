export interface DailyTarget {
  id: string
  organization_id: string
  employee_id: string

  project_id: string | null
  module_id: string | null
  milestone_id: string | null
  sprint_id: string | null
  work_item_id: string | null

  title: string

  target_type:
    | 'COUNT'
    | 'HOURS'
    | 'PERCENTAGE'
    | 'MILESTONE'
    | 'CUSTOM'

  target_value: number
  unit: string

  deadline_date: string
  deadline_time: string | null

  priority:
    | 'LOW'
    | 'MEDIUM'
    | 'HIGH'
    | 'URGENT'

  status:
    | 'OPEN'
    | 'IN_PROGRESS'
    | 'COMPLETED'
    | 'PARTIAL'
    | 'MISSED'
    | 'CARRIED_FORWARD'
    | 'CANCELLED'

  health?:
    | 'GREEN'
    | 'AMBER'
    | 'ORANGE'
    | 'RED'
    | 'CRITICAL'

  achievement?: number
  remaining?: number

  actual_value: number
  actual_hours?: number | null
  result_reason?: string | null
  result_note: string | null

  carry_forward_value: number
  carried_forward_from: string | null
  carry_forward_count: number

  completed_at: string | null
  created_at: string
  updated_at: string

  projects?: {
    id: string
    name: string
    project_key: string
  }

  project_modules?: {
    id: string
    name: string
  }

  project_milestones?: {
    id: string
    name: string
    deadline: string
  }

  sprints?: {
    id: string
    name: string
    status: string
  }

  employee?: {
    id: string
    first_name: string
    last_name: string
    email: string
    employee_id?: string
  }
}
