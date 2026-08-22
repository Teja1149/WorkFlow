import type { UserProfile } from '../auth/auth.types'

const API_URL = import.meta.env.VITE_API_URL || '/api'

export interface WorkItem {
  id: string
  organization_id: string
  project_id: string
  assigned_to: string | null
  created_by: string
  title: string
  description: string | null
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | 'BLOCKED'
  start_date: string | null
  deadline: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  projects?: {
    id: string
    name: string
    project_key: string
  }
  assignee?: UserProfile
  creator?: UserProfile
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

export async function getWorkItems(token: string) {
  return request(token, '/work-items') as Promise<WorkItem[]>
}

export async function createWorkItem(
  token: string,
  data: {
    project_id: string
    assigned_to?: string | null
    title: string
    description?: string
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
    start_date?: string | null
    deadline?: string | null
  },
) {
  return request(token, '/work-items', {
    method: 'POST',
    body: JSON.stringify(data),
  }) as Promise<WorkItem>
}

export async function updateWorkItem(
  token: string,
  id: string,
  data: {
    status?: WorkItem['status']
    priority?: WorkItem['priority']
    deadline?: string | null
    description?: string
  },
) {
  return request(token, `/work-items/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }) as Promise<WorkItem>
}

export async function getWorkUpdates(
  token: string,
  workItemId: string,
) {
  return request(token, `/work-items/${workItemId}/updates`)
}

export async function addWorkUpdate(
  token: string,
  workItemId: string,
  payload: {
    update_text: string
    progress_percent: number
  },
) {
  return request(token, `/work-items/${workItemId}/updates`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getWorkComments(
  token: string,
  workItemId: string,
) {
  return request(token, `/work-items/${workItemId}/comments`)
}

export async function addWorkComment(
  token: string,
  workItemId: string,
  payload: {
    comment: string
    parent_comment_id?: string | null
  },
) {
  return request(token, `/work-items/${workItemId}/comments`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getWorkConcerns(
  token: string,
  workItemId: string,
) {
  return request(token, `/work-items/${workItemId}/concerns`)
}

export async function addWorkConcern(
  token: string,
  workItemId: string,
  payload: {
    concern: string
  },
) {
  return request(token, `/work-items/${workItemId}/concerns`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function resolveWorkConcern(
  token: string,
  workItemId: string,
  concernId: string,
) {
  return request(token, `/work-items/${workItemId}/concerns/${concernId}/resolve`, {
    method: 'PATCH',
  })
}
