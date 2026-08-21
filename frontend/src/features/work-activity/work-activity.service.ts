const API_URL =
  import.meta.env.VITE_API_URL ||
  'http://localhost:5000/api'

export interface WorkComment {
  id: string
  work_item_id: string
  user_id: string
  parent_comment_id: string | null
  comment: string
  created_at: string
  updated_at: string
  user?: {
    id: string
    first_name: string
    last_name: string | null
    role: string
  }
}

export interface WorkUpdate {
  id: string
  work_item_id: string
  employee_id: string
  update_text: string
  progress_percent: number
  created_at: string
  employee?: {
    id: string
    first_name: string
    last_name: string | null
    employee_id: string | null
  }
}

export interface WorkConcern {
  id: string
  work_item_id: string
  reported_by: string
  concern: string
  status: 'OPEN' | 'RESOLVED'
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
  reporter?: {
    id: string
    first_name: string
    last_name: string | null
    employee_id: string | null
  }
}

export interface WorkActivityItem {
  id: string
  work_item_id: string
  user_id: string
  activity_type: string
  description: string
  created_at: string
  user?: {
    id: string
    first_name: string
    last_name: string | null
    role: string
  }
}

async function request(token: string, url: string, options?: RequestInit) {
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

// Comments
export async function getComments(token: string, workItemId: string) {
  return request(token, `/work-items/${workItemId}/comments`) as Promise<WorkComment[]>
}

export async function addComment(token: string, workItemId: string, comment: string) {
  return request(token, `/work-items/${workItemId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ comment }),
  }) as Promise<WorkComment>
}

// Updates
export async function getUpdates(token: string, workItemId: string) {
  return request(token, `/work-items/${workItemId}/updates`) as Promise<WorkUpdate[]>
}

export async function addUpdate(
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
export async function getConcerns(token: string, workItemId: string) {
  return request(token, `/work-items/${workItemId}/concerns`) as Promise<WorkConcern[]>
}

export async function addConcern(token: string, workItemId: string, concern: string) {
  return request(token, `/work-items/${workItemId}/concerns`, {
    method: 'POST',
    body: JSON.stringify({ concern }),
  }) as Promise<WorkConcern>
}

export async function resolveConcern(token: string, concernId: string) {
  return request(token, `/work-items/concerns/${concernId}/resolve`, {
    method: 'PATCH',
  })
}

// Activity
export async function getActivity(token: string, workItemId: string) {
  return request(token, `/work-items/${workItemId}/activity`) as Promise<WorkActivityItem[]>
}
