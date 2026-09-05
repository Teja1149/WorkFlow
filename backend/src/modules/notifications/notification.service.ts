import { supabaseAdmin } from '../../lib/supabase.js'
import { NotificationType } from './notification.types.js'

/**
 * Valid allowed types in the PostgreSQL check constraint
 */
const VALID_DB_TYPES = [
  'WORK_ASSIGNED',
  'WORK_UPDATED',
  'CONCERN_REPORTED',
  'STATUS_CHANGED',
  'DAILY_UPDATE',
]

export function toDatabaseType(type: string): string {
  if (VALID_DB_TYPES.includes(type)) {
    return type
  }
  if (type === 'MESSAGE_RECEIVED') return 'DAILY_UPDATE'
  if (type === 'WORK_REASSIGNED') return 'WORK_ASSIGNED'
  if (type === 'WORK_COMPLETED' || type === 'WORK_SENT_BACK') return 'STATUS_CHANGED'
  if (type === 'CONCERN_RESOLVED') return 'CONCERN_REPORTED'
  if (type === 'COMMENT_ADDED') return 'WORK_UPDATED'
  return 'WORK_UPDATED'
}

export function parseNotificationRow(row: any) {
  if (!row) return row
  let logicalType = row.type
  let cleanTitle = row.title || ''

  const match = cleanTitle.match(/^\[([A-Z_]+)\]\s*(.*)$/)
  if (match) {
    logicalType = match[1]
    cleanTitle = match[2]
  } else if (
    cleanTitle.toLowerCase().includes('message from') ||
    cleanTitle.toLowerCase().includes('team chat')
  ) {
    logicalType = 'MESSAGE_RECEIVED'
  } else if (cleanTitle.includes('Completed')) {
    logicalType = 'WORK_COMPLETED'
  } else if (cleanTitle.includes('Sent Back')) {
    logicalType = 'WORK_SENT_BACK'
  } else if (cleanTitle.includes('Reassigned')) {
    logicalType = 'WORK_REASSIGNED'
  } else if (cleanTitle.includes('Concern Resolved')) {
    logicalType = 'CONCERN_RESOLVED'
  } else if (
    cleanTitle.includes('New comment') ||
    cleanTitle.includes('commented')
  ) {
    logicalType = 'COMMENT_ADDED'
  }

  return {
    ...row,
    type: logicalType,
    title: cleanTitle,
  }
}

