export type MilestoneHealth = 'CRITICAL' | 'RED' | 'ORANGE' | 'AMBER' | 'GREEN'

export interface CreateProjectMilestoneInput {
  project_id: string
  name: string
  description?: string | null
  deadline?: string | null
  status?: string
}

export interface UpdateProjectMilestoneInput {
  name?: string
  description?: string | null
  deadline?: string | null
  status?: string
}

export interface ProjectMilestone {
  id: string
  project_id: string
  name: string
  description: string | null
  status: string
  deadline: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  health?: MilestoneHealth
  progress_percent?: number
  total_work_items?: number
  completed_work_items?: number
  overdue_work_items?: number
  critical_work_items?: number
  at_risk_work_items?: number
}
