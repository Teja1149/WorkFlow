import { supabaseAdmin } from '../../lib/supabase.js'
import { logActivity } from './work-activity.service.js'
import { notifyStakeholders } from '../notifications/notification.service.js'

export async function getUpdates(workItemId: string) {
  const { data, error } = await supabaseAdmin
    .from('work_updates')
    .select(`
      id,
      work_item_id,
      employee_id,
      update_text,
      progress_percent,
      created_at,
      employee:profiles!work_updates_employee_id_fkey(
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

export async function addUpdate(
  workItemId: string,
  employeeId: string,
  updateText: string,
) {
  if (!updateText.trim()) {
    throw new Error('Update cannot be empty.')
  }

  const { data: work, error: workError } = await supabaseAdmin
    .from('work_items')
    .select(`
      id,
      assigned_to,
      title,
      project_id,
      organization_id,
      status,
      progress_percent
    `)
    .eq('id', workItemId)
    .single()

  if (workError || !work) {
    throw new Error('Work item not found.')
  }

  if (work.assigned_to !== employeeId) {
    throw new Error(
      'Only the assigned employee can submit this update.',
    )
  }

  if (work.status === 'BLOCKED') {
    throw new Error(
      'This work is currently on hold. Resolve the blocker before posting a work update.',
    )
  }

  const currentProgress =
    Number(work.progress_percent || 0)

  const { data, error } =
    await supabaseAdmin
      .from('work_updates')
      .insert({
        work_item_id: workItemId,
        employee_id: employeeId,
        update_text: updateText.trim(),

        // Keep historical compatibility,
        // but employee does NOT enter this value.
        progress_percent: currentProgress,
      })
      .select(`
        *,
        employee:profiles!work_updates_employee_id_fkey(
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

  await logActivity(
    workItemId,
    employeeId,
    'UPDATE_ADDED',
    `Work update submitted: ${updateText.trim()}`,
  )

  try {
    const { data: workRecipients } = await supabaseAdmin
      .from('work_items')
      .select('created_by, assigned_to')
      .eq('id', workItemId)
      .single()

    await notifyStakeholders({
      organizationId: work.organization_id,
      type: 'WORK_UPDATED',
      title: 'Work Update Received',
      message: `"${work.title}" received a new work update.`,
      workItemId,
      projectId: work.project_id,
      authorUserId: employeeId,
      recipients: [
        workRecipients?.created_by,
        workRecipients?.assigned_to,
      ].filter(
        (id): id is string =>
          Boolean(id) && id !== employeeId,
      ),
    })
  } catch (notificationError) {
    console.error(
      'Failed to notify work update recipients:',
      notificationError,
    )
  }

  return data
}
