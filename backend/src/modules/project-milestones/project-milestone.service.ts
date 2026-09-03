import { DateTime } from 'luxon'
import { supabaseAdmin } from '../../lib/supabase.js'
import { notifyStakeholders } from '../notifications/notification.service.js'
import type {
  CreateProjectMilestoneInput,
  MilestoneHealth,
  ProjectMilestone,
  UpdateProjectMilestoneInput,
} from './project-milestone.types.js'

export function calculateMilestoneHealth(
  deadline: string | null,
  totalWorkItems: number,
  completedWorkItems: number,
  overdueWorkItems: number,
  criticalWorkItems: number,
  atRiskWorkItems: number,
  amberWorkItems: number = 0,
): MilestoneHealth {
  if (totalWorkItems > 0 && completedWorkItems === totalWorkItems) {
    return 'GREEN'
  }

  // CRITICAL → any critical blocking work
  if (criticalWorkItems > 0) {
    return 'CRITICAL'
  }

  // RED → overdue work exists
  if (overdueWorkItems > 0) {
    return 'RED'
  }

  // ORANGE → at-risk work exists
  if (atRiskWorkItems > 0) {
    return 'ORANGE'
  }

  // AMBER → deadline approaching (milestone deadline within 3 days or amber work item)
  if (deadline) {
    const today = DateTime.now().startOf('day')
    const milestoneDeadline = DateTime.fromISO(deadline).startOf('day')
    const daysDiff = Math.ceil(milestoneDeadline.diff(today, 'days').days)
    if (daysDiff >= 0 && daysDiff <= 3) {
      return 'AMBER'
    }
  }

  if (amberWorkItems > 0) {
    return 'AMBER'
  }

  return 'GREEN'
}

export async function getProjectMilestones(
  organizationId: string,
  projectId: string,
): Promise<ProjectMilestone[]> {
  // Enforce project belongs to current organization
  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('id, organization_id')
    .eq('id', projectId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (!project) {
    throw new Error('Project not found.')
  }

  const { data: milestones, error: milestoneError } = await supabaseAdmin
    .from('project_milestones')
    .select('*')
    .eq('project_id', projectId)
    .order('deadline', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })

  if (milestoneError) {
    throw new Error(milestoneError.message)
  }

  if (!milestones || milestones.length === 0) {
    return []
  }

  // Fetch all work items for this project that are linked to milestones
  const milestoneIds = milestones.map((m) => m.id)
  const { data: workItems, error: workError } = await supabaseAdmin
    .from('work_items')
    .select('id, milestone_id, status, health, priority, deadline, progress_percent')
    .in('milestone_id', milestoneIds)

  if (workError) {
    throw new Error(workError.message)
  }

  const items = workItems || []
  const todayStr = DateTime.now().toISODate()!

  return milestones.map((milestone) => {
    const linkedItems = items.filter((item) => item.milestone_id === milestone.id)

    const total_work_items = linkedItems.length
    const completed_work_items = linkedItems.filter(
      (item) => item.status === 'DONE' || Number(item.progress_percent || 0) >= 100,
    ).length

    const overdue_work_items = linkedItems.filter(
      (item) =>
        item.status !== 'DONE' &&
        (item.health === 'RED' || (item.deadline && item.deadline < todayStr)),
    ).length

    const critical_work_items = linkedItems.filter(
      (item) =>
        item.status !== 'DONE' &&
        (item.health === 'CRITICAL' || item.priority === 'URGENT' || item.status === 'BLOCKED'),
    ).length

    const at_risk_work_items = linkedItems.filter(
      (item) => item.status !== 'DONE' && item.health === 'ORANGE',
    ).length

    const amber_work_items = linkedItems.filter(
      (item) => item.status !== 'DONE' && item.health === 'AMBER',
    ).length

    const progress_percent =
      total_work_items === 0
        ? 0
        : Math.round((completed_work_items / total_work_items) * 100)

    const health = calculateMilestoneHealth(
      milestone.deadline,
      total_work_items,
      completed_work_items,
      overdue_work_items,
      critical_work_items,
      at_risk_work_items,
      amber_work_items,
    )

    return {
      ...milestone,
      health,
      progress_percent,
      total_work_items,
      completed_work_items,
      overdue_work_items,
      critical_work_items,
      at_risk_work_items,
    }
  })
}

export async function createProjectMilestone(
  organizationId: string,
  createdBy: string,
  input: CreateProjectMilestoneInput,
): Promise<ProjectMilestone> {
  if (!input.name?.trim()) {
    throw new Error('Milestone name is required.')
  }

  // Enforce organization ownership
  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('id, organization_id')
    .eq('id', input.project_id)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (!project) {
    throw new Error('Project not found.')
  }

  const { data, error } = await supabaseAdmin
    .from('project_milestones')
    .insert({
      project_id: input.project_id,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      deadline: input.deadline || null,
      status: input.status || 'PLANNED',
      created_by: createdBy,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error('A milestone with this name already exists in the project.')
    }
    throw new Error(error.message)
  }

  // Send creation notification if applicable
  try {
    await notifyStakeholders({
      organizationId,
      projectId: input.project_id,
      title: 'New Milestone Created',
      message: `Milestone "${data.name}" has been created for the project.`,
      type: 'MILESTONE_CREATED',
      authorUserId: createdBy,
    })
  } catch (err) {
    console.error('Failed to send milestone notification:', err)
  }

  return {
    ...data,
    health: 'GREEN',
    progress_percent: 0,
    total_work_items: 0,
    completed_work_items: 0,
    overdue_work_items: 0,
    critical_work_items: 0,
    at_risk_work_items: 0,
  }
}

