const API_URL = import.meta.env.VITE_API_URL || '/api'

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

export type DailyReportField = ProjectReportField
export type DailyReportFieldType = ReportFieldType
export type DailyReportTemplate = ProjectReportTemplate
export type DailyReportComplianceSummary = ProjectDailyReportsSummary
export type PendingDailyReportItem = PendingReportItem

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

export interface PendingReportItem {
  project_id: string
  project_name: string
  project_key: string
  has_template: boolean
  template: ProjectReportTemplate | null
  is_submitted: boolean
  report_date?: string
  submitted_at?: string | null
  submission_id?: string | null
}

async function request(token: string, path: string, options?: RequestInit) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options?.headers || {}),
    },
  })

  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.message || 'Request failed.')
  }

  return result.data
}

export async function getProjectReportTemplate(
  token: string,
  projectId: string,
): Promise<ProjectReportTemplate | null> {
  return request(token, `/projects/${projectId}/daily-reports/template`)
}

export async function saveProjectReportTemplate(
  token: string,
  projectId: string,
  data: {
    name: string
    description?: string
    is_active?: boolean
    fields: ProjectReportField[]
  },
): Promise<ProjectReportTemplate> {
  return request(token, `/projects/${projectId}/daily-reports/template`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function submitProjectDailyReport(
  token: string,
  projectId: string,
  data: {
    report_date?: string
    answers: Record<string, any>
  },
): Promise<ProjectDailyReportSubmission> {
  return request(token, `/projects/${projectId}/daily-reports/submit`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function getProjectDailyReportsSummary(
  token: string,
  projectId: string,
  date?: string,
): Promise<ProjectDailyReportsSummary> {
  const query = date ? `?date=${encodeURIComponent(date)}` : ''
  return request(token, `/projects/${projectId}/daily-reports/summary${query}`)
}

export async function getProjectDailyReportsHistory(
  token: string,
  projectId: string,
  filters?: {
    from?: string
    to?: string
    employee_id?: string
  },
): Promise<ProjectDailyReportSubmission[]> {
  const params = new URLSearchParams()
  if (filters?.from) params.set('from', filters.from)
  if (filters?.to) params.set('to', filters.to)
  if (filters?.employee_id) params.set('employee_id', filters.employee_id)

  const queryString = params.toString() ? `?${params.toString()}` : ''
  return request(token, `/projects/${projectId}/daily-reports/history${queryString}`)
}

export async function getEmployeePendingReports(
  token: string,
  date?: string,
): Promise<PendingReportItem[]> {
  const query = date ? `?date=${encodeURIComponent(date)}` : ''
  return request(token, `/daily-reports/my-pending${query}`)
}

export const getProjectDailyReportTemplate = getProjectReportTemplate
export const saveProjectDailyReportTemplate = saveProjectReportTemplate
export const getProjectDailyReportsCompliance = getProjectDailyReportsSummary
export const getMyPendingDailyReports = getEmployeePendingReports

/**
 * Excel / CSV Exporter for Project Daily Reports
 */
export function exportDailyReportsCsv(
  projectName: string,
  summary: ProjectDailyReportsSummary,
  history: ProjectDailyReportSubmission[],
) {
  const rows: string[][] = []

  // Header summary metadata
  rows.push([`Project Daily Reports — ${projectName}`])
  rows.push([`Export Date`, new Date().toLocaleDateString()])
  rows.push([`Compliance Rate (Today)`, `${summary.compliance_rate}%`])
  rows.push([`Required Submissions`, String(summary.total_required)])
  rows.push([`Submitted`, String(summary.total_submitted)])
  rows.push([`Missing`, String(summary.total_missing)])
  rows.push([])

  // Section 1: Detailed Submissions Table
  const dynamicFields = summary.template?.fields || []
  const fieldHeaders = dynamicFields.map((f) => f.label)

  const submissionHeaders = [
    'Date',
    'Employee',
    'Email',
    'Status',
    'Submitted At',
    ...fieldHeaders,
  ]
  rows.push(submissionHeaders)

  for (const item of history) {
    const empName = item.employee
      ? `${item.employee.first_name} ${item.employee.last_name || ''}`.trim()
      : 'Unknown'
    const empEmail = item.employee?.email || ''
    const subTime = item.submitted_at ? new Date(item.submitted_at).toLocaleTimeString() : ''

    const dynamicValues = dynamicFields.map((field) => {
      const val = item.values?.[field.id] ?? item.values?.[field.field_key]
      if (val === true) return 'Yes'
      if (val === false) return 'No'
      if (val === null || val === undefined) return '-'
      return String(val).replace(/"/g, '""')
    })

    rows.push([
      item.report_date,
      empName,
      empEmail,
      item.status,
      subTime,
      ...dynamicValues,
    ])
  }

  // Generate CSV Blob
  const csvContent = rows
    .map((r) => r.map((cell) => `"${cell}"`).join(','))
    .join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `${projectName.toLowerCase().replace(/\s+/g, '_')}_daily_reports.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
