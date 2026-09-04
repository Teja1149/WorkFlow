import type {
  ProjectUpdateTemplate,
  ProjectUpdateField,
  ProjectDailyUpdate,
  UpdateFieldType,
} from './project-update.types'

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

export async function createProjectUpdateTemplate(
  token: string,
  projectId: string,
  data?: { name?: string; title?: string; description?: string },
) {
  return request<ProjectUpdateTemplate>(
    token,
    `/projects/${projectId}/update-template`,
    {
      method: 'POST',
      body: JSON.stringify(data || {}),
    },
  )
}

export async function addFieldsToTemplate(
  token: string,
  templateId: string,
  fields: Array<{
    field_name: string
    field_key?: string
    field_type: UpdateFieldType | string
    is_required?: boolean
    display_order?: number
  }>,
) {
  return request<ProjectUpdateField[]>(
    token,
    `/projects/update-template/${templateId}/fields`,
    {
      method: 'POST',
      body: JSON.stringify({ fields }),
    },
  )
}

export async function getProjectUpdateTemplate(
  token: string,
  projectId: string,
) {
  return request<ProjectUpdateTemplate | null>(
    token,
    `/projects/${projectId}/update-template`,
  )
}

export async function submitProjectDailyUpdate(
  token: string,
  projectId: string,
  input: {
    employeeId?: string
    updateDate?: string
    paragraphUpdate?: string
    progressPercent?: number
    values: Record<string, string | number | boolean | null>
  },
) {
  return request<ProjectDailyUpdate>(
    token,
    `/projects/${projectId}/daily-updates`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
}

export async function getProjectDailyUpdates(
  token: string,
  projectId: string,
  filters?: {
    employeeId?: string
    fromDate?: string
    toDate?: string
  },
) {
  const params = new URLSearchParams()

  if (filters?.employeeId) {
    params.set('employeeId', filters.employeeId)
  }

  if (filters?.fromDate) {
    params.set('fromDate', filters.fromDate)
  }

  if (filters?.toDate) {
    params.set('toDate', filters.toDate)
  }

  const query = params.toString()

  const data = await request<ProjectDailyUpdate[]>(
    token,
    `/projects/${projectId}/daily-updates${query ? `?${query}` : ''}`,
  )

  return Array.isArray(data) ? data : []
}

export async function getCompanyDailyUpdates(
  token: string,
  filters?: {
    employeeId?: string
    fromDate?: string
    toDate?: string
  },
) {
  const params = new URLSearchParams()

  if (filters?.employeeId) {
    params.set('employeeId', filters.employeeId)
  }
  if (filters?.fromDate) {
    params.set('fromDate', filters.fromDate)
  }
  if (filters?.toDate) {
    params.set('toDate', filters.toDate)
  }

  const query = params.toString()

  const data = await request<ProjectDailyUpdate[]>(
    token,
    `/company/daily-updates${query ? `?${query}` : ''}`,
  )

  return Array.isArray(data) ? data : []
}
