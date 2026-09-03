export type RecurringAssignmentMode = 'ALL' | 'SELECTED'

export interface RecurringWorkTemplate {
  id: string
  organization_id: string
  created_by: string
  title: string
  description: string | null
  project_id: string | null
  work_type_id: string | null
  module_id: string | null
  milestone_id: string | null
  priority: string
  assignment_mode: RecurringAssignmentMode
  employee_ids: string[]
  frequency: 'DAILY'
  deadline_time: string | null
  is_active: boolean
  start_date: string
  end_date: string | null
  last_generated_date: string | null
  created_at: string
  updated_at: string
}

export interface CreateRecurringWorkInput {
  title: string
  description?: string | null
  project_id?: string | null
  work_type_id?: string | null
  module_id?: string | null
  milestone_id?: string | null
  priority?: string
  assignment_mode: RecurringAssignmentMode
  employee_ids?: string[]
  frequency?: 'DAILY'
  deadline_time?: string | null
  start_date: string
  end_date?: string | null
}
