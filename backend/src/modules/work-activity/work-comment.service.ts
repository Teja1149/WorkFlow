import { supabaseAdmin } from '../../lib/supabase.js'
import { logActivity } from './work-activity.service.js'
import { createNotification } from '../notifications/notification.service.js'
import { NotificationType } from '../notifications/notification.types.js'

export async function getComments(workItemId: string) {
  const { data, error } = await supabaseAdmin
    .from('work_comments')
    .select(`
      id,
      work_item_id,
      user_id,
      parent_comment_id,
      comment,
      created_at,
      updated_at,
      user:profiles!work_comments_user_id_fkey(
        id,
        first_name,
        last_name,
        role
      )
    `)
    .eq('work_item_id', workItemId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function addComment(
  workItemId: string,
  userId: string,
  comment: string,
  parentCommentId?: string | null,
) {
  if (!comment.trim()) {
    throw new Error('Comment cannot be empty.')
  }

  const { data, error } = await supabaseAdmin
    .from('work_comments')
    .insert({
      work_item_id: workItemId,
      user_id: userId,
      parent_comment_id: parentCommentId || null,
      comment: comment.trim(),
    })
    .select(`
      *,
      user:profiles!work_comments_user_id_fkey(
        id,
        first_name,
        last_name,
        role
      )
    `)
    .single()

  if (error) {
    throw new Error(error.message)
  }

  // Automatically log activity
  await logActivity(workItemId, userId, 'COMMENT_ADDED', 'Added a comment.')

  // Notify Assignee / Creator
  try {
    const { data: item } = await supabaseAdmin
      .from('work_items')
      .select('created_by, assigned_to, organization_id, title, project_id')
      .eq('id', workItemId)
      .single()

    if (item) {
      const recipients = [
        item.created_by,
        item.assigned_to,
      ].filter(
        (id): id is string =>
          Boolean(id) && id !== userId,
      )

      const userName = data.user?.first_name || 'Someone'

      for (const recipientId of [...new Set(recipients)]) {
        try {
          await createNotification({
            userId: recipientId,
            organizationId: item.organization_id,
            type: NotificationType.COMMENT_ADDED,
            title: 'New comment',
            message: `${userName} commented on "${item.title}".`,
            workItemId,
            projectId: item.project_id,
          })
        } catch (notificationError) {
          console.error(
            `Failed to notify ${recipientId} about comment:`,
            notificationError,
          )
        }
      }
    }
  } catch {
    // Ignore notification error
  }

  return data
}
