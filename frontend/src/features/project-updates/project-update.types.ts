export type UpdateFieldType =
  | 'TEXT'
  | 'NUMBER'
  | 'DATE'
  | 'PHONE'
  | 'EMAIL'
  | 'URL'
  | 'BOOLEAN'
  | 'LONG_TEXT'
  | 'DROPDOWN'

export interface ProjectUpdateField {
  id: string
  template_id: string
  field_name: string
  field_key: string
  field_type: UpdateFieldType
  is_required: boolean
  display_order: number
}

export interface ProjectUpdateTemplate {
  id: string
  project_id: string
  name: string
  title?: string
  description: string | null
  is_active: boolean
  created_by?: string
  created_at?: string
  updated_at?: string
  fields: ProjectUpdateField[]
}

export interface DailyUpdateValue {
  id: string
  daily_update_id: string
  field_id: string
  value_text: string | null
  project_update_fields?: {
    field_name: string
    field_key: string
    field_type: UpdateFieldType
    display_order: number
  }
}

export interface ProjectDailyUpdate {
  id: string
  project_id: string
  template_id?: string | null
  employee_id: string
  update_date: string
  paragraph_update?: string | null
  progress_percent: number
  created_at: string
  updated_at?: string

  profiles?: {
    id: string
    first_name: string
    last_name: string | null
    email: string | null
    employee_id: string | null
  }

  values: DailyUpdateValue[]
}
