export interface CreateProjectModuleInput {
  project_id: string
  work_type_id?: string | null
  name: string
  description?: string | null
}

export interface UpdateProjectModuleInput {
  name?: string
  description?: string | null
  work_type_id?: string | null
  is_active?: boolean
}

export interface ProjectModule {
  id: string
  project_id: string
  work_type_id: string | null
  name: string
  description: string | null
  is_active: boolean
  created_by: string
  created_at: string
  updated_at: string
  work_types?: {
    id: string
    name: string
    color: string | null
    icon: string | null
    is_active: boolean
  } | null
}
