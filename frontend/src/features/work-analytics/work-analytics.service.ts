const API_URL = import.meta.env.VITE_API_URL || '/api'

export interface BottleneckModule {
  id: string
  name: string
  projectId: string
  projectName: string
  total: number
  overdue: number
  critical: number
  blocked: number
  carryForward: number
  remainingHours: number
  riskScore: number
}

export interface ReassignmentRecommendation {
  employee: {
    id: string
    name: string
  }
  assignedItems: Array<{
    id: string
    title: string
    estimatedRemainingHours: number
  }>
  utilization: number
  remainingHours: number
  workload: 'AVAILABLE' | 'NORMAL' | 'HIGH' | 'OVERLOADED'
}

export interface RootBlocker {
  prerequisiteId: string
  title: string
  health: string
  status: string
  assigneeName: string
  blockedItems: Array<{
    id: string
    title: string
    health: string
  }>
}

async function request<T>(token: string, path: string): Promise<T> {
  const response = await fetch(`${API_URL}/work-analytics${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const result = await response.json()
  if (!response.ok) {
    throw new Error(result.message || 'Failed to fetch analytics.')
  }

  return result.data
}

export async function getBottlenecks(token: string) {
  return request<BottleneckModule[]>(token, '/bottlenecks')
}

export async function getReassignmentRecommendations(token: string) {
  return request<ReassignmentRecommendation[]>(token, '/reassignment-recommendations')
}

export async function getRootBlockers(token: string) {
  return request<RootBlocker[]>(token, '/root-blockers')
}
