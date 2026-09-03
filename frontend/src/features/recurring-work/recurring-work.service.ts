import type {
  CreateRecurringWorkInput,
  RecurringWorkTemplate,
} from './recurring-work.types'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

async function request<T>(
  accessToken: string,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {}),
    },
  })

  const result = await response.json().catch(() => null)

  if (!response.ok || result?.success === false) {
    throw new Error(
      result?.message || 'Recurring work request failed.',
    )
  }

  return result?.data as T
}

export async function getRecurringWorkTemplates(
  accessToken: string,
): Promise<RecurringWorkTemplate[]> {
  return request<RecurringWorkTemplate[]>(
    accessToken,
    '/recurring-work',
  )
}

export async function createRecurringWork(
  accessToken: string,
  input: CreateRecurringWorkInput,
): Promise<RecurringWorkTemplate> {
  return request<RecurringWorkTemplate>(
    accessToken,
    '/recurring-work',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
}

export async function generateRecurringWork(
  accessToken: string,
): Promise<{
  date: string
  generatedCount: number
  workItemIds: string[]
}> {
  return request(
    accessToken,
    '/recurring-work/generate',
    {
      method: 'POST',
    },
  )
}

export async function archiveRecurringWork(
  accessToken: string,
  templateId: string,
): Promise<RecurringWorkTemplate> {
  return request<RecurringWorkTemplate>(
    accessToken,
    `/recurring-work/${templateId}/archive`,
    {
      method: 'PATCH',
    },
  )
}
