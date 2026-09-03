import { supabaseAdmin } from '../../lib/supabase.js'

export async function getWorkDependencies(
  organizationId: string,
  workItemId: string,
) {
  const { data: work } = await supabaseAdmin
    .from('work_items')
    .select('id')
    .eq('id', workItemId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (!work) {
    throw new Error('Work item not found.')
  }

  const { data, error } = await supabaseAdmin
    .from('work_item_dependencies')
    .select(`
      id,
      dependency_type,
      created_at,
      depends_on_work_item:depends_on_work_item_id (
        id,
        title,
        status,
        health,
        progress_percent,
        deadline
      )
    `)
    .eq('work_item_id', workItemId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return data || []
}

export async function addWorkDependency(
  organizationId: string,
  createdBy: string,
  workItemId: string,
  dependsOnWorkItemId: string,
) {
  if (workItemId === dependsOnWorkItemId) {
    throw new Error(
      'A work item cannot depend on itself.',
    )
  }

  const { data: source } = await supabaseAdmin
    .from('work_items')
    .select('id, project_id')
    .eq('id', workItemId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  const { data: dependency } = await supabaseAdmin
    .from('work_items')
    .select('id, project_id')
    .eq('id', dependsOnWorkItemId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (!source || !dependency) {
    throw new Error('Work item not found.')
  }

  if (source.project_id !== dependency.project_id) {
    throw new Error(
      'Dependencies must belong to the same project.',
    )
  }

  const { data, error } = await supabaseAdmin
    .from('work_item_dependencies')
    .insert({
      work_item_id: workItemId,
      depends_on_work_item_id: dependsOnWorkItemId,
      created_by: createdBy,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error(
        'This dependency already exists.',
      )
    }

    throw new Error(error.message)
  }

  return data
}

export async function removeWorkDependency(
  organizationId: string,
  dependencyId: string,
) {
  const { data: dependency } =
    await supabaseAdmin
      .from('work_item_dependencies')
      .select(`
        id,
        work_item:work_item_id (
          organization_id
        )
      `)
      .eq('id', dependencyId)
      .maybeSingle()

  if (!dependency) {
    throw new Error('Dependency not found.')
  }

  const projectOrg =
    (dependency as any).work_item?.organization_id

  if (projectOrg !== organizationId) {
    throw new Error('Dependency not found.')
  }

  const { error } = await supabaseAdmin
    .from('work_item_dependencies')
    .delete()
    .eq('id', dependencyId)

  if (error) {
    throw new Error(error.message)
  }

  return { success: true }
}

export async function getDependencyRisk(
  organizationId: string,
  workItemId: string,
) {
  const { data, error } = await supabaseAdmin
    .from('work_item_dependencies')
    .select(`
      depends_on_work_item:depends_on_work_item_id (
        id,
        status,
        health,
        title
      )
    `)
    .eq('work_item_id', workItemId)

  if (error) {
    throw new Error(error.message)
  }

  const blockers = (data || [])
    .map((row: any) => row.depends_on_work_item)
    .filter(
      (item: any) =>
        item &&
        item.status !== 'DONE',
    )

  return {
    blocked: blockers.length > 0,
    blockers,
  }
}
