import { supabaseAdmin } from '../../lib/supabase.js'
import { logActivity } from '../work-activity/work-activity.service.js'
import {
  notifyWorkStakeholders,
  notifyWorkCompleted,
  notifyWorkSentBack,
  getDirectManagerId,
  getOrganizationStakeholderIds,
} from '../notifications/notification.service.js'
import { NotificationType } from '../notifications/notification.types.js'

export type WorkStatus =
  | 'TODO'
  | 'IN_PROGRESS'
  | 'BLOCKED'
  | 'IN_REVIEW'
  | 'DONE'

export const statusDisplayLabels: Record<string, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  BLOCKED: 'Blocked',
  IN_REVIEW: 'In Review',
  DONE: 'Completed',
}

export async function transitionWorkItemStatus(
  organizationId: string,
  userId: string,
  userRole: string,
  workItemId: string,
  nextStatus: WorkStatus,
  notes?: string,
  action?: 'STATUS_CHANGE' | 'SEND_BACK',
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
      completed_at,
      target_quantity,
      completed_quantity,
      quantity_unit
    `)
    .eq('id', workItemId)
    .eq('organization_id', organizationId)
    .single()

  if (error || !work) {
    throw new Error('Work item not found.')
  }

  const normalizedRole = String(userRole || '').toUpperCase()

  const isManagementRole = [
    'MANAGER',
    'ADMIN',
    'SUPER_ADMIN',
  ].includes(normalizedRole)

  const isSendBack =
    action === 'SEND_BACK' &&
    nextStatus === 'IN_PROGRESS' &&
    work.status === 'DONE' &&
    isManagementRole

  if (action === 'SEND_BACK' && !isSendBack) {
    throw new Error(
      `Invalid send-back operation. Current status: ${work.status}, role: ${normalizedRole}, next status: ${nextStatus}`,
    )
  }

  if (isSendBack && !notes?.trim()) {
    throw new Error('A reason is required when sending work back.')
  }

  // Prevent completion if target quantity has not been reached, unless authorized override
  if (nextStatus === 'DONE') {
    const targetQty = Number(work.target_quantity || 0)
    const completedQty = Number(work.completed_quantity || 0)

    if (targetQty > 0 && completedQty < targetQty) {
      const isOverride =
        (action as any) === 'OVERRIDE_COMPLETE' ||
        (notes && notes.toLowerCase().includes('override'))

      if (!isOverride) {
        throw new Error(
          `Cannot mark work as complete: target quantity not reached (${completedQty} / ${targetQty} ${work.quantity_unit || 'items'}). Work must remain IN_PROGRESS until all units are completed.`,
        )
      }
    }
  }

  // A blocker must always be documented so the employee, manager and admin
  // have a clear, auditable reason for why the work cannot continue.
  if (nextStatus === 'BLOCKED' && !notes?.trim()) {
    throw new Error(
      'Please provide blocker details before marking work as blocked.',
    )
  }

  if (!isSendBack) {
    const employeeAllowedTransitions: Record<string, string[]> = {
      TODO: ['IN_PROGRESS', 'BLOCKED', 'DONE'],
      IN_PROGRESS: ['IN_REVIEW', 'BLOCKED', 'DONE', 'TODO'],
      BLOCKED: ['IN_PROGRESS', 'DONE'],
      IN_REVIEW: ['DONE', 'IN_PROGRESS'],
      DONE: ['IN_PROGRESS'],
    }

    const managerAllowedTransitions: Record<string, string[]> = {
      TODO: ['IN_PROGRESS', 'BLOCKED', 'DONE'],
      IN_PROGRESS: ['IN_REVIEW', 'BLOCKED', 'DONE', 'TODO'],
      BLOCKED: ['IN_PROGRESS', 'DONE', 'TODO'],
      IN_REVIEW: ['DONE', 'IN_PROGRESS', 'BLOCKED'],
      DONE: ['IN_PROGRESS', 'TODO'],
    }

    const adminAllowedTransitions: Record<string, string[]> = {
      TODO: ['IN_PROGRESS', 'BLOCKED', 'DONE'],
      IN_PROGRESS: ['IN_REVIEW', 'BLOCKED', 'DONE', 'TODO'],
      BLOCKED: ['IN_PROGRESS', 'DONE', 'TODO'],
      IN_REVIEW: ['DONE', 'IN_PROGRESS', 'BLOCKED'],
      DONE: ['IN_PROGRESS', 'TODO'],
    }

    const isOwnAssignedWork = work.assigned_to === userId

    if (
      normalizedRole === 'EMPLOYEE' ||
      (normalizedRole === 'MANAGER' && isOwnAssignedWork)
    ) {
      const employeeAllowed =
        employeeAllowedTransitions[work.status] || []

      if (normalizedRole === 'EMPLOYEE' && !isOwnAssignedWork) {
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
      normalizedRole === 'MANAGER' &&
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

    if (normalizedRole === 'ADMIN' || normalizedRole === 'SUPER_ADMIN') {
      const adminAllowed =
        adminAllowedTransitions[work.status] || []

      if (!adminAllowed.includes(nextStatus)) {
        throw new Error(
          `Cannot change work from ${work.status} to ${nextStatus}.`,
        )
      }
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
    isSendBack ? 'WORK_SENT_BACK' : 'STATUS_CHANGED',
    isSendBack
      ? `Work was sent back for correction.${noteSuffix}`
      : `Status changed from ${
          statusDisplayLabels[work.status] || work.status
        } to ${statusDisplayLabels[nextStatus] || nextStatus}.${noteSuffix}`,
  )

  // Notify stakeholders
  const statusLabel = statusDisplayLabels[nextStatus] || nextStatus

  try {
    if (isSendBack) {
      await notifyWorkSentBack({
        organizationId,
        workItemId,
        projectId: work.project_id,
        title: 'Work Sent Back',
        message: `"${work.title}" was sent back for correction.${noteSuffix}`,
        authorUserId: userId,
        assignedTo: work.assigned_to,
        createdBy: work.created_by,
      })
    } else if (nextStatus === 'DONE') {
      await notifyWorkCompleted({
        organizationId,
        workItemId,
        projectId: work.project_id,
        title: 'Work Completed',
        message: `"${work.title}" has been completed.${noteSuffix}`,
        authorUserId: userId,
        assignedTo: work.assigned_to,
        createdBy: work.created_by,
      })
    } else {
      const leadership = await getOrganizationStakeholderIds(organizationId, [
        'SUPER_ADMIN',
        'ADMIN',
        'MANAGER',
      ])
      const managerId = work.assigned_to
        ? await getDirectManagerId(work.assigned_to, organizationId)
        : null

      const recipients = [
        work.assigned_to,
        work.created_by,
        managerId,
        ...leadership,
      ].filter((id): id is string => Boolean(id) && id !== userId)

      await notifyWorkStakeholders({
        organizationId,
        title: 'Work Status Updated',
        message: `"${work.title}" is now ${statusLabel}.${noteSuffix}`,
        type: NotificationType.WORK_UPDATED,
        workItemId,
        projectId: work.project_id,
        authorUserId: userId,
        recipients,
      })
    }
  } catch (notificationError) {
    console.error(
      '[WorkStatus] Notification failed:',
      notificationError,
    )
  }

  return updatedWork
}
