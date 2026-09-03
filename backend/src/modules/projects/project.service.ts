import { supabaseAdmin } from '../../lib/supabase.js'

const VALID_DB_STATUSES = new Set([
  'PLANNING',
  'ACTIVE',
  'ON_HOLD',
  'COMPLETED',
  'ARCHIVED',
])

function formatProjectOutput(project: any) {
  if (!project) return project
  let status = project.status
  let description = project.description || ''

  const statusMatch = description.match(/^\[STATUS:([A-Z_]+)\]\s*/)
  if (statusMatch) {
    status = statusMatch[1]
    description = description.replace(/^\[STATUS:[A-Z_]+\]\s*/, '')
  }

  return {
    ...project,
    status,
    description: description || null,
  }
}

function prepareStatusAndDescription(
  rawStatus?: string,
  rawDescription?: string,
  existingDesc?: string | null,
) {
  let finalStatus = rawStatus
  let finalDescription = rawDescription

  if (rawStatus) {
    const uppercaseStatus = rawStatus.toUpperCase()
    if (!VALID_DB_STATUSES.has(uppercaseStatus)) {
      let baseDbStatus = 'ACTIVE'
      if (uppercaseStatus === 'TODO' || uppercaseStatus === 'PLANNING') {
        baseDbStatus = 'PLANNING'
      } else if (uppercaseStatus === 'COMPLETED') {
        baseDbStatus = 'COMPLETED'
      }

      finalStatus = baseDbStatus

      let baseDesc =
        rawDescription !== undefined
          ? rawDescription || ''
          : existingDesc || ''
      baseDesc = baseDesc.replace(/^\[STATUS:[A-Z_]+\]\s*/, '').trim()
      finalDescription = `[STATUS:${uppercaseStatus}] ${baseDesc}`.trim()
    } else {
      let baseDesc =
        rawDescription !== undefined
          ? rawDescription || ''
          : existingDesc || ''
      finalDescription =
        baseDesc.replace(/^\[STATUS:[A-Z_]+\]\s*/, '').trim() || undefined
    }
  }

  return { finalStatus, finalDescription }
}

export async function getProjects(
  organizationId: string,
  userId: string,
  role: string,
) {
  let query = supabaseAdmin
    .from('projects')
    .select(`
      id,
      organization_id,
      name,
      project_key,
      description,
      methodology,
      status,
      project_manager_id,
      start_date,
      target_date,
      created_by,
      created_at,
      updated_at
    `)
    .eq('organization_id', organizationId)

  if (role === 'MANAGER') {
    query = query.eq('project_manager_id', userId)
  } else if (role === 'EMPLOYEE') {
    const [memberRes, workRes, managerRes] = await Promise.all([
      supabaseAdmin
        .from('project_members')
        .select('project_id')
        .eq('user_id', userId),
      supabaseAdmin
        .from('work_items')
        .select('project_id')
        .eq('assigned_to', userId),
      supabaseAdmin
        .from('projects')
        .select('id')
        .eq('organization_id', organizationId)
        .or(`project_manager_id.eq.${userId},created_by.eq.${userId}`),
    ])

    const memberIds = (memberRes.data || []).map((m) => m.project_id)
    const workIds = (workRes.data || [])
      .map((w) => w.project_id)
      .filter((id): id is string => Boolean(id))
    const managerIds = (managerRes.data || []).map((p) => p.id)

    const assignedProjectIds = [
      ...new Set([...memberIds, ...workIds, ...managerIds]),
    ]

    if (assignedProjectIds.length > 0) {
      query = query.in('id', assignedProjectIds)
    }
  }

  const { data, error } = await query.order('created_at', {
    ascending: false,
  })

  if (error) {
    throw new Error(error.message)
  }

  return (data || []).map(formatProjectOutput)
}

