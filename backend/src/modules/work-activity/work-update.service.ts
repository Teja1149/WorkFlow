import { supabaseAdmin } from '../../lib/supabase.js'
import { logActivity } from './work-activity.service.js'
import { createNotification } from '../notifications/notification.service.js'

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
  progressPercent: number,
) {
  if (!updateText.trim()) {
    throw new Error('Update cannot be empty.')
  }

  if (progressPercent < 0 || progressPercent > 100) {
    throw new Error('Progress must be between 0 and 100.')
  }

  const { data, error } = await supabaseAdmin
    .from('work_updates')
    .insert({
      work_item_id: workItemId,
      employee_id: employeeId,
      update_text: updateText.trim(),
      progress_percent: progressPercent,
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

  // Automatically log activity
  await logActivity(
    workItemId,
    employeeId,
    'UPDATE_ADDED',
    `Submitted progress update (${progressPercent}%): ${updateText.trim()}`,
  )

  // Notify Creator / Manager
  try {
    const { data: item } = await supabaseAdmin
      .from('work_items')
      .select('created_by, organization_id, title, project_id')
      .eq('id', workItemId)
      .single()

    if (item && item.created_by && item.created_by !== employeeId) {
      const empName = data.employee?.first_name || 'An employee'
      await createNotification({
        userId: item.created_by,
        organizationId: item.organization_id,
        type: 'WORK_UPDATED',
        title: 'Employee update',
        message: `${empName} submitted an update on "${item.title}".`,
        workItemId: workItemId,
        projectId: item.project_id,
      })
    }
  } catch {
    // Ignore notification error
  }

  return data
}
