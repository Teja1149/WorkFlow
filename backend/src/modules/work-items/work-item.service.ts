import { supabaseAdmin } from '../../lib/supabase.js'
import { logActivity } from '../work-activity/work-activity.service.js'
import {
  createNotification,
  notifyStakeholders,
} from '../notifications/notification.service.js'
import { transitionWorkItemStatus } from './work-item-status.service.js'

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

export type Status =
  | 'TODO'
  | 'IN_PROGRESS'
  | 'BLOCKED'
  | 'DONE'

export async function getWorkItems(
  organizationId: string,
  userId: string,
  role: string,
) {
  let query = supabaseAdmin
    .from('work_items')
    .select(`
      *,
      projects:project_id (
        id,
        name,
        project_key
      ),
      work_types:work_type_id (
        id,
        name,
        description,
        icon,
        color,
        is_active
      ),
      project_modules:module_id (
        id,
        name,
        description,
        is_active
      ),
      project_milestones:milestone_id (
        id,
        name,
        deadline,
        status
      ),
      assignee:assigned_to (
        id,
        first_name,
        last_name,
        email,
        employee_id,
        role
      ),
      creator:created_by (
        id,
        first_name,
        last_name,
        email
      )
    `)
    .eq('organization_id', organizationId)

  if (role === 'EMPLOYEE') {
    query = query.eq('assigned_to', userId)
  }

  if (role === 'MANAGER') {
    const { data: employeeProfiles, error: employeeError } =
      await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('role', 'EMPLOYEE')

    if (employeeError) {
      throw new Error(employeeError.message)
    }

    const employeeIds = (employeeProfiles || []).map(
      (employee) => employee.id,
    )

    // Manager sees:
    // 1. their own assigned work
    // 2. work assigned to employees
    const visibleIds = [...new Set([
      userId,
      ...employeeIds,
    ])]

    if (visibleIds.length > 0) {
      query = query.in('assigned_to', visibleIds)
    } else {
      query = query.eq('assigned_to', userId)
    }
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function createWorkItem(
  organizationId: string,
  createdBy: string,
  role?: string,
  input: {
    project_id: string
    work_type_id?: string | null
    module_id?: string | null
    milestone_id?: string | null
    assigned_to?: string | null
    title: string
    description?: string
    priority?: Priority
    start_date?: string | null
    deadline?: string | null
    deadline_time?: string | null
    estimated_hours?: number | null
    actual_hours?: number | null
    story_points?: number | null
  } = {} as any,
) {
  if (input.work_type_id) {
    const { data: workType, error: workTypeError } =
      await supabaseAdmin
        .from('work_types')
        .select('id, organization_id, is_active')
        .eq('id', input.work_type_id)
        .eq('organization_id', organizationId)
        .maybeSingle()

    if (workTypeError) {
      throw new Error(workTypeError.message)
    }

    if (!workType) {
      throw new Error('Work type not found.')
    }

    if (!workType.is_active) {
      throw new Error('This work type is archived.')
    }
  }

  if (input.module_id) {
    const { data: module, error: moduleError } =
      await supabaseAdmin
        .from('project_modules')
        .select('id, project_id, is_active')
        .eq('id', input.module_id)
        .maybeSingle()

    if (moduleError) {
      throw new Error(moduleError.message)
    }

    if (!module) {
      throw new Error('Module not found.')
    }

    if (!module.is_active) {
      throw new Error('This module is archived.')
    }

    if (module.project_id !== input.project_id) {
      throw new Error('Module must belong to the selected project.')
    }
  }

  if (input.milestone_id) {
    const { data: milestone, error: milestoneError } =
      await supabaseAdmin
        .from('project_milestones')
        .select('id, project_id')
        .eq('id', input.milestone_id)
        .maybeSingle()

    if (milestoneError) {
      throw new Error(milestoneError.message)
    }

    if (!milestone) {
      throw new Error('Milestone not found.')
    }

    if (milestone.project_id !== input.project_id) {
      throw new Error('Milestone must belong to the selected project.')
    }
  }

  if (input.assigned_to) {
    const { data: assignee, error: assigneeError } =
      await supabaseAdmin
        .from('profiles')
        .select('id, organization_id, role')
        .eq('id', input.assigned_to)
        .eq('organization_id', organizationId)
        .maybeSingle()

    if (assigneeError) {
      throw new Error(assigneeError.message)
    }

    if (!assignee) {
      throw new Error('Assignee not found.')
    }

    if (!['EMPLOYEE', 'MANAGER'].includes(assignee.role)) {
      throw new Error(
        'Work can only be assigned to an employee or manager.',
      )
    }

    if (
      role === 'MANAGER' &&
      assignee.role !== 'EMPLOYEE'
    ) {
      throw new Error(
        'Managers can only assign work to employees.',
      )
    }
  }

  const { data, error } = await supabaseAdmin
    .from('work_items')
    .insert({
      organization_id: organizationId,
      project_id: input.project_id,
      work_type_id: input.work_type_id || null,
      module_id: input.module_id || null,
      milestone_id: input.milestone_id || null,
      assigned_to: input.assigned_to || null,
      created_by: createdBy,
      title: input.title,
      description: input.description || null,
      priority: input.priority || 'MEDIUM',
      status: 'TODO',
      start_date: input.start_date || null,
      deadline: input.deadline || null,
      deadline_time: input.deadline_time || null,
      original_deadline: input.deadline || null,
      estimated_hours: input.estimated_hours ?? 0,
      actual_hours: input.actual_hours ?? 0,
      story_points: input.story_points ?? null,
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  if (data.assigned_to) {
    try {
      await supabaseAdmin
        .from('work_assignment_history')
        .insert({
          work_item_id: data.id,
          organization_id: organizationId,
          previous_assignee: null,
          new_assignee: data.assigned_to,
          changed_by: createdBy,
          reason: 'Initial assignment',
        })
    } catch (histErr) {
      console.error('Failed to log initial assignment history:', histErr)
    }
  }

  // Log activity
  await logActivity(data.id, createdBy, 'WORK_ASSIGNED', `Created work item: ${input.title}`)

  // Automatic Notifications to Manager, Admins, and Assigned Employee
  try {
    await notifyStakeholders({
      organizationId,
      title: 'New Work Item Created',
      message: `Work item "${data.title}" was created.`,
      type: 'WORK_ASSIGNED',
      workItemId: data.id,
      projectId: data.project_id,
      authorUserId: createdBy,
      recipients: [data.assigned_to],
    })
  } catch (notifErr) {
    console.error('Failed to notify work creation:', notifErr)
  }

  return data
}

export async function updateWorkItem(
  organizationId: string,
  userId: string,
  role: string,
  workItemId: string,
  input: {
    status?: Status
    priority?: Priority
    deadline?: string | null
    deadline_time?: string | null
    description?: string
    title?: string
    assigned_to?: string | null
    work_type_id?: string | null
    module_id?: string | null
    milestone_id?: string | null
    estimated_hours?: number | null
    actual_hours?: number | null
    progress_percent?: number
    assignment_reason?: string
  },
) {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('work_items')
    .select(`
      id,
      organization_id,
      assigned_to,
      status,
      progress_percent,
      title,
      project_id,
      created_by,
      start_date
    `)
    .eq('id', workItemId)
    .single()

  if (existingError || !existing || existing.organization_id !== organizationId) {
    throw new Error('Work item not found.')
  }

  if (
    input.progress_percent !== undefined &&
    (
      input.progress_percent < 0 ||
      input.progress_percent > 100
    )
  ) {
    throw new Error(
      'Progress must be between 0 and 100.',
    )
  }

  const nextStatus = input.status

  if (nextStatus && nextStatus !== existing.status) {
    await transitionWorkItemStatus(
      organizationId,
      userId,
      role,
      workItemId,
      nextStatus as any,
    )
  }

  if (role === 'EMPLOYEE') {
    if (existing.assigned_to !== userId) {
      throw new Error('You cannot update this work item.')
    }

    if (
      input.assigned_to !== undefined ||
      input.work_type_id !== undefined ||
      input.module_id !== undefined ||
      input.milestone_id !== undefined ||
      input.estimated_hours !== undefined
    ) {
      throw new Error(
        'Employees are not allowed to modify structural parameters (assignee, module, milestone, work type, or estimated hours).',
      )
    }
  }

  if (input.assigned_to !== undefined && input.assigned_to !== null) {
    const { data: assignee, error: assigneeError } =
      await supabaseAdmin
        .from('profiles')
        .select('id, organization_id, role')
        .eq('id', input.assigned_to)
        .eq('organization_id', organizationId)
        .maybeSingle()

    if (assigneeError) {
      throw new Error(assigneeError.message)
    }

    if (!assignee) {
      throw new Error('Assignee not found.')
    }

    if (!['EMPLOYEE', 'MANAGER'].includes(assignee.role)) {
      throw new Error(
        'Work can only be assigned to an employee or manager.',
      )
    }

    if (
      role === 'MANAGER' &&
      assignee.role !== 'EMPLOYEE'
    ) {
      throw new Error(
        'Managers can only assign work to employees.',
      )
    }
  }

  if (input.module_id !== undefined && input.module_id) {
    const { data: module, error: moduleError } = await supabaseAdmin
      .from('project_modules')
      .select('id, project_id, is_active')
      .eq('id', input.module_id)
      .maybeSingle()

    if (moduleError) {
      throw new Error(moduleError.message)
    }

    if (!module) {
      throw new Error('Module not found.')
    }

    if (!module.is_active) {
      throw new Error('This module is archived.')
    }

    if (module.project_id !== existing.project_id) {
      throw new Error('Module must belong to the selected project.')
    }
  }

  if (input.milestone_id !== undefined && input.milestone_id) {
    const { data: milestone, error: milestoneError } = await supabaseAdmin
      .from('project_milestones')
      .select('id, project_id')
      .eq('id', input.milestone_id)
      .maybeSingle()

    if (milestoneError) {
      throw new Error(milestoneError.message)
    }

    if (!milestone) {
      throw new Error('Milestone not found.')
    }

    if (milestone.project_id !== existing.project_id) {
      throw new Error('Milestone must belong to the selected project.')
    }
  }

  const updateData: any = {
    updated_at: new Date().toISOString(),
  }

  if (input.priority) updateData.priority = input.priority
  if (input.deadline !== undefined) updateData.deadline = input.deadline
  if (input.deadline_time !== undefined) updateData.deadline_time = input.deadline_time
  if (input.description !== undefined) updateData.description = input.description
  if (input.title) updateData.title = input.title
  if (input.assigned_to !== undefined) updateData.assigned_to = input.assigned_to
  if (input.work_type_id !== undefined) updateData.work_type_id = input.work_type_id
  if (input.module_id !== undefined) updateData.module_id = input.module_id
  if (input.milestone_id !== undefined) updateData.milestone_id = input.milestone_id
  if (input.estimated_hours !== undefined) updateData.estimated_hours = input.estimated_hours
  if (input.actual_hours !== undefined) updateData.actual_hours = input.actual_hours
  if (input.progress_percent !== undefined) updateData.progress_percent = input.progress_percent

  const { data, error } = await supabaseAdmin
    .from('work_items')
    .update(updateData)
    .eq('id', workItemId)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  if (
    input.progress_percent !== undefined &&
    Number(input.progress_percent) !==
      Number(existing.progress_percent || 0)
  ) {
    try {
      await logActivity(
        workItemId,
        userId,
        'PROGRESS_UPDATED',
        `Progress changed from ${existing.progress_percent || 0}% to ${input.progress_percent}%.`,
      )
    } catch (actErr) {
      console.error('Failed to log PROGRESS_UPDATED activity:', actErr)
    }
  }

  const assigneeChanged =
    input.assigned_to !== undefined &&
    input.assigned_to !== existing.assigned_to

  if (assigneeChanged) {
    await supabaseAdmin
      .from('work_assignment_history')
      .insert({
        work_item_id: workItemId,
        organization_id: organizationId,
        previous_assignee: existing.assigned_to,
        new_assignee: input.assigned_to || null,
        changed_by: userId,
        reason: input.assignment_reason?.trim() || null,
      })

    if (input.assigned_to) {
      try {
        const reasonText = input.assignment_reason?.trim()
          ? ` Reason: ${input.assignment_reason.trim()}`
          : ''
        await notifyStakeholders({
          organizationId,
          title: 'Work Reassigned',
          message: `"${existing.title}" has been assigned to you.${reasonText}`,
          type: 'WORK_REASSIGNED',
          workItemId,
          projectId: existing.project_id,
          authorUserId: userId,
          recipients: [input.assigned_to],
        })
      } catch (notifErr) {
        console.error('Failed to notify work reassignment:', notifErr)
      }
    }
  }

  return data
}

export async function deleteWorkItem(
  organizationId: string,
  workItemId: string,
) {
  const { error } = await supabaseAdmin
    .from('work_items')
    .delete()
    .eq('id', workItemId)
    .eq('organization_id', organizationId)

  if (error) {
    throw new Error(error.message)
  }
}

// Work Updates
export async function getWorkUpdates(
  organizationId: string,
  workItemId: string,
) {
  const { data: work } = await supabaseAdmin
    .from('work_items')
    .select('id')
    .eq('id', workItemId)
    .eq('organization_id', organizationId)
    .single()

  if (!work) {
    throw new Error('Work item not found.')
  }

  const { data, error } = await supabaseAdmin
    .from('work_updates')
    .select(`
      *,
      employee:employee_id (
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

export interface AddWorkUpdateInput {
  update_text: string
  report_data?: Record<string, unknown>
  actual_value?: number
  progress_percent?: number
}

export async function createWorkUpdate(
  organizationId: string,
  employeeId: string,
  workItemId: string,
  input: AddWorkUpdateInput,
) {
  const { data: work } = await supabaseAdmin
    .from('work_items')
    .select(
      'id, assigned_to, title, project_id, status, progress_percent, completed_at',
    )
    .eq('id', workItemId)
    .eq('organization_id', organizationId)
    .single()

  if (!work) {
    throw new Error('Work item not found.')
  }

  if (work.assigned_to !== employeeId) {
    throw new Error('Only the assigned employee can submit this update.')
  }

  if (!input.update_text?.trim()) {
    throw new Error('Update summary cannot be empty.')
  }

  if (work.status === 'BLOCKED') {
    throw new Error(
      'This work is currently on hold. Resolve the blocker before posting an update.',
    )
  }

  // Derive progress strictly from actual target calculation or status
  let calculatedProgress = Number(work.progress_percent || 0)

  if (input.actual_value !== undefined) {
    // Check if there is a linked daily target to compute exact achievement
    const { data: linkedTarget } = await supabaseAdmin
      .from('daily_work_targets')
      .select('target_value')
      .eq('work_item_id', workItemId)
      .maybeSingle()

    const targetVal = Number(linkedTarget?.target_value || 1)
    calculatedProgress = Math.min(100, Math.round((Number(input.actual_value) / Math.max(1, targetVal)) * 100))
  } else if (work.status === 'DONE') {
    calculatedProgress = 100
  }

  const { data, error } = await supabaseAdmin
    .from('work_updates')
    .insert({
      work_item_id: workItemId,
      employee_id: employeeId,
      update_text: input.update_text.trim(),
      progress_percent: calculatedProgress,
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  const updatePayload: Record<string, unknown> = {
    progress_percent: calculatedProgress,
    updated_at: new Date().toISOString(),
  }

  if (work.status === 'TODO') {
    updatePayload.status = 'IN_PROGRESS'
  }

  await supabaseAdmin
    .from('work_items')
    .update(updatePayload)
    .eq('id', workItemId)

  await logActivity(
    workItemId,
    employeeId,
    'DAILY_UPDATE',
    'Employee posted a work update.',
  )

  try {
    const { data: workRecipients } = await supabaseAdmin
      .from('work_items')
      .select('created_by, assigned_to, title, project_id')
      .eq('id', workItemId)
      .single()

    await notifyStakeholders({
      organizationId,
      type: 'WORK_UPDATED',
      title: 'Work Update Received',
      message: `"${work.title}" has a new work update.`,
      workItemId,
      projectId: workRecipients?.project_id,
      authorUserId: employeeId,
      recipients: [
        workRecipients?.created_by,
        workRecipients?.assigned_to,
      ].filter(
        (id): id is string => Boolean(id) && id !== employeeId,
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

// Work Comments
export async function getWorkComments(
  organizationId: string,
  workItemId: string,
) {
  const { data: work } = await supabaseAdmin
    .from('work_items')
    .select('id')
    .eq('id', workItemId)
    .eq('organization_id', organizationId)
    .single()

  if (!work) {
    throw new Error('Work item not found.')
  }

  const { data, error } = await supabaseAdmin
    .from('work_comments')
    .select(`
      *,
      user:user_id (
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

export async function createWorkComment(
  organizationId: string,
  userId: string,
  workItemId: string,
  input: {
    comment: string
    parent_comment_id?: string | null
  },
) {
  if (!input.comment?.trim()) {
    throw new Error('Comment cannot be empty.')
  }

  const { data: work } = await supabaseAdmin
    .from('work_items')
    .select('id, assigned_to, created_by, title, project_id')
    .eq('id', workItemId)
    .eq('organization_id', organizationId)
    .single()

  if (!work) {
    throw new Error('Work item not found.')
  }

  const { data, error } = await supabaseAdmin
    .from('work_comments')
    .insert({
      work_item_id: workItemId,
      user_id: userId,
      parent_comment_id: input.parent_comment_id || null,
      comment: input.comment.trim(),
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  await logActivity(
    workItemId,
    userId,
    'COMMENT_ADDED',
    'A comment was added.',
  )

  // Notify everyone directly involved with the work item,
  // except the person who posted the comment.
  const recipients = [
    work.assigned_to,
    work.created_by,
  ].filter(
    (id): id is string =>
      Boolean(id) && id !== userId,
  )

  for (const recipientId of [
    ...new Set(recipients),
  ]) {
    try {
      await createNotification({
        userId: recipientId,
        organizationId,
        type: 'COMMENT_ADDED',
        title: 'New work comment',
        message: `A new comment was added to "${work.title}".`,
        workItemId,
        projectId: work.project_id,
      })
    } catch (notificationError) {
      console.error(
        'Failed to notify comment recipient:',
        notificationError,
      )
    }
  }

  return data
}

// Work Concerns
export async function getWorkConcerns(
  organizationId: string,
  workItemId: string,
) {
  const { data: work } = await supabaseAdmin
    .from('work_items')
    .select('id')
    .eq('id', workItemId)
    .eq('organization_id', organizationId)
    .single()

  if (!work) {
    throw new Error('Work item not found.')
  }

  const { data, error } = await supabaseAdmin
    .from('work_concerns')
    .select(`
      *,
      reporter:reported_by (
        id,
        first_name,
        last_name,
        employee_id
      ),
      resolver:resolved_by (
        id,
        first_name,
        last_name
      )
    `)
    .eq('work_item_id', workItemId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function createWorkConcern(
  organizationId: string,
  userId: string,
  workItemId: string,
  input: {
    concern: string
  },
) {
  if (!input.concern?.trim()) {
    throw new Error('Concern cannot be empty.')
  }

  const { data: work } = await supabaseAdmin
    .from('work_items')
    .select('id, created_by, assigned_to, title, project_id')
    .eq('id', workItemId)
    .eq('organization_id', organizationId)
    .single()

  if (!work) {
    throw new Error('Work item not found.')
  }

  const { data, error } = await supabaseAdmin
    .from('work_concerns')
    .insert({
      work_item_id: workItemId,
      reported_by: userId,
      concern: input.concern.trim(),
      status: 'OPEN',
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  await logActivity(
    workItemId,
    userId,
    'CONCERN_REPORTED',
    'A work concern was reported.',
  )

  const notifyUser =
    userId === work.assigned_to ? work.created_by : work.assigned_to

  if (notifyUser) {
    await createNotification({
      userId: notifyUser,
      organizationId,
      type: 'CONCERN_REPORTED',
      title: 'Work concern reported',
      message: `A concern was reported on "${work.title}".`,
      workItemId,
      projectId: work.project_id,
    })
  }

  return data
}

export async function resolveConcern(
  organizationId: string,
  userId: string,
  workItemId: string,
  concernId: string,
) {
  const { data: concern } = await supabaseAdmin
    .from('work_concerns')
    .select(
      'id, work_item_id, reported_by, concern',
    )
    .eq('id', concernId)
    .eq('work_item_id', workItemId)
    .single()

  if (!concern) {
    throw new Error('Concern not found.')
  }

  const { data: work } = await supabaseAdmin
    .from('work_items')
    .select('id')
    .eq('id', workItemId)
    .eq('organization_id', organizationId)
    .single()

  if (!work) {
    throw new Error('Work item not found.')
  }

  const { data, error } = await supabaseAdmin
    .from('work_concerns')
    .update({
      status: 'RESOLVED',
      resolved_by: userId,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', concernId)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  await logActivity(
    workItemId,
    userId,
    'CONCERN_RESOLVED',
    'A work concern was resolved.',
  )

  // Notify the person who originally reported
  // the concern.
  if (
    concern.reported_by &&
    concern.reported_by !== userId
  ) {
    try {
      await createNotification({
        userId: concern.reported_by,
        organizationId,
        type: 'CONCERN_RESOLVED',
        title: 'Work concern resolved',
        message: `Your concern on "${workItemId}" has been resolved.`,
        workItemId,
      })
    } catch (notificationError) {
      console.error(
        'Failed to notify concern reporter:',
        notificationError,
      )
    }
  }

  return data
}

export async function getWorkAssignmentHistory(
  organizationId: string,
  workItemId: string,
) {
  const { data, error } = await supabaseAdmin
    .from('work_assignment_history')
    .select(`
      id,
      work_item_id,
      previous_assignee,
      new_assignee,
      changed_by,
      reason,
      created_at,
      prev_user:previous_assignee (
        id,
        first_name,
        last_name,
        email
      ),
      next_user:new_assignee (
        id,
        first_name,
        last_name,
        email
      ),
      changer:changed_by (
        id,
        first_name,
        last_name,
        email
      )
    `)
    .eq('organization_id', organizationId)
    .eq('work_item_id', workItemId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return data || []
}
