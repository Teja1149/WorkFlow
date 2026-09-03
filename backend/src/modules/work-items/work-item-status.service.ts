import { supabaseAdmin } from '../../lib/supabase.js'
import { logActivity } from '../work-activity/work-activity.service.js'
import { notifyStakeholders } from '../notifications/notification.service.js'

export type WorkStatus = 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE'

export const statusDisplayLabels: Record<string, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  BLOCKED: 'Blocked',
  DONE: 'Completed',
}

export async function transitionWorkItemStatus(
  organizationId: string,
  userId: string,
  userRole: string,
  workItemId: string,
  nextStatus: WorkStatus,
  notes?: string,
) {
  const { data: work, error } = await supabaseAdmin
    .from('work_items')
    .select(`
      id,
      title,
      organization_id,
      status,
      progress_percent,
      assigned_to,
      created_by,
      project_id,
      deadline,
      deadline_time,
      completed_at
    `)
    .eq('id', workItemId)
    .eq('organization_id', organizationId)
    .single()

  if (error || !work) {
    throw new Error('Work item not found.')
  }

  const employeeAllowedTransitions: Record<string, string[]> = {
    TODO: ['IN_PROGRESS', 'BLOCKED', 'DONE'],
    IN_PROGRESS: ['DONE', 'BLOCKED', 'TODO'],
    BLOCKED: ['IN_PROGRESS', 'DONE'],
    DONE: ['IN_PROGRESS'],
  }

  const managerAllowedTransitions: Record<string, string[]> = {
    TODO: ['IN_PROGRESS', 'BLOCKED', 'DONE'],
    IN_PROGRESS: ['DONE', 'BLOCKED', 'TODO'],
    BLOCKED: ['IN_PROGRESS', 'DONE', 'TODO'],
    DONE: ['IN_PROGRESS', 'TODO'],
  }

  const adminAllowedTransitions: Record<string, string[]> = {
    TODO: ['IN_PROGRESS', 'BLOCKED', 'DONE'],
    IN_PROGRESS: ['DONE', 'BLOCKED', 'TODO'],
    BLOCKED: ['IN_PROGRESS', 'DONE', 'TODO'],
    DONE: ['IN_PROGRESS', 'TODO'],
  }

  const isOwnAssignedWork = work.assigned_to === userId

  if (
    userRole === 'EMPLOYEE' ||
    (userRole === 'MANAGER' && isOwnAssignedWork)
  ) {
    const employeeAllowed =
      employeeAllowedTransitions[work.status] || []

    if (userRole === 'EMPLOYEE' && !isOwnAssignedWork) {
      throw new Error(
        'You can only update your own assigned work.',
      )
    }

    if (!employeeAllowed.includes(nextStatus)) {
      throw new Error(
        'You can only update your assigned work using the allowed workflow.',
      )
    }
  }

  if (
    userRole === 'MANAGER' &&
    !isOwnAssignedWork
  ) {
    const managerAllowed =
      managerAllowedTransitions[work.status] || []

    if (!managerAllowed.includes(nextStatus)) {
      throw new Error(
        `Managers cannot change work from ${work.status} to ${nextStatus}.`,
      )
    }
  }

  if (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') {
    const adminAllowed =
      adminAllowedTransitions[work.status] || []

    if (!adminAllowed.includes(nextStatus)) {
      throw new Error(
        `Cannot change work from ${work.status} to ${nextStatus}.`,
      )
    }
  }

  const updateData: Record<string, unknown> = {
    status: nextStatus,
    updated_at: new Date().toISOString(),
  }

  if (nextStatus === 'IN_PROGRESS') {
    updateData.completed_at = null
  }

  if (nextStatus === 'DONE') {
    updateData.progress_percent = 100
    updateData.completed_at = new Date().toISOString()
  }

  if (nextStatus === 'BLOCKED') {
    updateData.completed_at = null
  }

  const { data: updatedWork, error: updateError } = await supabaseAdmin
    .from('work_items')
    .update(updateData)
    .eq('id', workItemId)
    .select(`
      id,
      title,
      status,
      progress_percent,
      health,
      deadline,
      deadline_time,
      assigned_to,
      completed_at,
      updated_at
    `)
    .single()

  if (updateError) {
    throw new Error(updateError.message)
  }

  // Log activity
  const noteSuffix = notes ? ` Note: ${notes}` : ''
  await logActivity(
    workItemId,
    userId,
    'STATUS_CHANGED',
    `Status changed from ${statusDisplayLabels[work.status] || work.status} to ${statusDisplayLabels[nextStatus] || nextStatus}.${noteSuffix}`,
  )

  // Notify stakeholders
  const statusLabel = statusDisplayLabels[nextStatus] || nextStatus
  try {
    await notifyStakeholders({
      organizationId,
      title: 'Work Status Updated',
      message: `"${work.title}" is now ${statusLabel}.${noteSuffix}`,
      type: nextStatus === 'DONE'
        ? 'WORK_COMPLETED'
        : 'WORK_UPDATED',
      workItemId,
      projectId: work.project_id,
      authorUserId: userId,
      recipients: [work.assigned_to, work.created_by].filter(
        (id) => Boolean(id) && id !== userId,
      ),
    })
  } catch {
    // Ignore notification failure
  }

  return updatedWork
}
