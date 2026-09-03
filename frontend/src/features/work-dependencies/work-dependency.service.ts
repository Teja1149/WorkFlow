export interface WorkDependency {
  id: string
  dependency_type: string
  created_at: string
  depends_on_work_item?: {
    id: string
    title: string
    status: string
    health: string
    progress_percent: number
    deadline: string | null
  }
}

const API_URL = import.meta.env.VITE_API_URL || '/api'

export async function getWorkDependencies(
  token: string,
  workItemId: string,
): Promise<WorkDependency[]> {
  const response = await fetch(
    `${API_URL}/work-items/${workItemId}/dependencies`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  )

  const result = await response.json()

  if (!response.ok) {
    throw new Error(
      result.message || 'Unable to load dependencies.',
    )
  }

  return result.data
}

export async function addWorkDependency(
  token: string,
  workItemId: string,
  dependsOnWorkItemId: string,
): Promise<WorkDependency> {
  const response = await fetch(
    `${API_URL}/work-items/${workItemId}/dependencies`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ dependsOnWorkItemId }),
    },
  )

  const result = await response.json()

  if (!response.ok) {
    throw new Error(
      result.message || 'Unable to add dependency.',
    )
  }

  return result.data
}

export async function removeWorkDependency(
  token: string,
  dependencyId: string,
) {
  const response = await fetch(
    `${API_URL}/dependencies/${dependencyId}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  )

  const result = await response.json()

  if (!response.ok) {
    throw new Error(
      result.message || 'Unable to remove dependency.',
    )
  }

  return result.data
}
