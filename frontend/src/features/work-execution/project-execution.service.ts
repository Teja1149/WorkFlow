import type { DailyWorkItem } from './work-execution.types'
import type { ProjectMilestone } from '../project-milestones/project-milestone.types'

export interface ProjectExecutionModule {
  id: string
  project_id: string
  work_type_id?: string | null
  name: string
  description?: string | null
  is_active: boolean
  work_types?: {
    id: string
    name: string
    color?: string | null
    icon?: string | null
  }
  totalWork: number
  completed: number
  overdue: number
  critical: number
  progress: number
  memberIds: string[]
  work: DailyWorkItem[]
}

export interface ProjectExecutionData {
  project: {
    id: string
    name: string
    project_key: string
    organization_id: string
  }
  summary: {
    totalWork: number
    completed: number
    inProgress: number
    overdue: number
    critical: number
    blocked: number
    carryForward: number
    progress: number
    memberCount: number
    moduleCount: number
    milestoneCount?: number
  }
  members: Array<{
    id: string
    user_id: string
    profiles?: {
      id: string
      first_name: string
      last_name: string
      email: string
      employee_id?: string
      role: string
    }
  }>
  modules: ProjectExecutionModule[]
  milestones?: ProjectMilestone[]
  work: DailyWorkItem[]
}

const API_URL = import.meta.env.VITE_API_URL || '/api'

export async function getProjectExecution(
  token: string,
  projectId: string,
): Promise<ProjectExecutionData> {
  const response = await fetch(
    `${API_URL}/work-execution/projects/${projectId}/execution`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  )

  const result = await response.json()

  if (!response.ok) {
    throw new Error(
      result.message ||
        'Unable to load project execution.',
    )
  }

  return result.data
}
