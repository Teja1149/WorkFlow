import type { UserProfile } from '../auth/auth.types'

const API_URL = import.meta.env.VITE_API_URL || '/api'

export type ProjectStatus =
  | 'TODO'
  | 'PLANNING'
  | 'DEVELOPMENT'
  | 'TESTING'
  | 'DEPLOYMENT'
  | 'COMPLETED'
  | 'ACTIVE'
  | 'ON_HOLD'
  | 'ARCHIVED'

export interface Project {
  id: string
  organization_id: string
  name: string
  project_key: string
  description: string | null
  methodology: 'SCRUM' | 'KANBAN'
  status: ProjectStatus
  project_manager_id: string | null
  start_date: string | null
  target_date: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface ProjectMember {
  id: string
  project_id: string
  user_id: string
  created_at: string
  profiles?: UserProfile
}

async function request(
  token: string,
  url: string,
  options?: RequestInit,
) {
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

export async function getProjects(token: string) {
  const data = await request(token, '/projects')
  return (Array.isArray(data) ? data : []) as Project[]
}

export async function createProject(
  token: string,
  data: {
    name: string
    project_key: string
    description?: string
    methodology: 'SCRUM' | 'KANBAN'
    status?: ProjectStatus
    project_manager_id?: string | null
    start_date?: string | null
    target_date?: string | null
  },
) {
  return request(token, '/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  }) as Promise<Project>
}

export async function updateProject(
  token: string,
  projectId: string,
  data: {
    name?: string
    description?: string
    status?: ProjectStatus
    methodology?: 'SCRUM' | 'KANBAN'
    project_manager_id?: string | null
    start_date?: string | null
    target_date?: string | null
  },
) {
  return request(token, `/projects/${projectId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }) as Promise<Project>
}

export async function getProjectMembers(token: string, projectId: string) {
  const data = await request(token, `/projects/${projectId}/members`)
  return (Array.isArray(data) ? data : []) as ProjectMember[]
}

export async function addProjectMember(token: string, projectId: string, userId: string) {
  return request(token, `/projects/${projectId}/members`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId }),
  }) as Promise<ProjectMember>
}

export async function removeProjectMember(token: string, projectId: string, userId: string) {
  return request(token, `/projects/${projectId}/members/${userId}`, {
    method: 'DELETE',
  })
}

export async function deleteProject(token: string, projectId: string) {
  return request(token, `/projects/${projectId}`, {
    method: 'DELETE',
  })
}
