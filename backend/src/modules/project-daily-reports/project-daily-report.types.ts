export type ReportFieldType =
  | 'NUMBER'
  | 'TEXT'
  | 'PARAGRAPH'
  | 'BOOLEAN'
  | 'DATE'
  | 'TIME'
  | 'SELECT'

export interface ProjectReportField {
  id: string
  label: string
  field_key: string
  field_type: ReportFieldType
  required: boolean
  counts_toward_performance: boolean
  counts_toward_target: boolean
  options?: string[]
  sort_order: number
}

export interface ProjectReportTemplateData {
  name: string
  description?: string
  fields: ProjectReportField[]
}

export interface ProjectReportTemplate {
  id: string
  project_id: string
  organization_id: string
  name: string
  description?: string
  is_active: boolean
  fields: ProjectReportField[]
  created_by?: string | null
  created_at: string
  updated_at: string
}

export interface ReportAnswer {
  field_id: string
  label: string
  field_key: string
  field_type: ReportFieldType
  value: any
  counts_toward_performance?: boolean
  counts_toward_target?: boolean
}

export interface ProjectDailyReportSubmission {
  id: string
  project_id: string
  template_id?: string | null
  employee_id: string
  employee?: {
    id: string
    first_name: string
    last_name: string
    email?: string
    designation?: string
  }
  report_date: string
  submitted_at: string
  status: 'SUBMITTED' | 'LATE' | 'MISSING' | 'EXCUSED'
  values: Record<string, any>
  answers: ReportAnswer[]
  progress_percent: number
  created_at: string
  updated_at: string
}

export interface MemberReportStatus {
  employee_id: string
  employee_name: string
  email?: string
  role?: string
  status: 'SUBMITTED' | 'MISSING' | 'EXCUSED'
  submitted_at?: string | null
  report_id?: string | null
  values?: Record<string, any>
  answers?: ReportAnswer[]
}

export interface ProjectDailyReportsSummary {
  project_id: string
  project_name: string
  report_date: string
  template: ProjectReportTemplate | null
  total_required: number
  total_submitted: number
  total_missing: number
  compliance_rate: number
  members: MemberReportStatus[]
}
