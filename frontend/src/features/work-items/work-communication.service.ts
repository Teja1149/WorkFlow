import type { UserProfile } from '../auth/auth.types'

const API_URL = import.meta.env.VITE_API_URL || '/api'

export interface WorkComment {
  id: string
  work_item_id: string
  user_id: string
  comment: string
  created_at: string
  user?: UserProfile
}

export interface WorkUpdate {
  id: string
  work_item_id: string
  user_id: string
  update_text: string
  progress_percent: number
  created_at: string
  employee?: UserProfile
}

export interface WorkConcern {
  id: string
  work_item_id: string
  reported_by: string
  concern: string
  status: 'OPEN' | 'RESOLVED'
  created_at: string
  reporter?: UserProfile
}

async function request(token: string, path: string, options?: RequestInit) {
  const response = await fetch(`${API_URL}${path}`, {
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

// Comments
export async function getWorkComments(token: string, workItemId: string) {
  return request(token, `/work-items/${workItemId}/comments`) as Promise<WorkComment[]>
}

export async function addWorkComment(token: string, workItemId: string, comment: string) {
  return request(token, `/work-items/${workItemId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ comment }),
  }) as Promise<WorkComment>
}

// Updates
export async function getWorkUpdates(token: string, workItemId: string) {
  return request(token, `/work-items/${workItemId}/updates`) as Promise<WorkUpdate[]>
}

export async function addWorkUpdate(
  token: string,
  workItemId: string,
  update_text: string,
  progress_percent: number,
) {
  return request(token, `/work-items/${workItemId}/updates`, {
    method: 'POST',
    body: JSON.stringify({ update_text, progress_percent }),
  }) as Promise<WorkUpdate>
}

// Concerns
export async function getWorkConcerns(token: string, workItemId: string) {
  return request(token, `/work-items/${workItemId}/concerns`) as Promise<WorkConcern[]>
}

export async function addWorkConcern(token: string, workItemId: string, concern: string) {
  return request(token, `/work-items/${workItemId}/concerns`, {
    method: 'POST',
    body: JSON.stringify({ concern }),
  }) as Promise<WorkConcern>
}

export async function resolveWorkConcern(token: string, concernId: string) {
  return request(token, `/work-items/concerns/${concernId}/resolve`, {
    method: 'PATCH',
  })
}
