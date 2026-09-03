import { DateTime } from 'luxon'
import { supabaseAdmin } from '../../lib/supabase.js'
import type {
  CreateProjectTargetInput,
  EmployeeAllocation,
  EmployeeWorkload,
  ProjectTargetConfig,
  ProjectTargetMetrics,
  ProjectTargetMilestone,
  ProjectTargetResponse,
  ProjectTargetSummary,
  SetProjectTargetInput,
  UpdateProjectTargetInput,
} from './project-target.types.js'

/**
 * Core calculation function for project targets.
 * Computes target, actual, remaining, and achievement percentage.
 */
export function calculateProjectTargetMetrics(
  targetValue: number,
  actualValue: number,
): ProjectTargetMetrics {
  const target = Number(targetValue || 0)
  const actual = Number(actualValue || 0)

  const remaining = Math.max(0, target - actual)

  const achievement =
    target <= 0
      ? 0
      : Math.min(
          100,
          Math.round((actual / target) * 100),
        )

  return {
    target,
    actual,
    remaining,
    achievement,
  }
}

/**
 * Calculates target health status based on achievement percentage, remaining output, and days remaining.
 */
export function calculateTargetHealth(
  achievement: number,
  daysRemaining: number,
  remaining: number,
): 'GREEN' | 'AMBER' | 'RED' {
  if (remaining === 0 || achievement >= 100) {
    return 'GREEN'
  }
  if (daysRemaining <= 0 && remaining > 0) {
    return 'RED'
  }
  if (achievement < 40 && daysRemaining <= 7) {
    return 'RED'
  }
  if (achievement < 60 && daysRemaining <= 14) {
    return 'AMBER'
  }
  return 'GREEN'
}

/**
 * Legacy JSON parser for backward compatibility
 */
function parseLegacyProjectTargetConfig(description?: string | null): {
  summary: string | null
  config: ProjectTargetConfig | null
} {
  if (!description || !description.trim().startsWith('{')) {
    return { summary: description || null, config: null }
  }

  try {
    const parsed = JSON.parse(description)
    if (parsed.target_config) {
      return {
        summary: parsed.summary || null,
        config: parsed.target_config,
      }
    }
  } catch {
    // fallback
  }

  return { summary: description || null, config: null }
}

/**
 * Helper to fetch employee display names in an organization
 */
async function getEmployeeNameMap(organizationId: string): Promise<Map<string, string>> {
  const { data: employees } = await supabaseAdmin
    .from('employees')
    .select('id, first_name, last_name, display_name')
    .eq('organization_id', organizationId)

  const map = new Map<string, string>()
  for (const emp of employees || []) {
    const name =
      emp.display_name ||
      `${emp.first_name || ''} ${emp.last_name || ''}`.trim() ||
      'Team Member'
    map.set(emp.id, name)
  }
  return map
}

/**
 * Helper to compute live metrics for a project target record
 */
