import { supabaseAdmin } from '../../lib/supabase.js'
import { notifyStakeholders } from '../notifications/notification.service.js'

export interface CreateSprintInput {
  name: string
  goal?: string
  startDate?: string
  endDate?: string
}

export interface UpdateSprintInput {
  name?: string
  goal?: string
  startDate?: string
  endDate?: string
  status?: 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
}

export async function verifyProjectInOrg(projectId: string, organizationId: string) {
  const { data: project, error } = await supabaseAdmin
    .from('projects')
    .select('id, organization_id')
    .eq('id', projectId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!project) {
    throw new Error('Project not found or does not belong to your organization.')
  }
  return project
}

export async function verifySprintInOrg(sprintId: string, organizationId: string) {
  const { data: sprint, error } = await supabaseAdmin
    .from('sprints')
    .select(`
      id,
      name,
      goal,
      status,
      start_date,
      end_date,
      project_id,
      created_by,
      created_at,
      updated_at,
      projects!inner (
        id,
        organization_id,
        name,
        project_key
      )
    `)
    .eq('id', sprintId)
    .eq('projects.organization_id', organizationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!sprint) {
    throw new Error('Sprint not found or does not belong to your organization.')
  }
  return sprint
}

export async function createSprint(
  organizationId: string,
  projectId: string,
  createdBy: string,
  input: CreateSprintInput,
) {
  if (!input.name?.trim()) {
    throw new Error('Sprint name is required.')
  }

  if (
    input.startDate &&
    input.endDate &&
    input.endDate < input.startDate
  ) {
    throw new Error('Sprint end date cannot be before the start date.')
  }

  await verifyProjectInOrg(projectId, organizationId)

  const { data, error } = await supabaseAdmin
    .from('sprints')
    .insert({
      project_id: projectId,
      name: input.name.trim(),
      goal: input.goal?.trim() || null,
      status: 'PLANNED',
      start_date: input.startDate || null,
      end_date: input.endDate || null,
      created_by: createdBy,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  return data
}

export async function getProjectSprints(organizationId: string, projectId: string) {
  await verifyProjectInOrg(projectId, organizationId)

  const { data, error } = await supabaseAdmin
    .from('sprints')
    .select(`
      *,
      sprint_work_items (
        id,
        work_item_id,
        created_at
      )
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return data || []
}

export async function getSprintById(organizationId: string, sprintId: string) {
  await verifySprintInOrg(sprintId, organizationId)

  const { data, error } = await supabaseAdmin
    .from('sprints')
    .select(`
      *,
      projects (
        id,
        name,
        project_key
      ),
      sprint_work_items (
        id,
        work_item_id,
        created_at,
        work_items (
          id,
          title,
          description,
          priority,
          status,
          assigned_to,
          deadline,
          progress_percent
        )
      )
    `)
    .eq('id', sprintId)
    .maybeSingle()

  if (error) throw new Error(error.message)

  if (!data) {
    throw new Error('Sprint not found.')
  }

  return data
}

export async function updateSprint(
  organizationId: string,
  sprintId: string,
  input: UpdateSprintInput,
) {
  await verifySprintInOrg(sprintId, organizationId)

  if (
    input.startDate &&
    input.endDate &&
    input.endDate < input.startDate
  ) {
    throw new Error('Sprint end date cannot be before the start date.')
  }

  const payload: Record<string, any> = {}

  if (input.name !== undefined) {
    if (!input.name.trim()) {
      throw new Error('Sprint name cannot be empty.')
    }

    payload.name = input.name.trim()
  }

  if (input.goal !== undefined) {
    payload.goal = input.goal?.trim() || null
  }

  if (input.startDate !== undefined) {
    payload.start_date = input.startDate || null
  }

  if (input.endDate !== undefined) {
    payload.end_date = input.endDate || null
  }

  if (input.status !== undefined) {
    payload.status = input.status
  }

  payload.updated_at = new Date().toISOString()

  const { data, error } = await supabaseAdmin
    .from('sprints')
    .update(payload)
    .eq('id', sprintId)
    .select()
    .single()

  if (error) throw new Error(error.message)

  return data
}

export async function deleteSprint(organizationId: string, sprintId: string) {
  const sprint = await verifySprintInOrg(sprintId, organizationId)

  if (sprint.status === 'ACTIVE') {
    throw new Error(
      'An active sprint cannot be deleted. Complete or cancel it first.',
    )
  }

  const { count, error: countError } = await supabaseAdmin
    .from('sprint_work_items')
    .select('id', {
      count: 'exact',
      head: true,
    })
    .eq('sprint_id', sprintId)

  if (countError) throw new Error(countError.message)

  if ((count || 0) > 0) {
    throw new Error(
      'Remove all work items from the sprint before deleting it.',
    )
  }

  const { error } = await supabaseAdmin
    .from('sprints')
    .delete()
    .eq('id', sprintId)

  if (error) throw new Error(error.message)

  return { success: true }
}

export async function startSprint(organizationId: string, sprintId: string) {
  const sprint = await verifySprintInOrg(sprintId, organizationId)

  if (sprint.status !== 'PLANNED') {
    throw new Error(
      `Only a planned sprint can be started. Current status: ${sprint.status}.`,
    )
  }

  const { data, error } = await supabaseAdmin
    .from('sprints')
    .update({
      status: 'ACTIVE',
      updated_at: new Date().toISOString(),
    })
    .eq('id', sprintId)
    .select()
    .single()

  if (error) throw new Error(error.message)

  return data
}

export async function completeSprint(
  organizationId: string,
  sprintId: string,
  completedBy: string,
) {
  const sprint = await verifySprintInOrg(sprintId, organizationId)

  if (sprint.status !== 'ACTIVE') {
    throw new Error(
      `Only an active sprint can be completed. Current status: ${sprint.status}.`,
    )
  }

  const { data, error } = await supabaseAdmin
    .from('sprints')
    .update({
      status: 'COMPLETED',
      updated_at: new Date().toISOString(),
    })
    .eq('id', sprintId)
    .select()
    .single()

  if (error) throw new Error(error.message)

  try {
    await createSprintReview(
      sprintId,
      organizationId,
      completedBy,
    )
  } catch (revErr) {
    console.error('Failed to create sprint review:', revErr)
  }

  try {
    const summaryData = await getSprintExecutionSummary(organizationId, sprintId).catch(() => null)
    const completedPts = summaryData?.summary?.completed || 0
    const totalPts = summaryData?.summary?.total || 0
    const progress = summaryData?.summary?.progress || 0
    const incompleteCount = summaryData?.summary?.active || 0
    const carryForwardCount = summaryData?.summary?.carryForward || 0
    const criticalCount = summaryData?.summary?.critical || 0
    const blockedCount = summaryData?.summary?.blocked || 0

    await notifyStakeholders({
      organizationId,
      title: 'Sprint Completed',
      message: `Sprint "${sprint.name}" has been closed. ${completedPts} / ${totalPts} work items completed (${progress}% execution). ${incompleteCount} items remain incomplete. (Carry Forward: ${carryForwardCount}, Critical: ${criticalCount}, Blocked: ${blockedCount})`,
      type: 'SYSTEM_ALERT',
      workItemId: undefined,
    })
  } catch (notifErr) {
    console.error('Failed to send sprint completion notification:', notifErr)
  }

  return data
}

export async function cancelSprint(organizationId: string, sprintId: string) {
  const sprint = await verifySprintInOrg(sprintId, organizationId)

  if (
    sprint.status !== 'PLANNED' &&
    sprint.status !== 'ACTIVE'
  ) {
    throw new Error(
      `A ${sprint.status.toLowerCase()} sprint cannot be cancelled.`,
    )
  }

  const { data, error } = await supabaseAdmin
    .from('sprints')
    .update({
      status: 'CANCELLED',
      updated_at: new Date().toISOString(),
    })
    .eq('id', sprintId)
    .select()
    .single()

  if (error) throw new Error(error.message)

  return data
}

export async function addWorkItemToSprint(
  organizationId: string,
  sprintId: string,
  workItemId: string,
) {
  const sprint = await verifySprintInOrg(sprintId, organizationId)

  if (
    sprint.status === 'COMPLETED' ||
    sprint.status === 'CANCELLED'
  ) {
    throw new Error(
      'Work items cannot be added to a completed or cancelled sprint.',
    )
  }

  const { data: workItem, error: workError } = await supabaseAdmin
    .from('work_items')
    .select('id, project_id, organization_id')
    .eq('id', workItemId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (workError) throw new Error(workError.message)

  if (!workItem) {
    throw new Error('Work item not found or does not belong to your organization.')
  }

  if (workItem.project_id !== sprint.project_id) {
    throw new Error(
      'Work item must belong to the same project as the sprint.',
    )
  }

  // Prevent the same work item from being assigned
  // to another sprint at the same time.
  const { data: existingAssignment, error: existingError } =
    await supabaseAdmin
      .from('sprint_work_items')
      .select(`
        id,
        sprint_id,
        sprints (
          id,
          name,
          status
        )
      `)
      .eq('work_item_id', workItemId)
      .maybeSingle()

  if (existingError) {
    throw new Error(existingError.message)
  }

  if (existingAssignment) {
    const existingSprint: any = existingAssignment.sprints

    if (existingAssignment.sprint_id === sprintId) {
      throw new Error(
        'Work item is already part of this sprint.',
      )
    }

    throw new Error(
      `Work item is already assigned to sprint "${existingSprint?.name || 'another sprint'}".`,
    )
  }

  const { data, error } = await supabaseAdmin
    .from('sprint_work_items')
    .insert({
      sprint_id: sprintId,
      work_item_id: workItemId,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error('Work item is already part of this sprint.')
    }

    throw new Error(error.message)
  }

  return data
}

export async function removeWorkItemFromSprint(
  organizationId: string,
  sprintId: string,
  workItemId: string,
) {
  await verifySprintInOrg(sprintId, organizationId)

  const { error } = await supabaseAdmin
    .from('sprint_work_items')
    .delete()
    .eq('sprint_id', sprintId)
    .eq('work_item_id', workItemId)

  if (error) throw new Error(error.message)

  return { success: true }
}

export async function getSprintProgress(
  organizationId: string,
  sprintId: string,
) {
  await verifySprintInOrg(sprintId, organizationId)

  const { data, error } = await supabaseAdmin
    .from('sprint_work_items')
    .select(`
      work_items (
        id,
        status,
        progress_percent
      )
    `)
    .eq('sprint_id', sprintId)

  if (error) throw new Error(error.message)

  const items = (data || [])
    .map((row: any) => row.work_items)
    .filter(Boolean)

  if (items.length === 0) {
    return {
      totalItems: 0,
      completedItems: 0,
      progressPercent: 0,
    }
  }

  const completedItems = items.filter(
    (item: any) =>
      item.status === 'DONE' ||
      Number(item.progress_percent || 0) >= 100,
  ).length

  const progressPercent = Math.round(
    items.reduce(
      (sum: number, item: any) =>
        sum + Number(item.progress_percent || 0),
      0,
    ) / items.length,
  )

  return {
    totalItems: items.length,
    completedItems,
    progressPercent,
  }
}

export async function getSprintExecutionSummary(
  organizationId: string,
  sprintId: string,
) {
  const sprint = await verifySprintInOrg(sprintId, organizationId)

  const { data: relations, error: relationError } =
    await supabaseAdmin
      .from('sprint_work_items')
      .select(`
        id,
        work_item_id,
        work_items (
          id,
          title,
          status,
          priority,
          progress_percent,
          deadline,
          deadline_time,
          health,
          escalation_level,
          carry_forward_count,
          assigned_to,
          module_id,
          milestone_id,
          project_id,
          assignee:assigned_to (
            id,
            first_name,
            last_name,
            employee_id
          ),
          project_modules:module_id (
            id,
            name
          ),
          project_milestones:milestone_id (
            id,
            name,
            deadline
          )
        )
      `)
      .eq('sprint_id', sprintId)

  if (relationError) {
    throw new Error(relationError.message)
  }

  const items = (relations || [])
    .map((row: any) => row.work_items)
    .filter(Boolean)

  const completed = items.filter(
    (item: any) => item.status === 'DONE',
  )

  const active = items.filter(
    (item: any) => item.status !== 'DONE',
  )

  const critical = active.filter(
    (item: any) => item.health === 'CRITICAL',
  )

  const overdue = active.filter(
    (item: any) => item.health === 'RED',
  )

  const atRisk = active.filter(
    (item: any) =>
      item.health === 'AMBER' ||
      item.health === 'ORANGE',
  )

  const blocked = active.filter(
    (item: any) => item.status === 'BLOCKED',
  )

  const carryForward = active.filter(
    (item: any) =>
      Number(item.carry_forward_count || 0) > 0,
  )

  const progress =
    items.length === 0
      ? 0
      : Math.round(
          items.reduce(
            (sum: number, item: any) =>
              sum +
              Number(item.progress_percent || 0),
            0,
          ) / items.length,
        )

  return {
    sprint,
    summary: {
      total: items.length,
      completed: completed.length,
      active: active.length,
      critical: critical.length,
      overdue: overdue.length,
      atRisk: atRisk.length,
      blocked: blocked.length,
      carryForward: carryForward.length,
      progress,
    },
    work: items,
  }
}

export async function getSprintCapacity(
  organizationId: string,
  sprintId: string,
) {
  const sprint = await verifySprintInOrg(sprintId, organizationId)

  const { data: members, error: memberError } =
    await supabaseAdmin
      .from('project_members')
      .select(`
        user_id,
        profiles:user_id (
          id,
          first_name,
          last_name,
          role
        )
      `)
      .eq('project_id', sprint.project_id)

  if (memberError) {
    throw new Error(memberError.message)
  }

  const { data: capacityRows, error: capacityError } =
    await supabaseAdmin
      .from('sprint_capacity')
      .select('*')
      .eq('sprint_id', sprintId)

  if (capacityError) {
    // If sprint_capacity table doesn't exist yet, default gracefully to empty array
    console.warn('sprint_capacity query notice:', capacityError.message)
  }

  const capacityMap = new Map(
    (capacityRows || []).map((row) => [
      row.employee_id,
      row,
    ]),
  )

  const { data: relations, error: workError } =
    await supabaseAdmin
      .from('sprint_work_items')
      .select(`
        work_items (
          id,
          assigned_to,
          estimated_hours,
          status
        )
      `)
      .eq('sprint_id', sprintId)

  if (workError) {
    throw new Error(workError.message)
  }

  const items = (relations || [])
    .map((row: any) => row.work_items)
    .filter(Boolean)

  const employees = (members || [])
    .map((member: any) => {
      const employeeId = member.user_id

      const capacity =
        capacityMap.get(employeeId)

      const assigned = items.filter(
        (item: any) =>
          item.assigned_to === employeeId,
      )

      const committedHours = assigned.reduce(
        (sum: number, item: any) =>
          sum +
          Number(item.estimated_hours || 0),
        0,
      )

      const committedPoints = assigned.reduce(
        (sum: number, item: any) =>
          sum +
          Number(item.story_points || 0),
        0,
      )

      return {
        employee: member.profiles,
        availableHours: Number(
          capacity?.available_hours || 0,
        ),
        committedHours,
        committedPoints,
        utilization:
          Number(
            capacity?.available_hours || 0,
          ) === 0
            ? 0
            : Math.round(
                (committedHours /
                  Number(
                    capacity?.available_hours,
                  )) *
                  100,
              ),
      }
    })

  const totalAvailableHours =
    employees.reduce(
      (sum, item) =>
        sum + item.availableHours,
      0,
    )

  const totalCommittedHours =
    employees.reduce(
      (sum, item) =>
        sum + item.committedHours,
      0,
    )

  const totalCommittedPoints =
    employees.reduce(
      (sum, item) =>
        sum + item.committedPoints,
      0,
    )

  const completedPoints = items
    .filter((item: any) => item.status === 'DONE')
    .reduce(
      (sum: number, item: any) =>
        sum + Number(item.story_points || 0),
      0,
    )

  const completionRatio =
    totalCommittedPoints === 0
      ? 1
      : completedPoints / totalCommittedPoints

  const forecastStatus =
    completionRatio >= 0.9
      ? 'ON_TRACK'
      : completionRatio >= 0.7
        ? 'AT_RISK'
        : 'OFF_TRACK'

  return {
    sprint,
    employees,
    totals: {
      availableHours: totalAvailableHours,
      committedHours: totalCommittedHours,
      committedPoints: totalCommittedPoints,
      utilization:
        totalAvailableHours === 0
          ? 0
          : Math.round(
              (totalCommittedHours /
                totalAvailableHours) *
                100,
            ),
    },
    forecast: {
      completionRatio,
      projectedPercent: Math.round(completionRatio * 100),
      status: forecastStatus,
    },
  }
}

export async function createSprintReview(
  sprintId: string,
  organizationId: string,
  createdBy: string,
) {
  const { data: relations, error } =
    await supabaseAdmin
      .from('sprint_work_items')
      .select(`
        work_items (
          id,
          status,
          progress_percent,
          story_points,
          carry_forward_count
        )
      `)
      .eq('sprint_id', sprintId)

  if (error) {
    throw new Error(error.message)
  }

  const items = (relations || [])
    .map((row: any) => row.work_items)
    .filter(Boolean)

  const completed = items.filter(
    (item: any) => item.status === 'DONE',
  )

  const incomplete = items.filter(
    (item: any) => item.status !== 'DONE',
  )

  const completedPoints = completed.reduce(
    (sum: number, item: any) =>
      sum + Number(item.story_points || 0),
    0,
  )

  const incompletePoints = incomplete.reduce(
    (sum: number, item: any) =>
      sum + Number(item.story_points || 0),
    0,
  )

  const progress =
    items.length === 0
      ? 0
      : Math.round(
          items.reduce(
            (sum: number, item: any) =>
              sum +
              Number(item.progress_percent || 0),
            0,
          ) / items.length,
        )

  const { data, error: reviewError } =
    await supabaseAdmin
      .from('sprint_reviews')
      .upsert(
        {
          sprint_id: sprintId,
          organization_id: organizationId,
          completed_items: completed.length,
          incomplete_items: incomplete.length,
          completed_story_points:
            completedPoints,
          incomplete_story_points:
            incompletePoints,
          progress_percent: progress,
          created_by: createdBy,
        },
        {
          onConflict: 'sprint_id',
        },
      )
      .select()
      .single()

  if (reviewError) {
    console.warn('sprint_reviews upsert notice:', reviewError.message)
    return {
      sprint_id: sprintId,
      organization_id: organizationId,
      completed_items: completed.length,
      incomplete_items: incomplete.length,
      completed_story_points: completedPoints,
      incomplete_story_points: incompletePoints,
      progress_percent: progress,
      created_by: createdBy,
    }
  }

  return data
}

export async function saveSprintRetrospective(
  sprintId: string,
  organizationId: string,
  createdBy: string,
  input: {
    wentWell?: string
    problems?: string
    improvements?: string
    action_items?: string
  },
) {
  await verifySprintInOrg(sprintId, organizationId)

  const { data, error } =
    await supabaseAdmin
      .from('sprint_retrospectives')
      .upsert(
        {
          sprint_id: sprintId,
          organization_id: organizationId,
          created_by: createdBy,
          ...input,
          updated_at:
            new Date().toISOString(),
        },
        {
          onConflict: 'sprint_id',
        },
      )
      .select()
      .single()

  if (error) {
    console.warn('sprint_retrospectives upsert notice:', error.message)
    return {
      sprint_id: sprintId,
      organization_id: organizationId,
      created_by: createdBy,
      ...input,
      updated_at: new Date().toISOString(),
    }
  }

  return data
}

export async function getSprintRetrospective(
  organizationId: string,
  sprintId: string,
) {
  await verifySprintInOrg(sprintId, organizationId)

  const { data, error } = await supabaseAdmin
    .from('sprint_retrospectives')
    .select('*')
    .eq('sprint_id', sprintId)
    .maybeSingle()

  if (error) {
    console.warn('sprint_retrospectives query notice:', error.message)
    return null
  }

  return data
}
