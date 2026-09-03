const API_URL = import.meta.env.VITE_API_URL || '/api'

export async function getSprintExecution(
  token: string,
  sprintId: string,
) {
  const response = await fetch(
    `${API_URL}/sprints/${sprintId}/execution`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  )

  const result = await response.json()

  if (!response.ok) {
    throw new Error(
      result.message ||
        'Unable to load sprint execution.',
    )
  }

  return result.data
}

export async function getSprintCapacity(
  token: string,
  sprintId: string,
) {
  const response = await fetch(
    `${API_URL}/sprints/${sprintId}/capacity`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  )

  const result = await response.json()

  if (!response.ok) {
    throw new Error(
      result.message ||
        'Unable to load sprint capacity.',
    )
  }

  return result.data
}

export async function getSprintRetrospective(
  token: string,
  sprintId: string,
) {
  const response = await fetch(
    `${API_URL}/sprints/${sprintId}/retrospective`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  )

  const result = await response.json()

  if (!response.ok) {
    throw new Error(
      result.message ||
        'Unable to load sprint retrospective.',
    )
  }

  return result.data
}

export async function saveSprintRetrospective(
  token: string,
  sprintId: string,
  data: {
    wentWell?: string
    problems?: string
    improvements?: string
    action_items?: string
  },
) {
  const response = await fetch(
    `${API_URL}/sprints/${sprintId}/retrospective`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    },
  )

  const result = await response.json()

  if (!response.ok) {
    throw new Error(
      result.message ||
        'Unable to save sprint retrospective.',
    )
  }

  return result.data
}
