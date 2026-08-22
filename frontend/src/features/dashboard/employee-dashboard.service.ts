const API_URL = import.meta.env.VITE_API_URL || '/api'

export async function getEmployeeDashboard(token: string) {
  const response = await fetch(`${API_URL}/dashboard/employee`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.message || 'Unable to load dashboard.')
  }

  return result.data
}