export async function createNotification(input: {
  userId: string
  organizationId: string
  type: string
  title: string
  message: string
  workItemId?: string | null
  projectId?: string | null
}) {
  const dbType = toDatabaseType(input.type)
  const encodedTitle = `[${input.type}] ${input.title}`

  const { data, error } = await supabaseAdmin
    .from('notifications')
    .insert({
      user_id: input.userId,
      organization_id: input.organizationId,
      type: dbType,
      title: encodedTitle,
      message: input.message,
      work_item_id: input.workItemId || null,
      project_id: input.projectId || null,
      is_read: false,
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to create notification:', error)
    throw new Error(error.message)
  }

  return parseNotificationRow(data)
}

export async function getDirectManagerId(
  userId: string,
  organizationId: string,
): Promise<string | null> {
  if (!userId) return null
  try {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('manager_id')
      .eq('id', userId)
      .eq('organization_id', organizationId)
      .maybeSingle()
    return data?.manager_id || null
  } catch {
    return null
  }
}

export async function getOrganizationStakeholderIds(
  organizationId: string,
  roles: string[] = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
): Promise<string[]> {
  try {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('organization_id', organizationId)
      .in('role', roles)
      .eq('status', 'ACTIVE')

    return (data || []).map((p) => p.id)
  } catch {
    return []
  }
}

export async function notifyStakeholders(input: {
  organizationId: string
  title: string
  message: string
  type: string
  workItemId?: string | null
  projectId?: string | null
  authorUserId?: string
  recipients?: (string | null | undefined)[]
  includeAdminsAndManagers?: boolean
}) {
  const recipientSet = new Set<string>()

  if (input.recipients) {
    for (const r of input.recipients) {
      if (r && r !== input.authorUserId) {
        recipientSet.add(r)
      }
    }
  }

  if (input.includeAdminsAndManagers) {
    const adminManagerIds = await getOrganizationStakeholderIds(
      input.organizationId,
      ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
    )
    for (const id of adminManagerIds) {
      if (id !== input.authorUserId) {
        recipientSet.add(id)
      }
    }
  }

  const recipients = Array.from(recipientSet)
  if (recipients.length === 0) {
    return
  }

  await Promise.all(
    recipients.map(async (recipientId) => {
      try {
        await createNotification({
          userId: recipientId,
          organizationId: input.organizationId,
          type: input.type,
          title: input.title,
          message: input.message,
          workItemId: input.workItemId,
          projectId: input.projectId,
        })
      } catch (err) {
        console.error(
          `[Notifications] Failed to notify ${recipientId}:`,
          err,
        )
      }
    }),
  )
}

export async function notifyWorkStakeholders(input: {
  organizationId: string
  title: string
  message: string
  type: string
  workItemId?: string | null
  projectId?: string | null
  authorUserId?: string
  recipients: (string | null | undefined)[]
}) {
  const recipientIds = [
    ...new Set(
      input.recipients.filter(
        (id): id is string =>
          Boolean(id) && id !== input.authorUserId,
      ),
    ),
  ]

  for (const recipientId of recipientIds) {
    try {
      await createNotification({
        userId: recipientId,
        organizationId: input.organizationId,
        type: input.type,
        title: input.title,
        message: input.message,
        workItemId: input.workItemId,
        projectId: input.projectId,
      })
    } catch (error) {
      console.error(
        `[WorkNotification] Failed for ${recipientId}:`,
        error,
      )
    }
  }
}

export async function getProjectManagerId(
  projectId: string,
  organizationId: string,
): Promise<string | null> {
  if (!projectId) return null
  try {
    const { data } = await supabaseAdmin
      .from('projects')
      .select('project_manager_id')
      .eq('id', projectId)
      .eq('organization_id', organizationId)
      .maybeSingle()
    return data?.project_manager_id || null
  } catch {
    return null
  }
}

/**
 * Resolves the relevant management & supervisors for a task/project:
 * - Direct Manager of the assigned user
 * - Project Manager (if project-based)
 * - Organization Admins & Super Admins
 */
export async function getRelevantManagementStakeholders(input: {
  organizationId: string
  assignedTo?: string | null
  projectId?: string | null
  authorUserId?: string
}): Promise<string[]> {
  const recipients = new Set<string>()

  // 1. Direct manager of the worker
  if (input.assignedTo) {
    const directManagerId = await getDirectManagerId(input.assignedTo, input.organizationId)
    if (directManagerId) recipients.add(directManagerId)
  }

  // 2. Project manager of the project
  if (input.projectId) {
    const pmId = await getProjectManagerId(input.projectId, input.organizationId)
    if (pmId) recipients.add(pmId)
  }

  // 3. Organization leadership (Admins and Super Admins)
  const admins = await getOrganizationStakeholderIds(input.organizationId, [
    'SUPER_ADMIN',
    'ADMIN',
  ])
  for (const id of admins) {
    recipients.add(id)
  }

  // 4. Sender must never receive a notification for their own action
  if (input.authorUserId) {
    recipients.delete(input.authorUserId)
  }

  return Array.from(recipients)
}

/**
 * PART 3: NEW TASK ASSIGNMENT
 * Only the assigned user receives the task assignment notification.
 * Senders, creators, and other users are excluded.
 */
export async function notifyWorkAssignment(input: {
  organizationId: string
  workItemId: string
  projectId?: string | null
  title: string
  message: string
  authorUserId?: string
  assignedTo?: string | null
  createdBy?: string | null
}) {
  if (!input.assignedTo) return
  // Exclude self-assignment from notification spam
  if (input.authorUserId && input.assignedTo === input.authorUserId) return

  try {
    await createNotification({
      userId: input.assignedTo,
      organizationId: input.organizationId,
      type: NotificationType.WORK_ASSIGNED,
      title: input.title,
      message: input.message,
      workItemId: input.workItemId,
      projectId: input.projectId,
    })
  } catch (error) {
    console.error(
      `Failed to notify work assignment recipient ${input.assignedTo}:`,
      error,
    )
  }
}

/**
 * TASK REASSIGNMENT
 * Notifies the new assigned user (and previous assignee if different), excluding author.
 */
export async function notifyWorkReassignment(input: {
  organizationId: string
  workItemId: string
  projectId?: string | null
  title: string
  message: string
  authorUserId?: string
  previousAssignedTo?: string | null
  newAssignedTo?: string | null
  createdBy?: string | null
}) {
  const recipients = new Set<string>()

  if (input.newAssignedTo && input.newAssignedTo !== input.authorUserId) {
    recipients.add(input.newAssignedTo)
  }

  if (input.previousAssignedTo && input.previousAssignedTo !== input.authorUserId) {
    recipients.add(input.previousAssignedTo)
  }

  for (const recipientId of recipients) {
    try {
      await createNotification({
        userId: recipientId,
        organizationId: input.organizationId,
        type: NotificationType.WORK_REASSIGNED,
        title: input.title,
        message: input.message,
        workItemId: input.workItemId,
        projectId: input.projectId,
      })
    } catch (error) {
      console.error(
        `Failed to notify work reassignment recipient ${recipientId}:`,
        error,
      )
    }
  }
}

/**
 * PART 4: WORK STATUS UPDATES
 * Notifies relevant Admin(s) and Manager(s) responsible for monitoring the work.
 * Excludes the author/updater and unrelated employees.
 */
export async function notifyWorkStatusChange(input: {
  organizationId: string
  workItemId: string
  projectId?: string | null
  title: string
  message: string
  authorUserId?: string
  assignedTo?: string | null
}) {
  const recipients = await getRelevantManagementStakeholders({
    organizationId: input.organizationId,
    assignedTo: input.assignedTo,
    projectId: input.projectId,
    authorUserId: input.authorUserId,
  })

  for (const recipientId of recipients) {
    try {
      await createNotification({
        userId: recipientId,
        organizationId: input.organizationId,
        type: 'STATUS_CHANGED',
        title: input.title,
        message: input.message,
        workItemId: input.workItemId,
        projectId: input.projectId,
      })
    } catch (error) {
      console.error(
        `Failed to notify status change recipient ${recipientId}:`,
        error,
      )
    }
  }
}

/**
 * PART 4 & 5: WORK COMPLETED
 * Notifies relevant Admin(s) and Manager(s), excluding the person who completed the work.
 */
export async function notifyWorkCompleted(input: {
  organizationId: string
  workItemId: string
  projectId?: string | null
  title: string
  message: string
  authorUserId?: string
  assignedTo?: string | null
  createdBy?: string | null
}) {
  const recipients = await getRelevantManagementStakeholders({
    organizationId: input.organizationId,
    assignedTo: input.assignedTo,
    projectId: input.projectId,
    authorUserId: input.authorUserId,
  })

  for (const recipientId of recipients) {
    try {
      await createNotification({
        userId: recipientId,
        organizationId: input.organizationId,
        type: NotificationType.WORK_COMPLETED,
        title: input.title,
        message: input.message,
        workItemId: input.workItemId,
        projectId: input.projectId,
      })
    } catch (error) {
      console.error(
        `Failed to notify work completion recipient ${recipientId}:`,
        error,
      )
    }
  }
}

/**
 * WORK SENT BACK
 * Notifies the assigned user and relevant management, excluding author.
 */
export async function notifyWorkSentBack(input: {
  organizationId: string
  workItemId: string
  projectId?: string | null
  title: string
  message: string
  authorUserId?: string
  assignedTo?: string | null
  createdBy?: string | null
}) {
  const recipients = new Set<string>()

  if (input.assignedTo && input.assignedTo !== input.authorUserId) {
    recipients.add(input.assignedTo)
  }

  const management = await getRelevantManagementStakeholders({
    organizationId: input.organizationId,
    assignedTo: input.assignedTo,
    projectId: input.projectId,
    authorUserId: input.authorUserId,
  })

  for (const id of management) {
    recipients.add(id)
  }

  for (const recipientId of recipients) {
    try {
      await createNotification({
        userId: recipientId,
        organizationId: input.organizationId,
        type: NotificationType.WORK_SENT_BACK,
        title: input.title,
        message: input.message,
        workItemId: input.workItemId,
        projectId: input.projectId,
      })
    } catch (error) {
      console.error(
        `Failed to notify work sent back recipient ${recipientId}:`,
        error,
      )
    }
  }
}

/**
 * PART 6: DAILY REPORT SUBMITTED
 * Notifies relevant Admin(s) and Manager(s), excluding the submitter.
 */
export async function notifyDailyReportSubmitted(input: {
  organizationId: string
  submitterId: string
  title: string
  message: string
  projectId?: string | null
}) {
  const recipients = await getRelevantManagementStakeholders({
    organizationId: input.organizationId,
    assignedTo: input.submitterId,
    projectId: input.projectId,
    authorUserId: input.submitterId,
  })

  for (const recipientId of recipients) {
    try {
      await createNotification({
        userId: recipientId,
        organizationId: input.organizationId,
        type: NotificationType.DAILY_REPORT_SUBMITTED,
        title: input.title,
        message: input.message,
        projectId: input.projectId,
      })
    } catch (error) {
      console.error(
        `Failed to notify daily report submission recipient ${recipientId}:`,
        error,
      )
    }
  }
}

export async function getNotifications(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    throw new Error(error.message)
  }

  return (data || []).map(parseNotificationRow)
}

export async function getUnreadCount(userId: string) {
  const { count, error } = await supabaseAdmin
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false)

  if (error) {
    throw new Error(error.message)
  }

  return count || 0
}

export async function markNotificationRead(
  userId: string,
  notificationId: string,
) {
  const { data, error } = await supabaseAdmin
    .from('notifications')
    .update({
      is_read: true,
    })
    .eq('id', notificationId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return parseNotificationRow(data)
}

export async function markNotificationUnread(
  userId: string,
  notificationId: string,
) {
  const { data, error } = await supabaseAdmin
    .from('notifications')
    .update({
      is_read: false,
    })
    .eq('id', notificationId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return parseNotificationRow(data)
}

export async function markAllNotificationsRead(userId: string) {
  const { error } = await supabaseAdmin
    .from('notifications')
    .update({
      is_read: true,
    })
    .eq('user_id', userId)
    .eq('is_read', false)

  if (error) {
    throw new Error(error.message)
  }
}