async function computeTargetDetails(
  organizationId: string,
  targetRecord: any,
  empMap: Map<string, string>,
): Promise<ProjectTargetResponse> {
  const targetId = targetRecord.id
  const projectId = targetRecord.project_id

  // 1. Fetch allocations for this target
  const { data: allocRows } = await supabaseAdmin
    .from('project_target_allocations')
    .select('*')
    .eq('target_id', targetId)

  // 2. Fetch milestones for this target
  const { data: milestoneRows } = await supabaseAdmin
    .from('project_target_milestones')
    .select('*')
    .eq('target_id', targetId)
    .order('order_index', { ascending: true })

  // 3. Fetch daily work targets in this project to compute actuals from real daily output
  let query = supabaseAdmin
    .from('daily_work_targets')
    .select('id, employee_id, milestone_id, target_value, actual_value, status, deadline_date')
    .eq('project_id', projectId)

  if (targetRecord.period_start && targetRecord.period_end) {
    query = query
      .gte('deadline_date', targetRecord.period_start)
      .lte('deadline_date', targetRecord.period_end)
  }

  const { data: dailyTargets } = await query

  // 4. Calculate deadline, days remaining, required pace
  const today = DateTime.now().startOf('day')
  const deadlineStr = targetRecord.deadline_date || targetRecord.period_end
  const deadline = deadlineStr
    ? DateTime.fromISO(deadlineStr).startOf('day')
    : today.plus({ days: 30 })

  const daysRemaining = Math.max(0, Math.ceil(deadline.diff(today, 'days').days))

  // 5. Compute employee allocations metrics
  const allocations: EmployeeAllocation[] = (allocRows || []).map((alloc) => {
    const empDaily = (dailyTargets || []).filter((dt) => dt.employee_id === alloc.employee_id)
    const empActual = empDaily.reduce((sum, dt) => sum + Number(dt.actual_value || 0), 0)
    const metrics = calculateProjectTargetMetrics(Number(alloc.allocated_value || 0), empActual)
    const empPace =
      daysRemaining > 0 ? Number((metrics.remaining / daysRemaining).toFixed(2)) : metrics.remaining

    return {
      id: alloc.id,
      target_id: alloc.target_id,
      employee_id: alloc.employee_id,
      employee_name: empMap.get(alloc.employee_id) || 'Employee',
      allocated_value: metrics.target,
      actual_value: metrics.actual,
      completed_value: metrics.actual,
      pending_value: metrics.remaining,
      remaining: metrics.remaining,
      achievement: metrics.achievement,
      days_remaining: daysRemaining,
      required_pace: empPace,
    }
  })

  // 6. Compute milestones metrics
  const milestones: ProjectTargetMilestone[] = (milestoneRows || []).map((m) => {
    const mDaily = (dailyTargets || []).filter(
      (dt) => (m.milestone_id && dt.milestone_id === m.milestone_id) || dt.milestone_id === m.id,
    )
    const mActual = mDaily.reduce((sum, dt) => sum + Number(dt.actual_value || 0), 0)
    const mMetrics = calculateProjectTargetMetrics(Number(m.target_value || 0), mActual)

    let mHealth = m.health || 'GREEN'
    if (m.deadline) {
      const mDead = DateTime.fromISO(m.deadline).startOf('day')
      const mDays = Math.ceil(mDead.diff(today, 'days').days)
      if (mDays < 0 && mMetrics.remaining > 0) mHealth = 'RED'
      else if (mDays <= 3 && mMetrics.remaining > 0) mHealth = 'AMBER'
    }

    return {
      id: m.id,
      target_id: m.target_id,
      milestone_id: m.milestone_id,
      name: m.name,
      target_value: mMetrics.target,
      actual_value: mMetrics.actual,
      completed_value: mMetrics.actual,
      pending_value: mMetrics.remaining,
      remaining: mMetrics.remaining,
      achievement: mMetrics.achievement,
      deadline: m.deadline,
      health: mHealth,
      status: mMetrics.remaining === 0 && mMetrics.target > 0 ? 'COMPLETED' : m.status || 'PENDING',
      order_index: m.order_index,
    }
  })

  // 7. Compute total actual output
  // Daily Output -> Employee Actual -> Allocation Actual -> Project Target Actual -> Project Achievement
  let totalActual = 0
  if (allocations.length > 0) {
    totalActual = allocations.reduce((sum, a) => sum + (a.actual_value || 0), 0)
  } else {
    totalActual = (dailyTargets || []).reduce((sum, dt) => sum + Number(dt.actual_value || 0), 0)
  }

  const targetMetrics = calculateProjectTargetMetrics(
    Number(targetRecord.target_value || 0),
    totalActual,
  )

  const requiredPace =
    daysRemaining > 0
      ? Number((targetMetrics.remaining / daysRemaining).toFixed(2))
      : targetMetrics.remaining

  const health = calculateTargetHealth(
    targetMetrics.achievement,
    daysRemaining,
    targetMetrics.remaining,
  )

  return {
    id: targetRecord.id,
    project_id: targetRecord.project_id,
    project_name: targetRecord.projects?.name || undefined,
    name: targetRecord.name,
    description: targetRecord.description || null,
    target_type: targetRecord.target_type || 'COUNT',
    unit: targetRecord.unit || 'units',
    target_value: targetMetrics.target,
    actual_value: targetMetrics.actual,
    completed_value: targetMetrics.actual,
    pending_value: targetMetrics.remaining,
    remaining: targetMetrics.remaining,
    achievement: targetMetrics.achievement,
    status:
      targetMetrics.remaining === 0 && targetMetrics.target > 0
        ? 'COMPLETED'
        : targetRecord.status || 'ACTIVE',
    health,
    period_type: targetRecord.period_type || 'MONTHLY',
    period_start: targetRecord.period_start,
    period_end: targetRecord.period_end,
    deadline_date: targetRecord.deadline_date || targetRecord.period_end,
    deadline_time: targetRecord.deadline_time || null,
    schedule_mode: targetRecord.schedule_mode || 'MANUAL',
    work_type_id: targetRecord.work_type_id || null,
    days_remaining: daysRemaining,
    required_pace: requiredPace,
    allocations,
    milestones,
    created_at: targetRecord.created_at,
    updated_at: targetRecord.updated_at,
  }
}

