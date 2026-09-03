export type SprintStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'

export interface SprintWorkItem {
  id: string
  sprint_id: string
  work_item_id: string
  created_at: string
  work_items?: {
    id: string
    title: string
    description?: string | null
    priority?: string | null
    status?: string | null
    assigned_to?: string | null
    deadline?: string | null
    progress_percent?: number | null
  }
}

export interface Sprint {
  id: string
  project_id: string
  name: string
  goal?: string | null
  status: SprintStatus
  start_date?: string | null
  end_date?: string | null
  created_by?: string
  created_at: string
  updated_at?: string
  projects?: {
    id: string
    name: string
    project_key: string
  }
  sprint_work_items?: SprintWorkItem[]
}

export interface SprintProgress {
  totalItems: number
  completedItems: number
  progressPercent: number
}