export async function updateProjectMilestone(
  organizationId: string,
  milestoneId: string,
  input: UpdateProjectMilestoneInput,
): Promise<ProjectMilestone> {
  const { data: existing } = await supabaseAdmin
    .from('project_milestones')
    .select(`
      id,
      project_id,
      name,
      status,
      deadline,
      projects!inner (
        organization_id
      )
    `)
    .eq('id', milestoneId)
    .eq('projects.organization_id', organizationId)
    .maybeSingle()

  if (!existing) {
    throw new Error('Milestone not found.')
  }

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (input.name !== undefined) {
    if (!input.name.trim()) {
      throw new Error('Milestone name cannot be empty.')
    }
    payload.name = input.name.trim()
  }

  if (input.description !== undefined) {
    payload.description = input.description?.trim() || null
  }

  if (input.deadline !== undefined) {
    payload.deadline = input.deadline || null
  }

  if (input.status !== undefined) {
    payload.status = input.status
  }

  const { data, error } = await supabaseAdmin
    .from('project_milestones')
    .update(payload)
    .eq('id', milestoneId)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  // Fetch updated milestone with stats
  const [updatedMilestone] = await getProjectMilestones(
    organizationId,
    existing.project_id,
  )

  // Trigger milestone status notification if status changed to COMPLETED or health degraded
  if (input.status === 'COMPLETED') {
    try {
      await notifyStakeholders({
        organizationId,
        projectId: existing.project_id,
        title: 'Milestone Completed',
        message: `Milestone "${data.name}" has been marked as COMPLETED.`,
        type: 'MILESTONE_COMPLETED',
      })
    } catch (err) {
      console.error('Failed to notify milestone completion:', err)
    }
  }

  return updatedMilestone || data
}

export async function deleteProjectMilestone(
  organizationId: string,
  milestoneId: string,
): Promise<{ success: boolean }> {
  const { data: milestone } = await supabaseAdmin
    .from('project_milestones')
    .select(`
      id,
      project_id,
      projects!inner (
        organization_id
      )
    `)
    .eq('id', milestoneId)
    .eq('projects.organization_id', organizationId)
    .maybeSingle()

  if (!milestone) {
    throw new Error('Milestone not found.')
  }

  // Unlink work items before deleting
  await supabaseAdmin
    .from('work_items')
    .update({ milestone_id: null })
    .eq('milestone_id', milestoneId)

  const { error } = await supabaseAdmin
    .from('project_milestones')
    .delete()
    .eq('id', milestoneId)

  if (error) {
    throw new Error(error.message)
  }

  return { success: true }
}

export async function refreshMilestoneProgress(
  organizationId: string,
  milestoneId: string,
) {
  const { data: milestone } =
    await supabaseAdmin
      .from('project_milestones')
      .select(`
        id,
        project_id,
        deadline
      `)
      .eq('id', milestoneId)
      .maybeSingle()

  if (!milestone) {
    throw new Error('Milestone not found.')
  }

  const { data: items, error } =
    await supabaseAdmin
      .from('work_items')
      .select(`
        id,
        status,
        progress_percent,
        health
      `)
      .eq('organization_id', organizationId)
      .eq('milestone_id', milestoneId)

  if (error) {
    throw new Error(error.message)
  }

  const work = items || []

  const progress =
    work.length === 0
      ? 0
      : Math.round(
          work.reduce(
            (sum, item) =>
              sum +
              Number(
                item.progress_percent || 0,
              ),
            0,
          ) / work.length,
        )

  const hasCritical = work.some(
    (item) => item.health === 'CRITICAL',
  )

  const hasOverdue = work.some(
    (item) =>
      item.status !== 'DONE' &&
      item.health === 'RED',
  )

  const completed =
    work.length > 0 &&
    work.every(
      (item) => item.status === 'DONE',
    )

  const status = completed
    ? 'COMPLETED'
    : hasCritical
      ? 'AT_RISK'
      : hasOverdue
        ? 'OVERDUE'
        : progress > 0
          ? 'IN_PROGRESS'
          : 'PLANNED'

  const { data, error: updateError } =
    await supabaseAdmin
      .from('project_milestones')
      .update({
        progress_percent: progress,
        status,
        updated_at:
          new Date().toISOString(),
      })
      .eq('id', milestoneId)
      .select()
      .single()

  if (updateError) {
    throw new Error(updateError.message)
  }

  return data
}
