import { supabaseAdmin } from '../../lib/supabase.js'

export async function globalSearch(
  organizationId: string,
  query: string,
  role?: string,
  userId?: string,
) {
  const q = query.trim()
  if (!q) {
    return {
      projects: [],
      workItems: [],
      employees: [],
      milestones: [],
      sprints: [],
    }
  }

  const pattern = `%${q}%`

  let workItemsQuery = supabaseAdmin
    .from('work_items')
    .select('id, title, status, priority, progress_percent, health')
    .eq('organization_id', organizationId)
    .neq('title', 'PROJECT_DAILY_REPORT_TEMPLATE')
    .ilike('title', pattern)
    .limit(10)

  if (role === 'EMPLOYEE' && userId) {
    workItemsQuery = workItemsQuery.eq('assigned_to', userId)
  }

  const [projectsRes, workItemsRes, employeesRes, milestonesRes, sprintsRes] =
    await Promise.all([
      supabaseAdmin
        .from('projects')
        .select('id, name, project_key, status')
        .eq('organization_id', organizationId)
        .ilike('name', pattern)
        .limit(5),

      workItemsQuery,

      supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, role, employee_id')
        .eq('organization_id', organizationId)
        .or(`first_name.ilike.${pattern},last_name.ilike.${pattern}`)
        .limit(5),

      supabaseAdmin
        .from('project_milestones')
        .select('id, name, status, deadline, project_id')
        .ilike('name', pattern)
        .limit(5),

      supabaseAdmin
        .from('sprints')
        .select('id, name, status, project_id')
        .ilike('name', pattern)
        .limit(5),
    ])

  return {
    projects: projectsRes.data || [],
    workItems: workItemsRes.data || [],
    employees: employeesRes.data || [],
    milestones: milestonesRes.data || [],
    sprints: sprintsRes.data || [],
  }
}
