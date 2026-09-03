const API_URL = import.meta.env.VITE_API_URL || '/api'

export interface CompanyOperationsData {
  summary: {
    total: number
    active: number
    completed: number
    overdue: number
    critical: number
    atRisk: number
    blocked: number
    carriedForward: number
    completionRate: number
  }
  attention: {
    critical: any[]
    overdue: any[]
    atRisk: any[]
    blocked: any[]
    carriedForward: any[]
    concerns: any[]
  }
  work: any[]
}

export async function getCompanyOperations(token: string): Promise<CompanyOperationsData> {
  const response = await fetch(`${API_URL}/company-operations`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.message || 'Unable to load company operations.')
  }

  return result.data
}
