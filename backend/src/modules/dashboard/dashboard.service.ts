import { supabaseAdmin } from '../../lib/supabase.js'

export async function getManagerDashboard(
  organizationId: string,
  managerId: string,
) {
  // 1. Fetch projects managed by this manager
  const { data: projects, error: projectError } = await supabaseAdmin
    .from('projects')
    .select(`
      id,
      name,
      project_key,
      methodology,
      status,
      start_date,
      target_date,
      created_at
    `)
    .eq('organization_id', organizationId)
    .eq('project_manager_id', managerId)
    .order('created_at', { ascending: false })

  if (projectError) {
    throw new Error(projectError.message)
  }

  const projectIds = (projects || []).map((p) => p.id)

  if (projectIds.length === 0) {
    return {
      projects: [],
      workItems: [],
      updates: [],
      concerns: [],
      stats: {
        projects: 0,
        team: 0,
        activeWork: 0,
        overdue: 0,
      },
    }
  }

  // 2. Fetch work items for these projects
  const { data: workItems, error: workError } = await supabaseAdmin
    .from('work_items')
    .select(`
      id,
      title,
      priority,
      status,
      progress_percent,
      deadline,
      deadline_time,
      health,
      carry_forward_count,
      project_id,
      assigned_to,
      created_at,

      assignee:assigned_to (
        id,
        first_name,
        last_name,
        role,
        employee_id
      ),

      projects:project_id (
        id,
        name,
        project_key
      )
    `)
    .in('project_id', projectIds)
    .neq('title', 'PROJECT_DAILY_REPORT_TEMPLATE')
    .order('created_at', { ascending: false })

  if (workError) {
    throw new Error(workError.message)
  }

  const filteredWorkItems = (workItems || []).filter(
    (w) => w.title !== 'PROJECT_DAILY_REPORT_TEMPLATE',
  )
  const workItemIds = filteredWorkItems.map((w) => w.id)

  // 3. Fetch recent updates
  const { data: updates } = workItemIds.length > 0
    ? await supabaseAdmin
        .from('work_updates')
        .select(`
          id,
          work_item_id,
          employee_id,
          update_text,
          progress_percent,
          created_at,
          employee:profiles!work_updates_employee_id_fkey(
            id,
            first_name,
            last_name
          )
        `)
        .in('work_item_id', workItemIds)
        .order('created_at', { ascending: false })
        .limit(10)
    : { data: [] }

  // 4. Fetch open concerns
  const { data: concerns } = workItemIds.length > 0
    ? await supabaseAdmin
        .from('work_concerns')
        .select(`
          id,
          work_item_id,
          reported_by,
          concern,
          status,
          created_at,
          reporter:profiles!work_concerns_reported_by_fkey(
            id,
            first_name,
            last_name
          )
        `)
        .in('work_item_id', workItemIds)
        .eq('status', 'OPEN')
        .order('created_at', { ascending: false })
    : { data: [] }

  // 5. Fetch project members
  const { data: members, error: memberError } = await supabaseAdmin
    .from('project_members')
    .select('user_id')
    .in('project_id', projectIds)

  if (memberError) {
    throw new Error(memberError.message)
  }

  const uniqueMembers = new Set((members || []).map((m) => m.user_id))
  const today = new Date().toISOString().split('T')[0]

  const activeWork = filteredWorkItems.filter((item) => item.status !== 'DONE').length
  const overdue = filteredWorkItems.filter(
    (item) => item.deadline && item.deadline < today && item.status !== 'DONE',
  ).length

  return {
    projects: projects || [],
    workItems: filteredWorkItems,
    updates: updates || [],
    concerns: concerns || [],
    stats: {
      projects: projects?.length || 0,
      team: uniqueMembers.size,
      activeWork,
      overdue,
    },
  }
}
