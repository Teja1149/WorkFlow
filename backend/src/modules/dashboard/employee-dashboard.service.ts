import { supabaseAdmin } from '../../lib/supabase.js'

export async function getEmployeeDashboard(
  organizationId: string,
  employeeId: string,
) {
  const { data: workItems, error } = await supabaseAdmin
    .from('work_items')
    .select(`
      id,
      title,
      description,
      priority,
      status,
      deadline,
      start_date,
      created_at,
      projects:project_id (
        id,
        name,
        project_key
      )
    `)
    .eq('organization_id', organizationId)
    .eq('assigned_to', employeeId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  const items = workItems || []
  const today = new Date().toISOString().split('T')[0]
  const inThreeDays = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]

  const active = items.filter((item) => item.status !== 'DONE')
  const inProgress = items.filter((item) => item.status === 'IN_PROGRESS')
  const dueSoon = items.filter(
    (item) => item.deadline && item.deadline >= today && item.deadline <= inThreeDays && item.status !== 'DONE',
  )
  const overdue = items.filter(
    (item) => item.deadline && item.deadline < today && item.status !== 'DONE',
  )

  const workIds = items.map((item) => item.id)
  let concerns: unknown[] = []

  if (workIds.length > 0) {
    const { data: concernData, error: concernError } = await supabaseAdmin
      .from('work_concerns')
      .select(`
        id,
        work_item_id,
        concern,
        status,
        created_at
      `)
      .in('work_item_id', workIds)
      .eq('status', 'OPEN')
      .order('created_at', { ascending: false })

    if (concernError) {
      throw new Error(concernError.message)
    }

    concerns = concernData || []
  }

  return {
    workItems: items,
    concerns,
    stats: {
      total: items.length,
      active: active.length,
      inProgress: inProgress.length,
      dueSoon: dueSoon.length,
      overdue: overdue.length,
      completed: items.filter((item) => item.status === 'DONE').length,
    },
  }
}
