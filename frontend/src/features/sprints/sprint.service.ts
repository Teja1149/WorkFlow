import type { Sprint, SprintProgress, SprintStatus } from './sprint.types'

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

export async function createSprint(
  token: string,
  projectId: string,
  data: {
    name: string
    goal?: string
    startDate?: string
    endDate?: string
  },
) {
  return request<Sprint>(token, `/projects/${projectId}/sprints`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function getProjectSprints(token: string, projectId: string) {
  const data = await request<Sprint[]>(token, `/projects/${projectId}/sprints`)
  return Array.isArray(data) ? data : []
}

export async function getSprintById(token: string, sprintId: string) {
  return request<Sprint>(token, `/sprints/${sprintId}`)
}

export async function updateSprint(
  token: string,
  sprintId: string,
  data: {
    name?: string
    goal?: string
    startDate?: string
    endDate?: string
    status?: SprintStatus
  },
) {
  return request<Sprint>(token, `/sprints/${sprintId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function deleteSprint(token: string, sprintId: string) {
  return request<{ success: boolean }>(token, `/sprints/${sprintId}`, {
    method: 'DELETE',
  })
}

export async function startSprint(token: string, sprintId: string) {
  return request<Sprint>(token, `/sprints/${sprintId}/start`, {
    method: 'POST',
  })
}

export async function completeSprint(token: string, sprintId: string) {
  return request<Sprint>(token, `/sprints/${sprintId}/complete`, {
    method: 'POST',
  })
}

export async function cancelSprint(token: string, sprintId: string) {
  return request<Sprint>(token, `/sprints/${sprintId}/cancel`, {
    method: 'POST',
  })
}

export async function addWorkItemToSprint(
  token: string,
  sprintId: string,
  workItemId: string,
) {
  return request(token, `/sprints/${sprintId}/work-items`, {
    method: 'POST',
    body: JSON.stringify({ workItemId }),
  })
}

export async function removeWorkItemFromSprint(
  token: string,
  sprintId: string,
  workItemId: string,
) {
  return request(token, `/sprints/${sprintId}/work-items/${workItemId}`, {
    method: 'DELETE',
  })
}

export async function getSprintProgress(token: string, sprintId: string) {
  return request<SprintProgress>(token, `/sprints/${sprintId}/progress`)
}