/**
 * 1. Create a Project Target with allocations and milestones
 */
export async function createProjectTarget(
  organizationId: string,
  userId: string,
  input: CreateProjectTargetInput,
): Promise<ProjectTargetResponse> {
  const { data: project, error: pErr } = await supabaseAdmin
    .from('projects')
    .select('id, name')
    .eq('id', input.project_id)
    .eq('organization_id', organizationId)
    .single()

  if (pErr || !project) {
    throw new Error('Project not found.')
  }

  const periodStart = input.period_start || DateTime.now().startOf('month').toISODate()!
  const periodEnd = input.period_end || DateTime.now().endOf('month').toISODate()!
  const deadlineDate = input.deadline_date || periodEnd

  // Insert project_targets row
  const { data: targetRecord, error: tErr } = await supabaseAdmin
    .from('project_targets')
    .insert({
      organization_id: organizationId,
      project_id: input.project_id,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      target_type: input.target_type || 'COUNT',
      unit: input.unit?.trim() || 'units',
      target_value: Number(input.target_value) || 0,
      actual_value: 0,
      period_type: input.period_type || 'MONTHLY',
      period_start: periodStart,
      period_end: periodEnd,
      deadline_date: deadlineDate,
      deadline_time: input.deadline_time || null,
      schedule_mode: input.schedule_mode || 'MANUAL',
      work_type_id: input.work_type_id || null,
      status: 'ACTIVE',
      health: 'GREEN',
      created_by: userId,
    })
    .select('*, projects(name)')
    .single()

  if (tErr || !targetRecord) {
    throw new Error(tErr?.message || 'Failed to create project target.')
  }

  // Insert allocations if any
  if (input.allocations && input.allocations.length > 0) {
    const allocRows = input.allocations.map((a) => ({
      organization_id: organizationId,
      target_id: targetRecord.id,
      employee_id: a.employee_id,
      allocated_value: Number(a.allocated_value) || 0,
      actual_value: 0,
    }))

    const { error: aErr } = await supabaseAdmin
      .from('project_target_allocations')
      .insert(allocRows)

    if (aErr) {
      console.error('Failed to create target allocations:', aErr)
    }
  }

  // Insert milestones if any
  if (input.milestones && input.milestones.length > 0) {
    const milestoneRows = input.milestones.map((m, index) => ({
      organization_id: organizationId,
      target_id: targetRecord.id,
      milestone_id: m.milestone_id || null,
      name: m.name.trim(),
      target_value: Number(m.target_value) || 0,
      actual_value: 0,
      deadline: m.deadline || null,
      status: 'PENDING',
      health: 'GREEN',
      order_index: index,
    }))

    const { error: mErr } = await supabaseAdmin
      .from('project_target_milestones')
      .insert(milestoneRows)

    if (mErr) {
      console.error('Failed to create target milestones:', mErr)
    }
  }

  // Auto-generate daily targets for employees on creation
  try {
    await generateDailyTargetsFromProject(organizationId, input.project_id, userId)
  } catch (genErr) {
    console.warn('Notice: auto daily generation notice:', genErr)
  }

  const empMap = await getEmployeeNameMap(organizationId)
  return computeTargetDetails(organizationId, targetRecord, empMap)
}

/**
 * 2. Get all project targets for a project
 */
