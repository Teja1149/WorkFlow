export type AppRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'MANAGER'
  | 'EMPLOYEE'

export type EmployeeStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'ON_LEAVE'
  | 'SUSPENDED'

export interface UserProfile {
  id: string
  organization_id: string | null
  manager_id: string | null
  employee_id: string | null

  first_name: string
  last_name: string | null

  email: string | null
  phone: string | null

  avatar_url: string | null
  designation: string | null

  role: AppRole
  status: EmployeeStatus

  joining_date: string | null
  timezone: string | null
  bio: string | null

  created_at: string
  updated_at: string
}