export async function createProject(
  organizationId: string,
  createdBy: string,
  input: {
    name: string
    project_key: string
    description?: string
    methodology: 'SCRUM' | 'KANBAN'
    status?: string
    project_manager_id?: string | null
    start_date?: string | null
    target_date?: string | null
  },
) {
  if (input.project_manager_id) {
    const { data: manager, error: managerError } = await supabaseAdmin
      .from('profiles')
      .select('id, role, organization_id')
      .eq('id', input.project_manager_id)
      .single()

    if (
      managerError ||
      !manager ||
      (manager.role !== 'MANAGER' && manager.role !== 'SUPER_ADMIN') ||
      manager.organization_id !== organizationId
    ) {
      throw new Error('Selected manager is invalid.')
    }
  }

  const { data: existing } = await supabaseAdmin
    .from('projects')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('project_key', input.project_key.toUpperCase())
    .maybeSingle()

  if (existing) {
    throw new Error('Project key already exists.')
  }

  const { finalStatus, finalDescription } = prepareStatusAndDescription(
    input.status || 'PLANNING',
    input.description,
  )

  const { data, error } = await supabaseAdmin
    .from('projects')
    .insert({
      organization_id: organizationId,
      name: input.name,
      project_key: input.project_key.toUpperCase(),
      description: finalDescription || null,
      methodology: input.methodology,
      status: finalStatus || 'PLANNING',
      project_manager_id: input.project_manager_id || null,
      start_date: input.start_date || null,
      target_date: input.target_date || null,
      created_by: createdBy,
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return formatProjectOutput(data)
}

export async function getProjectMembers(projectId: string) {
  const { data, error } = await supabaseAdmin
    .from('project_members')
    .select(`
      id,
      project_id,
      user_id,
      created_at,
      profiles:user_id (
        id,
        first_name,
        last_name,
        email,
        role,
        designation,
        employee_id,
        status
      )
    `)
    .eq('project_id', projectId)

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function addProjectMember(
  projectId: string,
  userId: string,
  _assignedBy?: string,
) {
  const { data, error } = await supabaseAdmin
    .from('project_members')
    .insert({
      project_id: projectId,
      user_id: userId,
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function removeProjectMember(
  projectId: string,
  userId: string,
) {
  const { error } = await supabaseAdmin
    .from('project_members')
    .delete()
    .eq('project_id', projectId)
    .eq('user_id', userId)

  if (error) {
    throw new Error(error.message)
  }

  return true
}

export async function deleteProject(
  organizationId: string,
  projectId: string,
) {
  await supabaseAdmin
    .from('project_members')
    .delete()
    .eq('project_id', projectId)

  const { error } = await supabaseAdmin
    .from('projects')
    .delete()
    .eq('organization_id', organizationId)
    .eq('id', projectId)

  if (error) {
    throw new Error(error.message)
  }

  return true
}

export async function updateProject(
  organizationId: string,
  projectId: string,
  input: {
    name?: string
    description?: string
    status?: string
    methodology?: 'SCRUM' | 'KANBAN'
    project_manager_id?: string | null
    start_date?: string | null
    target_date?: string | null
  },
) {
  // Get existing project row to handle description cleanly
  const { data: existingProject } = await supabaseAdmin
    .from('projects')
    .select('status, description')
    .eq('organization_id', organizationId)
    .eq('id', projectId)
    .single()

  const payload: Record<string, any> = {}

  if (input.name !== undefined) payload.name = input.name
  if (input.methodology !== undefined) payload.methodology = input.methodology
  if (input.project_manager_id !== undefined)
    payload.project_manager_id = input.project_manager_id
  if (input.start_date !== undefined) payload.start_date = input.start_date
  if (input.target_date !== undefined) payload.target_date = input.target_date

  if (input.status !== undefined || input.description !== undefined) {
    const { finalStatus, finalDescription } = prepareStatusAndDescription(
      input.status,
      input.description,
      existingProject?.description,
    )
    if (finalStatus !== undefined) payload.status = finalStatus
    if (finalDescription !== undefined) payload.description = finalDescription
  }

  payload.updated_at = new Date().toISOString()

  const { data, error } = await supabaseAdmin
    .from('projects')
    .update(payload)
    .eq('organization_id', organizationId)
    .eq('id', projectId)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return formatProjectOutput(data)
}
