import type { UserProfile } from '../auth/auth.types'

const API_URL = import.meta.env.VITE_API_URL || '/api'

export interface WorkItem {
  id: string
  organization_id: string
  project_id: string
  work_type_id: string | null
  module_id?: string | null
  milestone_id: string | null
  assigned_to: string | null
  created_by: string
  title: string
  description: string | null
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  status: 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE'
  start_date: string | null
  deadline: string | null
  deadline_time: string | null
  original_deadline?: string | null
  progress_percent?: number
  health?: 'GREEN' | 'AMBER' | 'ORANGE' | 'RED' | 'CRITICAL'
  estimated_hours?: number | null
  actual_hours?: number | null
  story_points?: number | null
  carry_forward_count?: number | null
  completed_at: string | null
  created_at: string
  updated_at: string
  projects?: {
    id: string
    name: string
    project_key: string
  }
  work_types?: {
    id: string
    name: string
    description?: string | null
    icon?: string | null
    color?: string | null
    is_active?: boolean
  }
  work_type?: {
    id: string
    name: string
    description?: string | null
    icon?: string | null
    color?: string | null
    is_active?: boolean
  }
  project_modules?: {
    id: string
    name: string
    description?: string | null
    is_active?: boolean
  }
  module?: {
    id: string
    name: string
    description?: string | null
    is_active?: boolean
  }
  project_milestones?: {
    id: string
    name: string
    deadline: string
    status: string
    progress_percent?: number
  }
  milestone?: {
    id: string
    name: string
    deadline: string
    status: string
    progress_percent?: number
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
    work_type_id?: string | null
    module_id?: string | null
    milestone_id?: string | null
    assigned_to?: string | null
    title: string
    description?: string
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
    start_date?: string | null
    deadline?: string | null
    deadline_time?: string | null
    estimated_hours?: number | null
    actual_hours?: number | null
    story_points?: number | null
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
    deadline_time?: string | null
    title?: string
    description?: string | null
    assigned_to?: string | null
    work_type_id?: string | null
    module_id?: string | null
    milestone_id?: string | null
    estimated_hours?: number | null
    actual_hours?: number | null
    progress_percent?: number
    assignment_reason?: string
  },
) {
  return request(token, `/work-items/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }) as Promise<WorkItem>
}

// Step 500 — Unified status transition service
export async function updateWorkItemStatus(
  token: string,
  id: string,
  status:
    | 'TODO'
    | 'IN_PROGRESS'
    | 'BLOCKED'
    | 'DONE',
  notes?: string,
) {
  return request(token, `/work-items/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, notes }),
  }) as Promise<WorkItem>
}

export const transitionWorkItemStatus = updateWorkItemStatus

export interface WorkAssignmentHistory {
  id: string
  work_item_id: string
  previous_assignee: string | null
  new_assignee: string | null
  changed_by: string | null
  reason: string | null
  created_at: string
  prev_user?: UserProfile
  next_user?: UserProfile
  changer?: UserProfile
}

export async function getWorkAssignmentHistory(
  token: string,
  workItemId: string,
) {
  return request(token, `/work-items/${workItemId}/assignment-history`) as Promise<WorkAssignmentHistory[]>
}

export async function getWorkUpdates(
  token: string,
  workItemId: string,
) {
  return request(token, `/work-items/${workItemId}/updates`)
}

export interface AddWorkUpdateInput {
  update_text: string
  report_data?: Record<string, unknown>
  actual_value?: number
  progress_percent?: number
}

export async function addWorkUpdate(
  token: string,
  workItemId: string,
  payload: AddWorkUpdateInput | string,
) {
  const body = typeof payload === 'string' ? { update_text: payload } : payload
  return request(token, `/work-items/${workItemId}/updates`, {
    method: 'POST',
    body: JSON.stringify(body),
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
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
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
  payload?: {
    resolution_note?: string
  },
) {
  return request(token, `/work-items/${workItemId}/concerns/${concernId}/resolve`, {
    method: 'PATCH',
    body: payload ? JSON.stringify(payload) : undefined,
  })
}

