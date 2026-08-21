import type { UserProfile } from '../auth/auth.types'

const API_URL =
  import.meta.env.VITE_API_URL ||
  'http://localhost:5000/api'

async function request(
  token: string,
  path: string,
  options: RequestInit = {},
) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  })

  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.message || 'Request failed.')
  }

  return result.data
}

export async function getEmployees(token: string) {
  return request(token, '/employees') as Promise<UserProfile[]>
}

export async function createEmployee(
  token: string,
  data: {
    email: string
    password: string
    first_name: string
    last_name?: string
    phone?: string
    designation?: string
    role: 'MANAGER' | 'EMPLOYEE'
    manager_id?: string | null
    joining_date?: string
  },
) {
  return request(token, '/employees', {
    method: 'POST',
    body: JSON.stringify(data),
  }) as Promise<UserProfile>
}

export async function updateEmployee(
  token: string,
  id: string,
  data: {
    first_name?: string
    last_name?: string
    phone?: string
    designation?: string
    manager_id?: string | null
    joining_date?: string | null
    status?: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE' | 'SUSPENDED'
  },
) {
  return request(token, `/employees/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }) as Promise<UserProfile>
}

export async function deleteEmployee(token: string, id: string) {
  return request(token, `/employees/${id}`, {
    method: 'DELETE',
  })
}
