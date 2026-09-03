export interface ProjectMilestone {
  id: string
  project_id: string
  name: string
  description: string | null
  deadline: string
  status:
    | 'PLANNED'
    | 'IN_PROGRESS'
    | 'COMPLETED'
    | 'AT_RISK'
    | 'OVERDUE'
  progress_percent: number
  health?: 'CRITICAL' | 'RED' | 'ORANGE' | 'AMBER' | 'GREEN'
  total_work_items?: number
  completed_work_items?: number
  overdue_work_items?: number
  critical_work_items?: number
  at_risk_work_items?: number
  created_by: string
  created_at: string
  updated_at: string
}

export interface CreateProjectMilestoneInput {
  name: string
  description?: string
  deadline: string
}

export interface UpdateProjectMilestoneInput {
  name?: string
  description?: string
  deadline?: string
  status?: ProjectMilestone['status']
  progress_percent?: number
}
