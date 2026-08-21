import { supabaseAdmin } from '../../lib/supabase.js'
import { logActivity } from './work-activity.service.js'
import { createNotification } from '../notifications/notification.service.js'

export async function getConcerns(workItemId: string) {
  const { data, error } = await supabaseAdmin
    .from('work_concerns')
    .select(`
      id,
      work_item_id,
      reported_by,
      concern,
      status,
      resolved_by,
      resolved_at,
      created_at,
      reporter:profiles!work_concerns_reported_by_fkey(
        id,
        first_name,
        last_name,
        employee_id
      )
    `)
    .eq('work_item_id', workItemId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function addConcern(
  workItemId: string,
  userId: string,
  concern: string,
) {
  if (!concern.trim()) {
    throw new Error('Concern cannot be empty.')
  }

  const { data, error } = await supabaseAdmin
    .from('work_concerns')
    .insert({
      work_item_id: workItemId,
      reported_by: userId,
      concern: concern.trim(),
      status: 'OPEN',
    })
    .select(`
      *,
      reporter:profiles!work_concerns_reported_by_fkey(
        id,
        first_name,
        last_name,
        employee_id
      )
    `)
    .single()

  if (error) {
    throw new Error(error.message)
  }

  // Automatically log activity
  await logActivity(
    workItemId,
    userId,
    'CONCERN_REPORTED',
    `Reported a concern/blocker: ${concern.trim()}`,
  )

  // Notify Manager / Creator
  try {
    const { data: item } = await supabaseAdmin
      .from('work_items')
      .select('created_by, organization_id, title, project_id')
      .eq('id', workItemId)
      .single()

    if (item && item.created_by && item.created_by !== userId) {
      await createNotification({
        userId: item.created_by,
        organizationId: item.organization_id,
        type: 'CONCERN_REPORTED',
        title: 'Open Concern',
        message: `Concern reported on "${item.title}": ${concern.trim()}`,
        workItemId: workItemId,
        projectId: item.project_id,
      })
    }
  } catch {
    // Ignore notification error
  }

  return data
}

export async function resolveConcern(
  concernId: string,
  resolvedBy: string,
) {
  const { data, error } = await supabaseAdmin
    .from('work_concerns')
    .update({
      status: 'RESOLVED',
      resolved_by: resolvedBy,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', concernId)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  if (data) {
    await logActivity(
      data.work_item_id,
      resolvedBy,
      'CONCERN_RESOLVED',
      'Marked concern as resolved.',
    )

    if (data.reported_by && data.reported_by !== resolvedBy) {
      try {
        const { data: item } = await supabaseAdmin
          .from('work_items')
          .select('organization_id')
          .eq('id', data.work_item_id)
          .single()

        if (item) {
          await createNotification({
            userId: data.reported_by,
            organizationId: item.organization_id,
            type: 'CONCERN_RESOLVED',
            title: 'Work concern resolved',
            message: `Your concern on "${data.work_item_id}" has been resolved.`,
            workItemId: data.work_item_id,
          })
        }
      } catch (notificationError) {
        console.error('Failed to notify concern reporter:', notificationError)
      }
    }
  }

  return data
}
