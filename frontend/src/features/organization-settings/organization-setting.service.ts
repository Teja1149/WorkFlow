export interface OrganizationWorkSettings {
  timezone: string
  workday_start: string
  workday_end: string
  working_days: number[]
  carry_forward_time: string
  warning_minutes: number
  at_risk_minutes: number
  critical_carry_forward_count: number
}

const API_URL =
  import.meta.env.VITE_API_URL || '/api'

export async function getOrganizationWorkSettings(
  token: string,
) {
  const response = await fetch(
    `${API_URL}/organization-settings/work-settings`,
    {
      headers: {
        Authorization:
          `Bearer ${token}`,
      },
    },
  )

  const result =
    await response.json()

  if (!response.ok) {
    throw new Error(
      result.message ||
        'Unable to load work settings.',
    )
  }

  return result.data as OrganizationWorkSettings
}

export async function updateOrganizationWorkSettings(
  token: string,
  settings: Partial<OrganizationWorkSettings>,
) {
  const response = await fetch(
    `${API_URL}/organization-settings/work-settings`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(settings),
    },
  )

  const result = await response.json()

  if (!response.ok) {
    throw new Error(
      result.message || 'Unable to update work settings.',
    )
  }

  return result.data as OrganizationWorkSettings
}