export async function getProjectTargetsByProject(
  organizationId: string,
  projectId: string,
): Promise<ProjectTargetResponse[]> {
  const { data: targets, error } = await supabaseAdmin
    .from('project_targets')
    .select('*, projects(name)')
    .eq('organization_id', organizationId)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  const empMap = await getEmployeeNameMap(organizationId)

  // If table is empty, check legacy summary and auto-populate if present
  if (!targets || targets.length === 0) {
    const summary = await getProjectTargetSummary(organizationId, projectId)
    if (summary) {
      return [
        {
          id: summary.id || 'legacy-target',
          project_id: summary.project_id,
          project_name: summary.project_name,
          name: summary.name || `${summary.period} Target`,
          description: null,
          target_type: summary.target_value ? 'COUNT' : 'COUNT',
          unit: summary.unit,
          target_value: summary.target_value,
          actual_value: summary.actual_value,
          completed_value: summary.completed_value,
          pending_value: summary.pending_value,
          remaining: summary.remaining,
          achievement: summary.achievement,
          status: summary.status || 'ACTIVE',
          health: summary.health,
          period_type: summary.period_type || 'MONTHLY',
          period_start: DateTime.now().startOf('month').toISODate()!,
          period_end: summary.deadline_date || DateTime.now().endOf('month').toISODate()!,
          deadline_date: summary.deadline_date,
          deadline_time: summary.deadline_time || null,
          days_remaining: summary.days_remaining,
          required_pace: summary.required_pace,
          allocations: summary.allocations,
          milestones: summary.milestones.map((m, idx) => ({
            id: m.id,
            target_id: 'legacy-target',
            name: m.name,
            target_value: m.target_value,
            actual_value: m.completed_value,
            completed_value: m.completed_value,
            pending_value: m.pending_value,
            remaining: m.pending_value,
            achievement:
              m.target_value > 0 ? Math.round((m.completed_value / m.target_value) * 100) : 0,
            deadline: m.deadline,
            health: m.health,
            status: m.status,
            order_index: idx,
          })),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]
    }
    return []
  }

  const responses: ProjectTargetResponse[] = []
  for (const t of targets) {
    const res = await computeTargetDetails(organizationId, t, empMap)
    responses.push(res)
  }

  return responses
}

/**
 * 3. Get a single project target by ID
 */
export async function getProjectTargetById(
  organizationId: string,
  targetId: string,
): Promise<ProjectTargetResponse | null> {
  const { data: targetRecord, error } = await supabaseAdmin
    .from('project_targets')
    .select('*, projects(name)')
    .eq('id', targetId)
    .eq('organization_id', organizationId)
    .single()

  if (error || !targetRecord) {
    return null
  }

  const empMap = await getEmployeeNameMap(organizationId)
  return computeTargetDetails(organizationId, targetRecord, empMap)
}

/**
 * 4. Update a project target
 */
export async function updateProjectTarget(
  organizationId: string,
  targetId: string,
  input: UpdateProjectTargetInput,
): Promise<ProjectTargetResponse> {
  const updatePayload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  }

  if (input.name !== undefined) updatePayload.name = input.name.trim()
  if (input.description !== undefined) updatePayload.description = input.description?.trim() || null
  if (input.target_type !== undefined) updatePayload.target_type = input.target_type
  if (input.unit !== undefined) updatePayload.unit = input.unit.trim()
  if (input.target_value !== undefined) updatePayload.target_value = Number(input.target_value) || 0
  if (input.period_type !== undefined) updatePayload.period_type = input.period_type
  if (input.period_start !== undefined) updatePayload.period_start = input.period_start
  if (input.period_end !== undefined) updatePayload.period_end = input.period_end
  if (input.deadline_date !== undefined) updatePayload.deadline_date = input.deadline_date
  if (input.deadline_time !== undefined) updatePayload.deadline_time = input.deadline_time
  if (input.schedule_mode !== undefined) updatePayload.schedule_mode = input.schedule_mode
  if (input.status !== undefined) updatePayload.status = input.status
  if (input.work_type_id !== undefined) updatePayload.work_type_id = input.work_type_id

  const { data: updatedRecord, error: uErr } = await supabaseAdmin
    .from('project_targets')
    .update(updatePayload)
    .eq('id', targetId)
    .eq('organization_id', organizationId)
    .select('*, projects(name)')
    .single()

  if (uErr || !updatedRecord) {
    throw new Error(uErr?.message || 'Failed to update project target.')
  }

  // Sync allocations if provided
  if (input.allocations !== undefined) {
    await supabaseAdmin
      .from('project_target_allocations')
      .delete()
      .eq('target_id', targetId)

    if (input.allocations.length > 0) {
      const allocRows = input.allocations.map((a) => ({
        organization_id: organizationId,
        target_id: targetId,
        employee_id: a.employee_id,
        allocated_value: Number(a.allocated_value) || 0,
        actual_value: 0,
      }))
      await supabaseAdmin.from('project_target_allocations').insert(allocRows)
    }
  }

  // Sync milestones if provided
  if (input.milestones !== undefined) {
    await supabaseAdmin
      .from('project_target_milestones')
      .delete()
      .eq('target_id', targetId)

    if (input.milestones.length > 0) {
      const milestoneRows = input.milestones.map((m, index) => ({
        organization_id: organizationId,
        target_id: targetId,
        milestone_id: m.milestone_id || null,
        name: m.name.trim(),
        target_value: Number(m.target_value) || 0,
        actual_value: 0,
        deadline: m.deadline || null,
        status: m.status || 'PENDING',
        health: m.health || 'GREEN',
        order_index: index,
      }))
      await supabaseAdmin.from('project_target_milestones').insert(milestoneRows)
    }
  }

  const empMap = await getEmployeeNameMap(organizationId)
  return computeTargetDetails(organizationId, updatedRecord, empMap)
}

/**
 * 5. Delete a project target
 */
