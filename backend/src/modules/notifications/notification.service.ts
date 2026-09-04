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
  const recipients = new Set<string>()

  if (input.assignedTo) {
    recipients.add(input.assignedTo)
    const managerId = await getDirectManagerId(input.assignedTo, input.organizationId)
    if (managerId) {
      recipients.add(managerId)
    }
  }

  if (input.createdBy) {
    recipients.add(input.createdBy)
  }

  // Include admins and managers
  const leadership = await getOrganizationStakeholderIds(input.organizationId, [
    'SUPER_ADMIN',
    'ADMIN',
    'MANAGER',
  ])
  for (const id of leadership) {
    recipients.add(id)
  }

  if (input.authorUserId) {
    recipients.delete(input.authorUserId)
  }

  for (const recipientId of recipients) {
    try {
      await createNotification({
        userId: recipientId,
        organizationId: input.organizationId,
        type: NotificationType.WORK_ASSIGNED,
        title: input.title,
        message: input.message,
        workItemId: input.workItemId,
        projectId: input.projectId,
      })
    } catch (error) {
      console.error(
        `Failed to notify work assignment recipient ${recipientId}:`,
        error,
      )
    }
  }
}

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

  if (input.previousAssignedTo) {
    recipients.add(input.previousAssignedTo)
    const prevManager = await getDirectManagerId(input.previousAssignedTo, input.organizationId)
    if (prevManager) recipients.add(prevManager)
  }

  if (input.newAssignedTo) {
    recipients.add(input.newAssignedTo)
    const newManager = await getDirectManagerId(input.newAssignedTo, input.organizationId)
    if (newManager) recipients.add(newManager)
  }

  if (input.createdBy) {
    recipients.add(input.createdBy)
  }

  const leadership = await getOrganizationStakeholderIds(input.organizationId, [
    'SUPER_ADMIN',
    'ADMIN',
    'MANAGER',
  ])
  for (const id of leadership) {
    recipients.add(id)
  }

  if (input.authorUserId) {
    recipients.delete(input.authorUserId)
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
  const recipients = new Set<string>()

  if (input.createdBy) {
    recipients.add(input.createdBy)
  }

  if (input.assignedTo) {
    const managerId = await getDirectManagerId(input.assignedTo, input.organizationId)
    if (managerId) recipients.add(managerId)
  }

  const leadership = await getOrganizationStakeholderIds(input.organizationId, [
    'SUPER_ADMIN',
    'ADMIN',
    'MANAGER',
  ])
  for (const id of leadership) {
    recipients.add(id)
  }

  if (input.authorUserId) {
    recipients.delete(input.authorUserId)
  }

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

  if (input.assignedTo) {
    recipients.add(input.assignedTo)
    const managerId = await getDirectManagerId(input.assignedTo, input.organizationId)
    if (managerId) recipients.add(managerId)
  }

  if (input.createdBy) {
    recipients.add(input.createdBy)
  }

  const leadership = await getOrganizationStakeholderIds(input.organizationId, [
    'SUPER_ADMIN',
    'ADMIN',
  ])
  for (const id of leadership) {
    recipients.add(id)
  }

  if (input.authorUserId) {
    recipients.delete(input.authorUserId)
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
