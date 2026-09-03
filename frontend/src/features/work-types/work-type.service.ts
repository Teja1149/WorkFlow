import type {
  WorkType,
  CreateWorkTypeInput,
  UpdateWorkTypeInput,
} from './work-type.types'

const API_URL =
  import.meta.env.VITE_API_URL || '/api'

async function request<T>(
  token: string,
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(
    `${API_URL}${url}`,
    {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options?.headers || {}),
      },
    },
  )

  const result = await response.json()

  if (!response.ok) {
    throw new Error(
      result.message || 'Request failed.',
    )
  }

  return result.data
}

export async function getWorkTypes(
  token: string,
) {
  return request<WorkType[]>(
    token,
    '/work-types',
  )
}

export async function createWorkType(
  token: string,
  input: CreateWorkTypeInput,
) {
  return request<WorkType>(
    token,
    '/work-types',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
}

export async function updateWorkType(
  token: string,
  workTypeId: string,
  input: UpdateWorkTypeInput,
) {
  return request<WorkType>(
    token,
    `/work-types/${workTypeId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  )
}

export async function archiveWorkType(
  token: string,
  workTypeId: string,
) {
  return request<WorkType>(
    token,
    `/work-types/${workTypeId}/archive`,
    {
      method: 'POST',
    },
  )
}

export async function deleteWorkType(
  token: string,
  workTypeId: string,
) {
  return request<{ success: boolean }>(
    token,
    `/work-types/${workTypeId}`,
    {
      method: 'DELETE',
    },
  )
}
