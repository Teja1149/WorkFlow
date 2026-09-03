export interface OrganizationWorkSettings {
  id: string
  organization_id: string
  timezone: string
  workday_start: string
  workday_end: string
  working_days: number[]
  carry_forward_time: string
  warning_minutes: number
  at_risk_minutes: number
  critical_carry_forward_count: number
  created_at: string
  updated_at: string
}

export interface UpdateOrganizationWorkSettingsInput {
  timezone?: string
  workday_start?: string
  workday_end?: string
  working_days?: number[]
  carry_forward_time?: string
  warning_minutes?: number
  at_risk_minutes?: number
  critical_carry_forward_count?: number
}
