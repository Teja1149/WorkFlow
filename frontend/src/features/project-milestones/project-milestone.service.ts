import type {
  ProjectMilestone,
  CreateProjectMilestoneInput,
  UpdateProjectMilestoneInput,
} from './project-milestone.types'

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
    throw new Error(result.message || 'Request failed.')
  }

  return result.data
}

export async function getProjectMilestones(
  token: string,
  projectId: string,
) {
  return request<ProjectMilestone[]>(
    token,
    `/projects/${projectId}/milestones`,
  )
}

export async function createProjectMilestone(
  token: string,
  projectId: string,
  input: CreateProjectMilestoneInput,
) {
  return request<ProjectMilestone>(
    token,
    `/projects/${projectId}/milestones`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
}

export async function updateProjectMilestone(
  token: string,
  milestoneId: string,
  input: UpdateProjectMilestoneInput,
) {
  return request<ProjectMilestone>(
    token,
    `/projects/milestones/${milestoneId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  )
}

export async function deleteProjectMilestone(
  token: string,
  milestoneId: string,
) {
  return request<{ success: boolean }>(
    token,
    `/projects/milestones/${milestoneId}`,
    {
      method: 'DELETE',
    },
  )
}