export async function deleteProjectTarget(
  organizationId: string,
  targetId: string,
): Promise<{ success: boolean }> {
  const { error } = await supabaseAdmin
    .from('project_targets')
    .delete()
    .eq('id', targetId)
    .eq('organization_id', organizationId)

  if (error) {
    throw new Error(error.message)
  }

  return { success: true }
}

/**
 * 6. Get Project Target Summary (used by Project Overview & Details)
 */
export async function getProjectTargetSummary(
  organizationId: string,
  projectId: string,
): Promise<ProjectTargetSummary | null> {
  // Check project_targets table first
  const { data: targetRecord } = await supabaseAdmin
    .from('project_targets')
    .select('*, projects(name)')
    .eq('organization_id', organizationId)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (targetRecord) {
    const empMap = await getEmployeeNameMap(organizationId)
    const detailed = await computeTargetDetails(organizationId, targetRecord, empMap)

    return {
      id: detailed.id,
      project_id: detailed.project_id,
      project_name: detailed.project_name || '',
      name: detailed.name,
      work_type_id: detailed.work_type_id,
      target_value: detailed.target_value,
      actual_value: detailed.actual_value,
      completed_value: detailed.completed_value,
      pending_value: detailed.pending_value,
      remaining: detailed.remaining,
      achievement: detailed.achievement,
      unit: detailed.unit,
      period: detailed.period_type || 'Monthly',
      period_type: detailed.period_type,
      period_start: detailed.period_start,
      period_end: detailed.period_end,
      deadline_date: detailed.deadline_date || '',
      deadline_time: detailed.deadline_time || null,
      days_remaining: detailed.days_remaining,
      required_pace: detailed.required_pace,
      health: detailed.health,
      status: detailed.status,
      allocations: detailed.allocations,
      milestones: detailed.milestones.map((m) => ({
        id: m.id,
        name: m.name,
        target_value: m.target_value,
        completed_value: m.completed_value,
        pending_value: m.pending_value,
        deadline: m.deadline,
        health: m.health,
        status: m.status,
      })),
    }
  }

  // Fallback to legacy project description config if no project_targets table row exists yet
  const { data: project, error: pErr } = await supabaseAdmin
    .from('projects')
    .select('id, name, description, target_date, organization_id')
    .eq('id', projectId)
    .eq('organization_id', organizationId)
    .single()

  if (pErr || !project) {
    return null
  }

  const { config } = parseLegacyProjectTargetConfig(project.description)
  if (!config) {
    return null
  }

  // Fetch daily targets for actual output aggregation
  const { data: dailyTargets } = await supabaseAdmin
    .from('daily_work_targets')
    .select('id, employee_id, milestone_id, target_value, actual_value, status, deadline_date')
    .eq('project_id', projectId)

  // Fetch milestones
  const { data: milestones } = await supabaseAdmin
    .from('project_milestones')
    .select('id, name, deadline, status, description')
    .eq('project_id', projectId)

  const empMap = await getEmployeeNameMap(organizationId)

  // Project-wide totals
  const totalCompleted = (dailyTargets || []).reduce(
    (sum, dt) => sum + Number(dt.actual_value || 0),
    0,
  )
  const metrics = calculateProjectTargetMetrics(config.target_value || 0, totalCompleted)

  const today = DateTime.now().startOf('day')
  const deadline = config.deadline_date
    ? DateTime.fromISO(config.deadline_date).startOf('day')
    : project.target_date
    ? DateTime.fromISO(project.target_date).startOf('day')
    : today.plus({ days: 30 })

  const daysRemaining = Math.max(0, Math.ceil(deadline.diff(today, 'days').days))
  const requiredPace =
    daysRemaining > 0
      ? Number((metrics.remaining / daysRemaining).toFixed(2))
      : metrics.remaining

  const health = calculateTargetHealth(metrics.achievement, daysRemaining, metrics.remaining)

  // Employee allocations breakdown
  const allocations: EmployeeAllocation[] = (config.allocations || []).map((alloc) => {
    const empDaily = (dailyTargets || []).filter((dt) => dt.employee_id === alloc.employee_id)
    const empCompleted = empDaily.reduce((sum, dt) => sum + Number(dt.actual_value || 0), 0)
    const empMetrics = calculateProjectTargetMetrics(alloc.allocated_value || 0, empCompleted)
    const empPace =
      daysRemaining > 0
        ? Number((empMetrics.remaining / daysRemaining).toFixed(2))
        : empMetrics.remaining

    return {
      employee_id: alloc.employee_id,
      allocated_value: empMetrics.target,
      employee_name: empMap.get(alloc.employee_id) || 'Employee',
      completed_value: empMetrics.actual,
      pending_value: empMetrics.remaining,
      actual_value: empMetrics.actual,
      remaining: empMetrics.remaining,
      achievement: empMetrics.achievement,
      days_remaining: daysRemaining,
      required_pace: empPace,
    }
  })

  // Milestones breakdown
  const milestoneSummaries = (milestones || []).map((m) => {
    const mDaily = (dailyTargets || []).filter((dt) => dt.milestone_id === m.id)
    const mCompleted = mDaily.reduce((sum, dt) => sum + Number(dt.actual_value || 0), 0)
    const mTarget = mDaily.reduce((sum, dt) => sum + Number(dt.target_value || 0), 0)
    const mMetrics = calculateProjectTargetMetrics(mTarget, mCompleted)

    let mHealth = 'GREEN'
    if (m.deadline) {
      const mDead = DateTime.fromISO(m.deadline).startOf('day')
      const mDays = Math.ceil(mDead.diff(today, 'days').days)
      if (mDays < 0 && mMetrics.remaining > 0) mHealth = 'RED'
      else if (mDays <= 3 && mMetrics.remaining > 0) mHealth = 'AMBER'
    }

    return {
      id: m.id,
      name: m.name,
      target_value: mMetrics.target,
      completed_value: mMetrics.actual,
      pending_value: mMetrics.remaining,
      deadline: m.deadline,
      health: mHealth,
      status: m.status,
    }
  })

  return {
    project_id: project.id,
    project_name: project.name,
    name: `${config.period || 'Monthly'} Target`,
    work_type_id: config.work_type_id || null,
    target_value: metrics.target,
    actual_value: metrics.actual,
    completed_value: metrics.actual,
    pending_value: metrics.remaining,
    remaining: metrics.remaining,
    achievement: metrics.achievement,
    unit: config.unit || 'units',
    period: config.period || 'Monthly',
    deadline_date: config.deadline_date || project.target_date || '',
    days_remaining: daysRemaining,
    required_pace: requiredPace,
    health,
    allocations,
    milestones: milestoneSummaries,
  }
}

