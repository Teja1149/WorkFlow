const API_URL = import.meta.env.VITE_API_URL || '/api'

export interface AdminDashboardData {
  metrics: {
    activeProjects: number
    worksAssigned: number
    inProgress: number
    completedToday: number
    overdue: number
    carryForward: number
    dueToday: number
    atRisk: number
  }
  pulse: {
    assigned: number
    completed: number
    inProgress: number
    overdue: number
    pending: number
    percentage: number
  }
  overdueWork: Array<{
    id: string
    employeeName: string
    workTitle: string
    projectName: string
    pendingCount: string
    deadlineText: string
    isCritical: boolean
  }>
  carriedForwardWork: Array<{
    id: string
    employeeName: string
    projectName: string
    workTitle: string
    remaining: number
    days: number
    isCritical: boolean
  }>
  projectHealth: Array<{
    id: string
    name: string
    targetFormatted: string
    done: number
    pending: number
    achievement: number
    health: 'GREEN' | 'AMBER' | 'RED'
  }>
  teamWorkload: Array<{
    id: string
    name: string
    assigned: number
    done: number
    pending: number
    load: 'GREEN' | 'AMBER' | 'RED'
  }>
  liveActivity: Array<{
    id: string
    time: string
    text: string
    projectName?: string
  }>
  serverTime: string
}

export async function getAdminDashboard(token: string): Promise<AdminDashboardData> {
  const response = await fetch(`${API_URL}/dashboard/admin`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })

  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.message || 'Failed to load admin dashboard.')
  }

  return result.data
}

export async function getManagerDashboard(token: string): Promise<any> {
  const response = await fetch(`${API_URL}/dashboard/manager`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })

  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.message || 'Failed to load manager dashboard.')
  }

  return result.data
}

export async function getEmployeeDashboard(token: string): Promise<any> {
  const response = await fetch(`${API_URL}/dashboard/employee`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })

  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.message || 'Failed to load employee dashboard.')
  }

  return result.data
}

export interface LiveOverviewData {
  generatedAt: string
  timezone: string
  today: string
  summary: {
    projects: number
    assigned: number
    active: number
    completedToday: number
    overdue: number
    carriedForward: number
    dueToday: number
    atRisk: number
    blocked: number
  }
  pulse: {
    assigned: number
    completed: number
    inProgress: number
    overdue: number
    pending: number
    percentage: number
  }
  attention: {
    overdue: Array<{
      id: string
      title: string
      status: string
      health: string
      priority: string
      deadline?: string
      deadline_time?: string
      progress_percent?: number
      carry_forward_count?: number
      assigneeName: string
      projectName: string
    }>
    carriedForward: Array<{
      id: string
      title: string
      status: string
      health: string
      priority: string
      deadline?: string
      carry_forward_count?: number
      assigneeName: string
      projectName: string
    }>
    atRisk: Array<{
      id: string
      title: string
      status: string
      health: string
      priority: string
      assigneeName: string
      projectName: string
    }>
    blocked: Array<{
      id: string
      title: string
      status: string
      health: string
      assigneeName: string
      projectName: string
    }>
  }
  projectHealth: Array<{
    id: string
    name: string
    project_key?: string
    total: number
    completed: number
    inProgress: number
    overdue: number
    progress: number
    health: 'GREEN' | 'AMBER' | 'ORANGE' | 'RED'
  }>
  teamWorkload: Array<{
    id: string
    name: string
    role?: string
    activeTasks: number
    completedToday: number
    overdue: number
    carriedForward: number
    loadStatus: 'NORMAL' | 'HIGH' | 'OVERLOADED'
  }>
  liveActivity: Array<{
    id: string
    createdAt: string
    updateText?: string
    progressPercent?: number
    actorName: string
    workItemTitle: string
  }>
  freshness: {
    generatedAt: string
    source: string
  }
}

export async function getLiveOverview(token: string): Promise<LiveOverviewData> {
  const response = await fetch(`${API_URL}/work-execution/live-overview`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })

  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.message || 'Failed to load live overview.')
  }

  return result.data
}

