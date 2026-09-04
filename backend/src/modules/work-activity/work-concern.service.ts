import { supabaseAdmin } from '../../lib/supabase.js'
import { logActivity } from './work-activity.service.js'
import {
  createNotification,
  notifyStakeholders,
  getDirectManagerId,
  getOrganizationStakeholderIds,
} from '../notifications/notification.service.js'
import { NotificationType } from '../notifications/notification.types.js'
import { refreshWorkHealth } from '../work-execution/work-execution.service.js'

export async function getConcerns(workItemId: string) {
  const { data, error } = await supabaseAdmin
    .from('work_concerns')
    .select(`
      id,
      work_item_id,
      reported_by,
      concern,
      priority,
      status,
      resolution_note,
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
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM',
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
      priority,
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

  // Notify Manager / Creator / Assignee / Leadership
  try {
    const { data: item } = await supabaseAdmin
      .from('work_items')
      .select('created_by, assigned_to, organization_id, title, project_id')
      .eq('id', workItemId)
      .single()

    if (item) {
      const managerId = item.assigned_to
        ? await getDirectManagerId(item.assigned_to, item.organization_id)
        : null
      const leadership = await getOrganizationStakeholderIds(
        item.organization_id,
        ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
      )

      const recipients = [
        item.created_by,
        item.assigned_to,
        managerId,
        ...leadership,
      ].filter(
        (id): id is string =>
          Boolean(id) && id !== userId,
      )

      for (const recipientId of [...new Set(recipients)]) {
        try {
          await createNotification({
            userId: recipientId,
            organizationId: item.organization_id,
            type: NotificationType.CONCERN_REPORTED,
            title: 'Open Concern',
            message: `Concern reported on "${item.title}": ${concern.trim()}`,
            workItemId: workItemId,
            projectId: item.project_id,
          })
        } catch (notifErr) {
          console.error(
            `Failed to notify ${recipientId} about concern:`,
            notifErr,
          )
        }
      }
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

    try {
      const { data: item } = await supabaseAdmin
        .from('work_items')
        .select('organization_id, title, project_id, created_by, assigned_to')
        .eq('id', data.work_item_id)
        .single()

      if (item) {
        const managerId = item.assigned_to
          ? await getDirectManagerId(item.assigned_to, item.organization_id)
          : null
        const leadership = await getOrganizationStakeholderIds(
          item.organization_id,
          ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
        )

        const recipients = [
          data.reported_by,
          item.created_by,
          item.assigned_to,
          managerId,
          ...leadership,
        ].filter(
          (id): id is string =>
            Boolean(id) && id !== resolvedBy,
        )

        for (const recipientId of [...new Set(recipients)]) {
          try {
            await createNotification({
              userId: recipientId,
              organizationId: item.organization_id,
              type: NotificationType.CONCERN_RESOLVED,
              title: 'Work concern resolved',
              message: `Concern on "${item.title}" has been resolved.`,
              workItemId: data.work_item_id,
              projectId: item.project_id,
            })
          } catch (notificationError) {
            console.error('Failed to notify concern resolution recipient:', notificationError)
          }
        }
      }
    } catch (notificationError) {
      console.error('Failed to process concern resolution notification:', notificationError)
    }
  }

  return data
}

export async function reviewWorkConcern(
  organizationId: string,
  reviewerId: string,
  concernId: string,
  resolutionNote?: string,
) {
  const { data: concern, error: concernError } =
    await supabaseAdmin
      .from('work_concerns')
      .select(`
        id,
        work_item_id,
        reported_by,
        status,
        work_items:work_item_id (
          id,
          organization_id,
          title,
          project_id,
          assigned_to
        )
      `)
      .eq('id', concernId)
      .maybeSingle()

  if (concernError) {
    throw new Error(concernError.message)
  }

  if (!concern) {
    throw new Error('Concern not found.')
  }

  const work = (concern as any).work_items

  if (!work || work.organization_id !== organizationId) {
    throw new Error('Concern not found.')
  }

  if (concern.status === 'RESOLVED') {
    throw new Error('Concern is already resolved.')
  }

  const { data, error } = await supabaseAdmin
    .from('work_concerns')
    .update({
      status: 'RESOLVED',
      resolution_note:
        resolutionNote?.trim() || null,
      resolved_by: reviewerId,
      resolved_at: new Date().toISOString(),
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', concernId)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  try {
    const managerId = work.assigned_to
      ? await getDirectManagerId(work.assigned_to, organizationId)
      : null
    const leadership = await getOrganizationStakeholderIds(
      organizationId,
      ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
    )

    const recipients = [
      concern.reported_by,
      work.created_by,
      work.assigned_to,
      managerId,
      ...leadership,
    ].filter((id): id is string => Boolean(id) && id !== reviewerId)

    await notifyStakeholders({
      organizationId,
      title: 'Concern Resolved',
      message: `"${work.title}" concern has been resolved.`,
      type: NotificationType.CONCERN_RESOLVED,
      workItemId: work.id,
      projectId: work.project_id,
      authorUserId: reviewerId,
      recipients,
    })
  } catch (notifErr) {
    console.error('Failed to notify concern resolution:', notifErr)
  }

  try {
    await refreshWorkHealth(organizationId)
  } catch (err) {
    console.error('Health refresh failed after concern resolution:', err)
  }

  return data
}
