import { supabaseAdmin } from '../../lib/supabase.js'

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
    // Fetch project IDs where employee is a member, assigned work items, or manager
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

    // Filter by assigned project IDs if explicitly assigned; otherwise include all organization projects
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

  return data
}

export async function createProject(
  organizationId: string,
  createdBy: string,
  input: {
    name: string
    project_key: string
    description?: string
    methodology: 'SCRUM' | 'KANBAN'
    status?: 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED'
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

  const { data, error } = await supabaseAdmin
    .from('projects')
    .insert({
      organization_id: organizationId,
      name: input.name,
      project_key: input.project_key.toUpperCase(),
      description: input.description || null,
      methodology: input.methodology,
      status: input.status || 'PLANNING',
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

  return data
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
  // 1. Delete associated project members first
  await supabaseAdmin
    .from('project_members')
    .delete()
    .eq('project_id', projectId)

  // 2. Delete project record
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
