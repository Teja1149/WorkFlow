import { supabaseAdmin } from '../../lib/supabase.js'

export async function getCompanyOperations(
  organizationId: string,
) {
  const { data: work, error: workError } =
    await supabaseAdmin
      .from('work_items')
      .select(`
        id,
        title,
        status,
        priority,
        deadline,
        deadline_time,
        progress_percent,
        health,
        escalation_level,
        carry_forward_count,
        assigned_to,
        project_id,
        module_id,
        milestone_id,
        work_type_id,

        projects:project_id (
          id,
          name,
          project_key
        ),

        project_modules:module_id (
          id,
          name
        ),

        project_milestones:milestone_id (
          id,
          name,
          deadline,
          status
        ),

        work_types:work_type_id (
          id,
          name,
          color
        ),

        assignee:assigned_to (
          id,
          first_name,
          last_name,
          employee_id
        )
      `)
      .eq('organization_id', organizationId)

  if (workError) {
    throw new Error(workError.message)
  }

  const items = work || []

  const { data: concerns, error: concernError } =
    await supabaseAdmin
      .from('work_concerns')
      .select(`
        id,
        work_item_id,
        concern,
        priority,
        status,
        created_at,

        reporter:reported_by (
          id,
          first_name,
          last_name
        ),

        work_items:work_item_id (
          id,
          title,
          project_id,
          organization_id,
          assigned_to,
          projects:project_id (
            id,
            name
          )
        )
      `)
      .eq('status', 'OPEN')

  if (concernError) {
    throw new Error(concernError.message)
  }

  const filteredConcerns = ((concerns || []) as any[]).filter(
    (c) => c.work_items?.organization_id === organizationId,
  )

  const active = items.filter(
    (item) => item.status !== 'DONE',
  )

  const completed = items.filter(
    (item) => item.status === 'DONE',
  )

  const overdue = active.filter(
    (item) =>
      item.health === 'RED',
  )

  const critical = active.filter(
    (item) =>
      item.health === 'CRITICAL',
  )

  const atRisk = active.filter(
    (item) =>
      item.health === 'AMBER' ||
      item.health === 'ORANGE',
  )

  const blocked = active.filter(
    (item) => item.status === 'BLOCKED',
  )

  const carriedForward = active.filter(
    (item) =>
      Number(item.carry_forward_count || 0) > 0,
  )

  const summary = {
    total: items.length,
    active: active.length,
    completed: completed.length,
    overdue: overdue.length,
    critical: critical.length,
    atRisk: atRisk.length,
    blocked: blocked.length,
    carriedForward: carriedForward.length,

    completionRate:
      items.length === 0
        ? 0
        : Math.round(
            (completed.length / items.length) * 100,
          ),
  }

  return {
    summary,
    attention: {
      critical,
      overdue,
      atRisk,
      blocked,
      carriedForward,
      concerns: filteredConcerns,
    },
    work: items,
  }
}
