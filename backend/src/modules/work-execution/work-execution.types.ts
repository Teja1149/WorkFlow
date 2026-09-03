export type WorkHealth =
  | 'GREEN'
  | 'AMBER'
  | 'ORANGE'
  | 'RED'
  | 'CRITICAL'

export interface WorkHealthResult {
  health: WorkHealth
  escalationLevel: number
  minutesRemaining: number | null
}

export interface TodayWorkSummary {
  carryForward: any[]
  newWork: any[]
  inProgress: any[]
  atRisk: any[]
  overdue: any[]
  critical: any[]
}

export interface CompanyWorkSummary {
  total: number
  completed: number
  active: number
  pending: number
  overdue: number
  critical: number
  employees?: any[]
}
