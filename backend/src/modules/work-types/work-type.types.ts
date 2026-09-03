export type WorkFieldType =
  | 'TEXT'
  | 'LONG_TEXT'
  | 'NUMBER'
  | 'DECIMAL'
  | 'BOOLEAN'
  | 'SELECT'
  | 'MULTI_SELECT'
  | 'DATE'
  | 'TIME'
  | 'HOURS'
  | 'FILE'

export interface WorkTypeField {
  id?: string
  label: string
  key: string
  type: WorkFieldType
  required: boolean
  counts_toward_target: boolean
  options?: string[]
  order: number
}

export interface WorkTypeConfig {
  measurement_type: 'COUNT' | 'HOURS' | 'POINTS' | 'PERCENTAGE' | 'CUSTOM'
  unit: string
  default_target?: number | null
  report_fields: WorkTypeField[]
  completion_rule: 'TARGET_REACHED' | 'MANUAL' | 'MILESTONE'
}

export interface ReportFieldDefinition {
  key: string
  label: string
  type: 'number' | 'text' | 'paragraph' | 'boolean' | 'date' | 'select' | WorkFieldType
  required?: boolean
  counts_toward_target?: boolean
  placeholder?: string
  options?: string[]
  display_order: number
}

export interface CreateWorkTypeInput {
  name: string
  code?: string | null
  description?: string | null
  icon?: string | null
  color?: string | null
  measurement?: 'COUNT' | 'STORY_POINTS' | 'HOURS' | 'CUSTOM' | string | null
  unit?: string | null
  default_target?: number | null
  default_period?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | string | null
  daily_target?: number | null
  report_fields?: ReportFieldDefinition[] | null
  fields?: WorkTypeField[] | null
  completion_rule?: 'TARGET_REACHED' | 'MANUAL' | 'MILESTONE' | null
}

export interface UpdateWorkTypeInput {
  name?: string
  code?: string | null
  description?: string | null
  icon?: string | null
  color?: string | null
  is_active?: boolean
  measurement?: 'COUNT' | 'STORY_POINTS' | 'HOURS' | 'CUSTOM' | string | null
  unit?: string | null
  default_target?: number | null
  default_period?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | string | null
  daily_target?: number | null
  report_fields?: ReportFieldDefinition[] | null
  fields?: WorkTypeField[] | null
  completion_rule?: 'TARGET_REACHED' | 'MANUAL' | 'MILESTONE' | null
}

export interface WorkType {
  id: string
  organization_id: string
  name: string
  code?: string | null
  description: string | null
  icon: string | null
  color: string | null
  is_active: boolean
  measurement?: string | null
  unit?: string | null
  default_target?: number | null
  default_period?: string | null
  daily_target?: number | null
  report_fields?: ReportFieldDefinition[] | null
  fields?: WorkTypeField[] | null
  completion_rule?: 'TARGET_REACHED' | 'MANUAL' | 'MILESTONE' | null
  created_by: string
  created_at: string
  updated_at: string
}