/**
 * 7. Set Project Target (backward-compatible & saves to database table)
 */
export async function setProjectTarget(
  organizationId: string,
  projectId: string,
  input: SetProjectTargetInput,
): Promise<ProjectTargetSummary> {
  const { data: project, error: pErr } = await supabaseAdmin
    .from('projects')
    .select('id, name, description')
    .eq('id', projectId)
    .eq('organization_id', organizationId)
    .single()

  if (pErr || !project) {
    throw new Error('Project not found.')
  }

  const periodStart = input.period_start || DateTime.now().startOf('month').toISODate()!
  const periodEnd =
    input.period_end || input.deadline_date || DateTime.now().endOf('month').toISODate()!
  const periodType = (input.period_type || input.period?.toUpperCase() || 'MONTHLY') as any

  // Check if target already exists in project_targets table
  const { data: existingTarget } = await supabaseAdmin
    .from('project_targets')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('project_id', projectId)
    .maybeSingle()

  let targetId: string

  if (existingTarget) {
    targetId = existingTarget.id
    await supabaseAdmin
      .from('project_targets')
      .update({
        name: input.name?.trim() || `${input.period || 'Monthly'} Target`,
        work_type_id: input.work_type_id || null,
        target_type: input.target_type || 'COUNT',
        target_value: Number(input.target_value) || 0,
        unit: input.unit?.trim() || 'units',
        period_type: periodType,
        period_start: periodStart,
        period_end: periodEnd,
        deadline_date: input.deadline_date,
        deadline_time: input.deadline_time || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetId)
  } else {
    const { data: created, error: cErr } = await supabaseAdmin
      .from('project_targets')
      .insert({
        organization_id: organizationId,
        project_id: projectId,
        name: input.name?.trim() || `${input.period || 'Monthly'} Target`,
        work_type_id: input.work_type_id || null,
        target_type: input.target_type || 'COUNT',
        target_value: Number(input.target_value) || 0,
        actual_value: 0,
        unit: input.unit?.trim() || 'units',
        period_type: periodType,
        period_start: periodStart,
        period_end: periodEnd,
        deadline_date: input.deadline_date,
        deadline_time: input.deadline_time || null,
        status: 'ACTIVE',
        health: 'GREEN',
      })
      .select('id')
      .single()

    if (cErr || !created) {
      throw new Error(cErr?.message || 'Failed to save project target.')
    }
    targetId = created.id
  }

  // Update allocations
  await supabaseAdmin
    .from('project_target_allocations')
    .delete()
    .eq('target_id', targetId)

  if (input.allocations && input.allocations.length > 0) {
    const allocRows = input.allocations.map((a) => ({
      organization_id: organizationId,
      target_id: targetId,
      employee_id: a.employee_id,
      allocated_value: Number(a.allocated_value) || 0,
      actual_value: 0,
    }))

    await supabaseAdmin.from('project_target_allocations').insert(allocRows)
  }

  // Update project target_date
  await supabaseAdmin
    .from('projects')
    .update({
      target_date: input.deadline_date || undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId)

  const summary = await getProjectTargetSummary(organizationId, projectId)
  if (!summary) {
    throw new Error('Failed to compute project target summary.')
  }

  return summary
}

/**
 * 8. Generate Daily Targets from Project Target
 */
export async function generateDailyTargetsFromProject(
  organizationId: string,
  projectId: string,
  createdBy: string,
) {
  const summary = await getProjectTargetSummary(organizationId, projectId)
  if (!summary) return []

  const todayIso = DateTime.now().toISODate()!
  const generated = []

  for (const alloc of summary.allocations) {
    if ((alloc.pending_value ?? 0) <= 0) continue

    // Check if target already exists for today for this project & employee
    const { data: existing } = await supabaseAdmin
      .from('daily_work_targets')
      .select('id')
      .eq('project_id', projectId)
      .eq('employee_id', alloc.employee_id)
      .eq('deadline_date', todayIso)
      .maybeSingle()

    if (!existing) {
      // Daily target is at least 1 or required pace rounded up
      const dailyValue = Math.max(1, Math.ceil(alloc.required_pace || 1))

      const { data: inserted, error: iErr } = await supabaseAdmin
        .from('daily_work_targets')
        .insert({
          organization_id: organizationId,
          employee_id: alloc.employee_id,
          project_id: projectId,
          title: `${summary.project_name || summary.name} Daily Target`,
          target_type: summary.target_type || 'COUNT',
          target_value: dailyValue,
          actual_value: 0,
          unit: summary.unit,
          deadline_date: todayIso,
          deadline_time: summary.deadline_time || '18:00',
          priority: 'MEDIUM',
          status: 'PENDING',
          created_by: createdBy,
        })
        .select()
        .single()

      if (!iErr && inserted) {
        generated.push(inserted)
      }
    }
  }

  return generated
}

/**
 * 9. Employee Workload (across all assigned project targets and daily execution)
 */
export async function getEmployeeWorkload(
  organizationId: string,
  employeeId: string,
): Promise<EmployeeWorkload> {
  // Fetch active project target allocations for this employee
  const { data: allocs } = await supabaseAdmin
    .from('project_target_allocations')
    .select(`
      id,
      allocated_value,
      project_targets!inner (
        id,
        name,
        unit,
        period_type,
        period_start,
        period_end,
        deadline_date,
        project_id,
        status,
        projects (id, name)
      )
    `)
    .eq('employee_id', employeeId)
    .eq('organization_id', organizationId)

  const myProjectsWorkload = []
  let totalTarget = 0
  let totalDone = 0
  let totalPending = 0

  const today = DateTime.now().startOf('day')

  if (allocs && allocs.length > 0) {
    for (const item of allocs) {
      const pt: any = item.project_targets
      if (!pt || pt.status === 'ARCHIVED' || pt.status === 'CANCELLED') continue

      const projectId = pt.project_id
      const projectName = pt.projects?.name || pt.name

      // Fetch actual daily targets in this target period
      let dtQuery = supabaseAdmin
        .from('daily_work_targets')
        .select('actual_value')
        .eq('project_id', projectId)
        .eq('employee_id', employeeId)

      if (pt.period_start && pt.period_end) {
        dtQuery = dtQuery
          .gte('deadline_date', pt.period_start)
          .lte('deadline_date', pt.period_end)
      }

      const { data: dailyTargets } = await dtQuery
      const done = (dailyTargets || []).reduce((sum, dt) => sum + Number(dt.actual_value || 0), 0)
      const target = Number(item.allocated_value || 0)
      const metrics = calculateProjectTargetMetrics(target, done)

      const deadline = pt.deadline_date
        ? DateTime.fromISO(pt.deadline_date).startOf('day')
        : today.plus({ days: 30 })

      const daysRemaining = Math.max(0, Math.ceil(deadline.diff(today, 'days').days))
      const requiredPace =
        daysRemaining > 0
          ? Number((metrics.remaining / daysRemaining).toFixed(2))
          : metrics.remaining

      totalTarget += target
      totalDone += done
      totalPending += metrics.remaining

      myProjectsWorkload.push({
        project_id: projectId,
        project_name: projectName,
        target,
        done,
        pending: metrics.remaining,
        achievement: metrics.achievement,
        unit: pt.unit || 'units',
        days_remaining: daysRemaining,
        required_pace: requiredPace,
        deadline_date: pt.deadline_date || '',
      })
    }
  } else {
    // Legacy fallback check across projects
    const { data: projects } = await supabaseAdmin
      .from('projects')
      .select('id, name, description, status, target_date')
      .eq('organization_id', organizationId)
      .neq('status', 'ARCHIVED')

    for (const p of projects || []) {
      const { config } = parseLegacyProjectTargetConfig(p.description)
      if (!config) continue

      const myAlloc = (config.allocations || []).find((a) => a.employee_id === employeeId)
      if (!myAlloc) continue

      const { data: dailyTargets } = await supabaseAdmin
        .from('daily_work_targets')
        .select('actual_value')
        .eq('project_id', p.id)
        .eq('employee_id', employeeId)

      const done = (dailyTargets || []).reduce((sum, dt) => sum + Number(dt.actual_value || 0), 0)
      const target = myAlloc.allocated_value || 0
      const metrics = calculateProjectTargetMetrics(target, done)

      const deadline = config.deadline_date
        ? DateTime.fromISO(config.deadline_date).startOf('day')
        : today.plus({ days: 30 })
      const daysRemaining = Math.max(0, Math.ceil(deadline.diff(today, 'days').days))
      const requiredPace =
        daysRemaining > 0
          ? Number((metrics.remaining / daysRemaining).toFixed(2))
          : metrics.remaining

      totalTarget += target
      totalDone += done
      totalPending += metrics.remaining

      myProjectsWorkload.push({
        project_id: p.id,
        project_name: p.name,
        target,
        done,
        pending: metrics.remaining,
        achievement: metrics.achievement,
        unit: config.unit || 'units',
        days_remaining: daysRemaining,
        required_pace: requiredPace,
        deadline_date: config.deadline_date || '',
      })
    }
  }

  // Fetch today's execution
  const todayIso = DateTime.now().toISODate()!
  const { data: todayTargets } = await supabaseAdmin
    .from('daily_work_targets')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('deadline_date', todayIso)

  const plannedOutput = (todayTargets || []).reduce(
    (sum, t) => sum + Number(t.target_value || 0),
    0,
  )
  const completedToday = (todayTargets || []).reduce(
    (sum, t) => sum + Number(t.actual_value || 0),
    0,
  )
  const remainingToday = Math.max(0, plannedOutput - completedToday)

  return {
    projects: myProjectsWorkload,
    totals: {
      target: totalTarget,
      done: totalDone,
      pending: totalPending,
      achievement: totalTarget > 0 ? Math.round((totalDone / totalTarget) * 100) : 0,
    },
    today: {
      planned_output: plannedOutput,
      completed: completedToday,
      remaining: remainingToday,
      targets_count: (todayTargets || []).length,
      completed_count: (todayTargets || []).filter((t) => t.status === 'COMPLETED').length,
    },
  }
}

/**
 * 10. Team Capacity Preview for Work Planner
 */
export async function getTeamCapacityPreview(organizationId: string) {
  const { data: employees } = await supabaseAdmin
    .from('profiles')
    .select('id, first_name, last_name, display_name, email')
    .eq('organization_id', organizationId)
    .eq('is_active', true)

  if (!employees || employees.length === 0) return []

  const todayIso = DateTime.now().toISODate()!
  const { data: todayTargets } = await supabaseAdmin
    .from('daily_work_targets')
    .select('employee_id, target_value, status')
    .eq('organization_id', organizationId)
    .eq('deadline_date', todayIso)

  return employees.map((emp) => {
    const name =
      emp.display_name ||
      `${emp.first_name || ''} ${emp.last_name || ''}`.trim() ||
      emp.email ||
      'Team Member'

    const empToday = (todayTargets || []).filter(
      (t) => t.employee_id === emp.id && t.status !== 'COMPLETED',
    )
    const currentWorkload = empToday.reduce(
      (sum, t) => sum + Number(t.target_value || 1),
      0,
    )
    const capacity = 6

    return {
      employee_id: emp.id,
      name,
      current_workload: currentWorkload,
      daily_capacity: capacity,
      status:
        currentWorkload > capacity
          ? 'OVERLOADED'
          : currentWorkload >= capacity * 0.8
          ? 'TIGHT'
          : 'CAPACITY_AVAILABLE',
    }
  })
}
