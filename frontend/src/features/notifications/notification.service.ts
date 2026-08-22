const API_URL = import.meta.env.VITE_API_URL || '/api'

export interface NotificationItem {
  id: string
  user_id: string
  organization_id: string
  type: string
  title: string
  message: string
  work_item_id: string | null
  project_id: string | null
  is_read: boolean
  created_at: string
}

async function request(
  token: string,
  path: string,
  options?: RequestInit,
) {
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
    throw new Error(result.message || 'Notification request failed.')
  }

  return result.data
}

export async function getNotifications(token: string) {
  return request(token, '/notifications') as Promise<NotificationItem[]>
}

export async function getUnreadCount(token: string) {
  return request(token, '/notifications/unread-count') as Promise<{ count: number }>
}

export async function markNotificationRead(token: string, id: string) {
  return request(token, `/notifications/${id}/read`, {
    method: 'PATCH',
  })
}

export async function markAllNotificationsRead(token: string) {
  return request(token, '/notifications/read-all', {
    method: 'PATCH',
  })
}
