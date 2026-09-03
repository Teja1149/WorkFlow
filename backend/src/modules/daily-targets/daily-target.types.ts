export type DailyTargetType =
  | 'COUNT'
  | 'HOURS'
  | 'PERCENTAGE'
  | 'MILESTONE'
  | 'CUSTOM'

export type DailyTargetStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'PARTIAL'
  | 'MISSED'
  | 'CARRIED_FORWARD'
  | 'CANCELLED'

export type DailyTargetHealth =
  | 'GREEN'
  | 'AMBER'
  | 'ORANGE'
  | 'RED'
  | 'CRITICAL'

export type DailyTargetPriority =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'URGENT'

export type DailyTargetResultReason =
  | 'COMPLETED'
  | 'NORMAL_DELAY'
  | 'DEPENDENCY'
  | 'CLIENT_WAITING'
  | 'RESOURCE_UNAVAILABLE'
  | 'TECHNICAL_ISSUE'
  | 'APPROVAL_PENDING'
  | 'UNPLANNED_WORK'
  | 'OTHER'

export interface CreateDailyTargetInput {
  employee_id: string
  project_id?: string | null
  module_id?: string | null
  milestone_id?: string | null
  sprint_id?: string | null
  work_item_id?: string | null

  title: string

  target_type?: DailyTargetType
  target_value: number
  unit: string

  deadline_date: string
  deadline_time?: string | null

  priority?: DailyTargetPriority
}

export interface UpdateDailyTargetResultInput {
  actual_value: number
  actual_hours?: number | null
  result_reason?: DailyTargetResultReason | string | null
  result_note?: string
}
