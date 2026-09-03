import type { ProjectModule } from './project-module.types'

const API_URL =
  import.meta.env.VITE_API_URL || '/api'

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

export async function getProjectModules(
  token: string,
  projectId: string,
) {
  return request<ProjectModule[]>(
    token,
    `/projects/${projectId}/modules`,
  )
}

export async function createProjectModule(
  token: string,
  projectId: string,
  input: {
    name: string
    description?: string
    work_type_id?: string | null
  },
) {
  return request<ProjectModule>(
    token,
    `/projects/${projectId}/modules`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
}

export async function updateProjectModule(
  token: string,
  moduleId: string,
  input: {
    name?: string
    description?: string
    work_type_id?: string | null
    is_active?: boolean
  },
) {
  return request<ProjectModule>(
    token,
    `/projects/modules/${moduleId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  )
}

export async function deleteProjectModule(
  token: string,
  moduleId: string,
) {
  return request<{ success: boolean }>(
    token,
    `/projects/modules/${moduleId}`,
    {
      method: 'DELETE',
    },
  )
}
