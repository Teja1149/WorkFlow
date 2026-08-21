const API_URL =
  import.meta.env.VITE_API_URL ||
  'http://localhost:5000/api'

export async function getManagerDashboard(token: string) {
  const response = await fetch(`${API_URL}/dashboard/manager`, {
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
