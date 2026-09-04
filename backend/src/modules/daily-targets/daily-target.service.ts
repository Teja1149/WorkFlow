import { DateTime } from 'luxon'
import { supabaseAdmin } from '../../lib/supabase.js'
import { getOrganizationWorkSettings } from '../organization-settings/organization-setting.service.js'
import {
  createNotification,
  notifyStakeholders,
} from '../notifications/notification.service.js'
import { logActivity } from '../work-activity/work-activity.service.js'
import type {
  CreateDailyTargetInput,
  UpdateDailyTargetResultInput,
} from './daily-target.types.js'

const VALID_RESULT_REASONS = [
  'COMPLETED',
  'NORMAL_DELAY',
  'DEPENDENCY',
  'CLIENT_WAITING',
  'RESOURCE_UNAVAILABLE',
  'TECHNICAL_ISSUE',
  'APPROVAL_PENDING',
  'UNPLANNED_WORK',
  'OTHER',
] as const

export type DailyTargetHealth =
  | 'GREEN'
  | 'AMBER'
  | 'ORANGE'
  | 'RED'
  | 'CRITICAL'

export function calculateDailyTargetHealth(
  target: {
    target_value: number | string
    actual_value: number | string
    deadline_date: string
    deadline_time?: string | null
    carry_forward_count?: number
    status?: string
  },
  timezone: string,
  workdayEnd: string,
): DailyTargetHealth {
  if (target.status === 'COMPLETED' || target.status === 'CANCELLED') {
    return 'GREEN'
  }

  const targetValue = Number(target.target_value || 0)
  const actualValue = Number(target.actual_value || 0)

  if (targetValue <= 0 || actualValue >= targetValue) {
    return 'GREEN'
  }

  const deadlineTime = target.deadline_time || workdayEnd

  const deadline = DateTime.fromISO(
    `${target.deadline_date}T${deadlineTime}`,
    {
      zone: timezone,
    },
  )

  const now = DateTime.now().setZone(timezone)

  if (!deadline.isValid) {
    return 'GREEN'
  }

  const minutesRemaining = deadline.diff(now, 'minutes').minutes

  if (Number(target.carry_forward_count || 0) >= 2) {
    return 'CRITICAL'
  }

  if (minutesRemaining <= 0) {
    return 'RED'
  }

  const achievement = (actualValue / targetValue) * 100

  const timeRatio = Math.max(
    0,
    Math.min(
      100,
      (minutesRemaining / Math.max(1, 8 * 60)) * 100,
    ),
  )

  if (achievement < 40 && timeRatio < 35) {
    return 'ORANGE'
  }

  if (achievement < 60 && timeRatio < 60) {
    return 'AMBER'
  }

  return 'GREEN'
}

function calculateTargetAchievement(
  targetValue: number,
  actualValue: number,
) {
  if (targetValue <= 0) {
    return 0
  }

  return Math.min(
    100,
    Math.round(
      (actualValue / targetValue) * 100,
    ),
  )
}

export async function createDailyTarget(
  organizationId: string,
  createdBy: string,
  input: CreateDailyTargetInput,
) {
  if (!input.employee_id) {
    throw new Error('Employee is required.')
  }

  if (!input.title?.trim()) {
    throw new Error('Target title is required.')
  }

  if (
    input.target_value === undefined ||
    input.target_value < 0
  ) {
    throw new Error(
      'Target value must be zero or greater.',
    )
  }

  // Step 178 — Prevent nonsensical combinations
  if (
    input.target_type === 'PERCENTAGE' &&
    (input.target_value < 0 || input.target_value > 100)
  ) {
    throw new Error(
      'Percentage target must be between 0 and 100.',
    )
  }

  if (!input.deadline_date) {
    throw new Error('Deadline date is required.')
  }

  const { data: employee, error: employeeError } =
    await supabaseAdmin
      .from('profiles')
      .select('id, organization_id, role')
      .eq('id', input.employee_id)
      .eq('organization_id', organizationId)
      .maybeSingle()

  if (employeeError) {
    throw new Error(employeeError.message)
  }

  if (!employee) {
    throw new Error(
      'Employee does not belong to this organization.',
    )
  }

  // Step 172 & Step 193 — Link existing Work Item verification
  if (input.work_item_id) {
    const { data: workItem, error: workItemError } =
      await supabaseAdmin
        .from('work_items')
        .select('id, organization_id, assigned_to, project_id, module_id, milestone_id')
        .eq('id', input.work_item_id)
        .eq('organization_id', organizationId)
        .maybeSingle()

    if (workItemError || !workItem) {
      throw new Error('Work item not found.')
    }

    if (input.project_id && workItem.project_id !== input.project_id) {
      throw new Error('Work item does not belong to this project.')
    }

    if (workItem.assigned_to && workItem.assigned_to !== input.employee_id) {
      throw new Error('The selected employee is not assigned to this work item.')
    }

    // Step 359 — Prevent duplicate active daily targets for same work item on same day
    const { data: existingTarget, error: existingError } = await supabaseAdmin
      .from('daily_work_targets')
      .select('id, title, status')
      .eq('organization_id', organizationId)
      .eq('employee_id', input.employee_id)
      .eq('work_item_id', input.work_item_id)
      .eq('deadline_date', input.deadline_date)
      .not('status', 'in', '("CANCELLED","COMPLETED","CARRIED_FORWARD")')
      .maybeSingle()

    if (existingError) {
      throw new Error(existingError.message)
    }

    if (existingTarget) {
      throw new Error(
        'This work already has an active daily target for this employee on this date.',
      )
    }
  }

  if (input.project_id) {
    const { data: project } =
      await supabaseAdmin
        .from('projects')
        .select('id, organization_id')
        .eq('id', input.project_id)
        .eq('organization_id', organizationId)
        .maybeSingle()

    if (!project) {
      throw new Error('Project not found.')
    }
  }

  if (input.module_id) {
    const { data: module } =
      await supabaseAdmin
        .from('project_modules')
        .select('id, project_id')
        .eq('id', input.module_id)
        .maybeSingle()

    if (!module) {
      throw new Error('Module not found.')
    }

    if (
      input.project_id &&
      module.project_id !== input.project_id
    ) {
      throw new Error(
        'Module does not belong to the selected project.',
      )
    }
  }

  if (input.milestone_id) {
    const { data: milestone } =
      await supabaseAdmin
        .from('project_milestones')
        .select('id, project_id')
        .eq('id', input.milestone_id)
        .maybeSingle()

    if (!milestone) {
      throw new Error('Milestone not found.')
    }

    if (
      input.project_id &&
      milestone.project_id !== input.project_id
    ) {
      throw new Error(
        'Milestone does not belong to the selected project.',
      )
    }
  }

  if (input.sprint_id) {
    const { data: sprint } =
      await supabaseAdmin
        .from('sprints')
        .select('id, project_id, projects(methodology)')
        .eq('id', input.sprint_id)
        .maybeSingle()

    if (!sprint) {
      throw new Error('Sprint not found.')
    }

    if (
      input.project_id &&
      sprint.project_id !== input.project_id
    ) {
      throw new Error(
        'Sprint does not belong to the selected project.',
      )
    }

    const sprintMethodology =
      (sprint as any).projects?.methodology ||
      (Array.isArray((sprint as any).projects)
        ? (sprint as any).projects[0]?.methodology
        : null)

    if (sprintMethodology === 'KANBAN') {
      throw new Error('Kanban projects do not use sprints.')
    }
  }

  const { data, error } =
    await supabaseAdmin
      .from('daily_work_targets')
      .insert({
        organization_id: organizationId,
        employee_id: input.employee_id,
        project_id: input.project_id || null,
        module_id: input.module_id || null,
        milestone_id: input.milestone_id || null,
        sprint_id: input.sprint_id || null,
        work_item_id: input.work_item_id || null,

        title: input.title.trim(),

        target_type:
          input.target_type || 'COUNT',

        target_value:
          input.target_value,

        unit: (input.unit && input.unit.trim()) || 'ITEMS',

        deadline_date:
          input.deadline_date,

        deadline_time:
          input.deadline_time || null,

        priority:
          input.priority || 'MEDIUM',

        status: 'OPEN',

        actual_value: 0,
        carry_forward_value: 0,
        carry_forward_count: 0,

        created_by: createdBy,
      })
      .select()
      .single()

  if (error) {
    if (
      error.code === '23505' ||
      error.message?.includes('duplicate key') ||
      error.message?.includes('idx_daily_targets_employee_title_date')
    ) {
      const { data: fallbackTarget } = await supabaseAdmin
        .from('daily_work_targets')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('employee_id', input.employee_id)
        .eq('deadline_date', input.deadline_date)
        .eq('title', input.title.trim())
        .maybeSingle()

      if (fallbackTarget) {
        return fallbackTarget
      }
    }
    throw new Error(error.message)
  }

  return data
}

export async function refreshDailyTargetHealth(
  organizationId: string,
) {
  const settings =
    await getOrganizationWorkSettings(
      organizationId,
    )

  const today =
    DateTime.now()
      .setZone(settings.timezone)
      .toISODate()!

  const { data: targets, error } =
    await supabaseAdmin
      .from('daily_work_targets')
      .select(`
        *,
        employee:employee_id (
          id,
          first_name,
          last_name,
          email
        ),
        projects:project_id (
          id,
          name
        )
      `)
      .eq(
        'organization_id',
        organizationId,
      )
      .eq(
        'deadline_date',
        today,
      )
      .not(
        'status',
        'in',
        '("COMPLETED","CANCELLED","CARRIED_FORWARD")',
      )

  if (error) {
    throw new Error(error.message)
  }

  let updated = 0

  for (const target of targets || []) {
    const newHealth =
      calculateDailyTargetHealth(
        target,
        settings.timezone,
        settings.workday_end,
      )

    const targetValue = Number(target.target_value || 0)
    const actualValue = Number(target.actual_value || 0)
    const remaining = Math.max(0, targetValue - actualValue)
    const unit = target.unit || 'items'
    const empName = target.employee
      ? `${target.employee.first_name || ''} ${target.employee.last_name || ''}`.trim()
      : 'Employee'

    // Step 124 & 125 — Escalation Notification handling
    if (
      newHealth !== target.health &&
      (newHealth === 'ORANGE' || newHealth === 'RED' || newHealth === 'CRITICAL')
    ) {
      const notificationKey = `${newHealth}:${target.id}`

      if (target.last_health_notification !== notificationKey) {
        try {
          if (newHealth === 'ORANGE') {
            // Notify Employee
            await createNotification({
              organizationId,
              userId: target.employee_id,
              type: 'DAILY_TARGET_AT_RISK',
              title: 'Daily Target At Risk',
              message: `Your target is at risk. ${remaining} ${unit} remain with deadline approaching.`,
              workItemId: target.work_item_id || undefined,
              projectId: target.project_id || undefined,
            })
          } else if (newHealth === 'RED') {
            // Notify Employee & Manager
            await createNotification({
              organizationId,
              userId: target.employee_id,
              type: 'DAILY_TARGET_OVERDUE',
              title: 'Daily Target Overdue',
              message: `Your target deadline has passed. ${remaining} ${unit} remain. Complete the pending work immediately.`,
              workItemId: target.work_item_id || undefined,
              projectId: target.project_id || undefined,
            })

            const { data: managementUsers } = await supabaseAdmin
              .from('profiles')
              .select('id')
              .eq('organization_id', organizationId)
              .in('role', ['SUPER_ADMIN', 'ADMIN', 'MANAGER'])

            const managementRecipients =
              (managementUsers || [])
                .map((user) => user.id)
                .filter((id) => id !== target.employee_id)

            await notifyStakeholders({
              organizationId,
              title: 'Employee Target Overdue',
              message: `${empName}'s ${target.title} target is overdue with ${remaining} ${unit} remaining.`,
              type: 'DAILY_TARGET_OVERDUE',
              workItemId: target.work_item_id || undefined,
              projectId: target.project_id || undefined,
              authorUserId: target.employee_id,
              recipients: managementRecipients,
            })
          } else if (newHealth === 'CRITICAL') {
            // Notify Employee, Manager, Admin
            await createNotification({
              organizationId,
              userId: target.employee_id,
              type: 'DAILY_TARGET_CRITICAL',
              title: 'Critical Daily Target',
              message: 'This target has been carried forward repeatedly and requires immediate attention.',
              workItemId: target.work_item_id || undefined,
              projectId: target.project_id || undefined,
            })

            const { data: managementUsers } = await supabaseAdmin
              .from('profiles')
              .select('id')
              .eq('organization_id', organizationId)
              .in('role', ['SUPER_ADMIN', 'ADMIN', 'MANAGER'])

            const managementRecipients =
              (managementUsers || [])
                .map((user) => user.id)
                .filter((id) => id !== target.employee_id)

            await notifyStakeholders({
              organizationId,
              title: 'Critical Daily Target Delay',
              message: `${empName}'s ${target.title} target has been carried forward repeatedly and requires immediate attention.`,
              type: 'DAILY_TARGET_CRITICAL',
              workItemId: target.work_item_id || undefined,
              projectId: target.project_id || undefined,
              authorUserId: target.employee_id,
              recipients: managementRecipients,
            })
          }
        } catch (notifErr) {
          console.error('Failed to send target escalation notification:', notifErr)
        }

        await supabaseAdmin
          .from('daily_work_targets')
          .update({
            health: newHealth,
            last_health_notification: notificationKey,
            last_health_notification_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', target.id)

        updated++
        continue
      }
    }

    if (newHealth !== target.health) {
      await supabaseAdmin
        .from('daily_work_targets')
        .update({
          health: newHealth,
          updated_at: new Date().toISOString(),
        })
        .eq('id', target.id)

      updated++
    }
  }

  return {
    processed: (targets || []).length,
    updated,
  }
}

export async function getEmployeeDailyTargets(
  organizationId: string,
  employeeId: string,
  date?: string,
) {
  const settings = await getOrganizationWorkSettings(organizationId).catch(() => null)
  const timezone = settings?.timezone || 'Asia/Kolkata'
  const workdayEnd = settings?.workday_end || '18:00'

  let query = supabaseAdmin
    .from('daily_work_targets')
    .select(`
      *,
      projects:project_id (
        id,
        name,
        project_key
      ),
      project_modules:module_id (
        id,
        name
      ),
      project_milestones:milestone_id (
        id,
        name,
        deadline
      ),
      sprints:sprint_id (
        id,
        name,
        status
      ),
      work_items:work_item_id (
        id,
        title,
        status,
        progress_percent,
        health
      )
    `)
    .eq('organization_id', organizationId)
    .eq('employee_id', employeeId)

  if (date) {
    query = query.eq(
      'deadline_date',
      date,
    )
  }

  const { data, error } =
    await query.order(
      'deadline_date',
      { ascending: true },
    ).order(
      'deadline_time',
      { ascending: true },
    )

  if (error) {
    throw new Error(error.message)
  }

  const targets = data || []
  return targets.map((t) => {
    const targetValue = Number(t.target_value || 0)
    const actualValue = Number(t.actual_value || 0)
    const achievement = calculateTargetAchievement(targetValue, actualValue)
    const remaining = Math.max(0, targetValue - actualValue)
    const health = t.health || calculateDailyTargetHealth(t, timezone, workdayEnd)

    return {
      ...t,
      achievement,
      remaining,
      health,
    }
  })
}

export async function getTeamDailyTargets(
  organizationId: string,
  date?: string,
) {
  const settings = await getOrganizationWorkSettings(organizationId).catch(() => null)
  const timezone = settings?.timezone || 'Asia/Kolkata'
  const workdayEnd = settings?.workday_end || '18:00'

  const targetDate =
    date ||
    new Date()
      .toISOString()
      .slice(0, 10)

  const { data, error } =
    await supabaseAdmin
      .from('daily_work_targets')
      .select(`
        *,
        employee:employee_id (
          id,
          first_name,
          last_name,
          email,
          employee_id
        ),

        projects:project_id (
          id,
          name,
          project_key
        ),

        project_modules:module_id (
          id,
          name
        ),

        project_milestones:milestone_id (
          id,
          name
        ),

        sprints:sprint_id (
          id,
          name,
          status
        ),

        work_items:work_item_id (
          id,
          title,
          status,
          progress_percent,
          health
        )
      `)
      .eq('organization_id', organizationId)
      .eq('deadline_date', targetDate)
      .order('deadline_time', {
        ascending: true,
        nullsFirst: false,
      })

  if (error) {
    throw new Error(error.message)
  }

  const targets = data || []

  const enrichedTargets =
    targets.map((target) => {
      const targetValue =
        Number(target.target_value || 0)

      const actualValue =
        Number(target.actual_value || 0)

      const achievement =
        calculateTargetAchievement(
          targetValue,
          actualValue,
        )

      const remaining =
        Math.max(
          0,
          targetValue - actualValue,
        )

      const health =
        target.health ||
        calculateDailyTargetHealth(
          target,
          timezone,
          workdayEnd,
        )

      return {
        ...target,
        achievement,
        remaining,
        health,
      }
    })

  const employeeMap =
    new Map<string, any[]>()

  for (const target of enrichedTargets) {
    if (!target.employee_id) continue

    const existing =
      employeeMap.get(
        target.employee_id,
      ) || []

    existing.push(target)

    employeeMap.set(
      target.employee_id,
      existing,
    )
  }

  const employees =
    Array.from(
      employeeMap.entries(),
    ).map(
      ([employeeId, employeeTargets]) => {
        const completed =
          employeeTargets.filter(
            (target) =>
              target.status ===
              'COMPLETED',
          ).length

        const targetAchievements = employeeTargets.map((target) => {
          const tVal = Number(target.target_value || 0)
          const aVal = Number(target.actual_value || 0)
          return tVal <= 0 ? 0 : Math.min(100, Math.round((aVal / tVal) * 100))
        })

        const achievement =
          targetAchievements.length === 0
            ? 0
            : Math.round(
                targetAchievements.reduce((sum, a) => sum + a, 0) /
                  targetAchievements.length,
              )

        const newTargetCount = employeeTargets.filter((t) => !t.carried_forward_from).length
        const carriedTargetCount = employeeTargets.filter((t) => !!t.carried_forward_from).length

        return {
          employee:
            employeeTargets[0].employee,

          targetCount:
            employeeTargets.length,
          newTargetCount,
          carriedTargetCount,

          completed,
          pending:
            employeeTargets.filter(
              (target) =>
                target.status ===
                  'OPEN' ||
                target.status ===
                  'IN_PROGRESS',
            ).length,

          partial:
            employeeTargets.filter(
              (target) =>
                target.status === 'PARTIAL',
            ).length,

          achievement,

          targets:
            employeeTargets,
        }
      },
    )

  const totalTargetsCount = enrichedTargets.length
  const completedTargetsCount = enrichedTargets.filter((t) => t.status === 'COMPLETED').length
  const partialTargetsCount = enrichedTargets.filter((t) => t.status === 'PARTIAL').length
  const missedTargetsCount = enrichedTargets.filter((t) => t.status === 'MISSED').length
  const pendingTargetsCount = enrichedTargets.filter((t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length
  const carriedForwardTargetsCount = enrichedTargets.filter((t) => t.carried_forward_from !== null || t.status === 'CARRIED_FORWARD').length

  const allTargetAchievements = enrichedTargets.map((t) => Number(t.achievement || 0))
  const overallAchievement =
    allTargetAchievements.length === 0
      ? 0
      : Math.round(
          allTargetAchievements.reduce((sum, a) => sum + a, 0) /
            allTargetAchievements.length,
        )

  return {
    date: targetDate,

    summary: {
      total: totalTargetsCount,
      completed: completedTargetsCount,
      partial: partialTargetsCount,
      missed: missedTargetsCount,
      pending: pendingTargetsCount,
      carriedForward: carriedForwardTargetsCount,
      achievement: overallAchievement,
    },

    employees,

    targets: enrichedTargets,
  }
}

export async function updateDailyTargetResult(
  organizationId: string,
  employeeId: string,
  targetId: string,
  input: UpdateDailyTargetResultInput,
) {
  if (input.actual_value < 0) {
    throw new Error(
      'Actual value must be zero or greater.',
    )
  }

  if (
    input.result_reason &&
    !VALID_RESULT_REASONS.includes(
      input.result_reason as any,
    )
  ) {
    throw new Error(
      'Invalid result reason.',
    )
  }

  if (
    input.actual_hours !== undefined &&
    input.actual_hours !== null &&
    input.actual_hours < 0
  ) {
    throw new Error(
      'Actual hours cannot be negative.',
    )
  }

  const { data: target, error: targetError } =
    await supabaseAdmin
      .from('daily_work_targets')
      .select('*')
      .eq('id', targetId)
      .eq('organization_id', organizationId)
      .maybeSingle()

  if (targetError) {
    throw new Error(targetError.message)
  }

  if (!target) {
    throw new Error('Daily target not found.')
  }

  if (target.employee_id !== employeeId) {
    throw new Error(
      'You cannot update another employee’s target.',
    )
  }

  const actual =
    Math.max(0, input.actual_value)

  const targetValue =
    Number(target.target_value || 0)

  let status:
    | 'OPEN'
    | 'IN_PROGRESS'
    | 'COMPLETED'
    | 'PARTIAL'

  if (actual >= targetValue) {
    status = 'COMPLETED'
  } else if (actual > 0) {
    status = 'PARTIAL'
  } else {
    status = 'IN_PROGRESS'
  }

  const { data, error } =
    await supabaseAdmin
      .from('daily_work_targets')
      .update({
        actual_value: actual,

        actual_hours:
          input.actual_hours ??
          null,

        result_reason:
          input.result_reason ||
          null,

        result_note:
          input.result_note?.trim() ||
          null,

        status,
        completed_at:
          status === 'COMPLETED'
            ? new Date().toISOString()
            : null,
        updated_at:
          new Date().toISOString(),
      })
      .eq('id', targetId)
      .eq('organization_id', organizationId)
      .select()
      .single()

  if (error) {
    throw new Error(error.message)
  }

  const achievement =
    targetValue === 0
      ? 0
      : Math.min(
          100,
          Math.round(
            (actual / targetValue) * 100,
          ),
        )

  const remaining = Math.max(
    0,
    targetValue - actual,
  )

  // Step 130 — Record the daily result permanently
  try {
    await supabaseAdmin
      .from('daily_target_results')
      .upsert(
        {
          organization_id: organizationId,
          target_id: target.id,
          employee_id: employeeId,
          project_id: target.project_id || null,
          module_id: target.module_id || null,
          milestone_id: target.milestone_id || null,
          sprint_id: target.sprint_id || null,
          work_item_id: target.work_item_id || null,
          target_date: target.deadline_date,
          target_type: target.target_type || 'COUNT',
          target_value: targetValue,
          actual_value: actual,
          unit: target.unit || 'ITEMS',
          achievement_percent: achievement,
          status,
          result_reason: input.result_reason || null,
          result_note: input.result_note?.trim() || null,
          actual_hours: input.actual_hours ?? null,
          deadline_date: target.deadline_date,
          deadline_time: target.deadline_time || null,
          health: (data as any)?.health || target.health || 'GREEN',
          carry_forward_value: remaining,
          carry_forward_count: Number(target.carry_forward_count || 0),
          recorded_at: new Date().toISOString(),
        },
        {
          onConflict: 'target_id,target_date',
        },
      )
  } catch (histErr) {
    console.error('Failed to upsert daily_target_results in updateDailyTargetResult:', histErr)
  }

  // Step 59 — Log activity if target is linked to a work item
  if (target.work_item_id) {
    try {
      await logActivity(
        target.work_item_id,
        employeeId,
        'DAILY_TARGET_RESULT',
        `Daily target "${target.title}" updated: ${actual}/${targetValue} ${target.unit}.`,
      )
    } catch (actErr) {
      console.error('Failed to log daily target result activity:', actErr)
    }
  }

  // Step 60 — Send Result notification to manager/stakeholders
  try {
    const { data: empProfile } = await supabaseAdmin
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', employeeId)
      .maybeSingle()

    const empName = empProfile
      ? `${empProfile.first_name || ''} ${empProfile.last_name || ''}`.trim()
      : 'Employee'

    let notifTitle = ''
    let notifMsg = ''

    if (status === 'COMPLETED') {
      notifTitle = 'DAILY TARGET COMPLETED'
      notifMsg = `${empName} completed ${actual} / ${targetValue} ${target.unit}.`
    } else if (actual > 0) {
      notifTitle = 'DAILY TARGET PARTIALLY COMPLETED'
      notifMsg = `${empName} completed ${actual} / ${targetValue} ${target.unit}. Remaining: ${remaining}. Reason: ${input.result_reason || 'None'}.`
    } else {
      notifTitle = 'DAILY TARGET NOT STARTED'
      notifMsg = `${empName} recorded 0 / ${targetValue} ${target.unit}.`
    }

    await notifyStakeholders({
      organizationId,
      title: notifTitle,
      message: notifMsg,
      type: 'DAILY_TARGET_RESULT',
      workItemId: target.work_item_id || undefined,
      projectId: target.project_id || undefined,
      authorUserId: employeeId,
      recipients: [target.employee_id],
    })
  } catch (notifErr) {
    console.error('Failed to send target result notification:', notifErr)
  }

  return {
    ...data,
    achievement,
    remaining,
  }
}

export async function processEndOfDayDailyTargets(
  organizationId: string,
) {
  const settings =
    await getOrganizationWorkSettings(
      organizationId,
    )

  const now =
    DateTime.now().setZone(
      settings.timezone,
    )

  const today =
    now.toISODate()!

  const currentDay =
    now.weekday

  const currentTime =
    now.toFormat('HH:mm')

  if (
    !settings.working_days.includes(
      currentDay,
    )
  ) {
    return {
      processed: 0,
      completed: 0,
      carriedForward: 0,
      missed: 0,
    }
  }

  if (
    currentTime <
    settings.carry_forward_time
  ) {
    return {
      processed: 0,
      completed: 0,
      carriedForward: 0,
      missed: 0,
    }
  }

  const { data: targets, error } =
    await supabaseAdmin
      .from('daily_work_targets')
      .select('*')
      .eq(
        'organization_id',
        organizationId,
      )
      .eq(
        'deadline_date',
        today,
      )
      .in('status', [
        'OPEN',
        'IN_PROGRESS',
        'PARTIAL',
      ])

  if (error) {
    throw new Error(error.message)
  }

  let completed = 0
  let carriedForward = 0
  let missed = 0

  for (const target of targets || []) {
    const targetValue =
      Number(
        target.target_value || 0,
      )

    const actualValue =
      Number(
        target.actual_value || 0,
      )

    const remaining =
      Math.max(
        0,
        targetValue - actualValue,
      )

    if (remaining <= 0) {
      await supabaseAdmin
        .from('daily_work_targets')
        .update({
          status: 'COMPLETED',
          completed_at:
            target.completed_at ||
            new Date().toISOString(),
          updated_at:
            new Date().toISOString(),
        })
        .eq('id', target.id)

      try {
        await supabaseAdmin
          .from('daily_target_results')
          .upsert(
            {
              organization_id:
                organizationId,

              target_id:
                target.id,

              employee_id:
                target.employee_id,

              project_id:
                target.project_id || null,

              module_id:
                target.module_id || null,

              milestone_id:
                target.milestone_id || null,

              sprint_id:
                target.sprint_id || null,

              work_item_id:
                target.work_item_id || null,

              target_date:
                target.deadline_date,

              target_type:
                target.target_type || 'COUNT',

              target_value:
                targetValue,

              actual_value:
                actualValue,

              unit:
                target.unit || 'ITEMS',

              achievement_percent:
                targetValue === 0
                  ? 0
                  : Math.min(
                      100,
                      Math.round(
                        (actualValue /
                          targetValue) *
                          100,
                      ),
                    ),

              status: 'COMPLETED',

              result_reason:
                target.result_reason || null,

              result_note:
                target.result_note || null,

              actual_hours:
                target.actual_hours ?? null,

              deadline_date:
                target.deadline_date,

              deadline_time:
                target.deadline_time || null,

              health:
                target.health || 'GREEN',

              carry_forward_value: 0,

              carry_forward_count:
                Number(
                  target.carry_forward_count || 0,
                ),

              recorded_at:
                new Date().toISOString(),
            },
            {
              onConflict:
                'target_id,target_date',
            },
          )
      } catch (histErr) {
        console.error('Failed to upsert completed result in daily_target_results:', histErr)
      }

      completed++
      continue
    }

    const isMissed = actualValue === 0
    if (isMissed) {
      missed++
    }

    let nextDay =
      now.plus({ days: 1 })

    while (
      !settings.working_days.includes(
        nextDay.weekday,
      )
    ) {
      nextDay =
        nextDay.plus({ days: 1 })
    }

    const nextDate =
      nextDay.toISODate()!

    const { data: existing } =
      await supabaseAdmin
        .from('daily_work_targets')
        .select('id')
        .eq(
          'carried_forward_from',
          target.id,
        )
        .maybeSingle()

    if (existing) {
      continue
    }

    // Step 69: Update original target status ('MISSED' if actual===0 else 'CARRIED_FORWARD')
    const updatedStatus = isMissed ? 'MISSED' : 'CARRIED_FORWARD'

    await supabaseAdmin
      .from('daily_work_targets')
      .update({
        status: updatedStatus,
        carry_forward_value:
          remaining,
        updated_at:
          new Date().toISOString(),
      })
      .eq('id', target.id)

    // Step 131 — Finalize the result at end of day
    try {
      await supabaseAdmin
        .from('daily_target_results')
        .upsert(
          {
            organization_id:
              organizationId,

            target_id:
              target.id,

            employee_id:
              target.employee_id,

            project_id:
              target.project_id || null,

            module_id:
              target.module_id || null,

            milestone_id:
              target.milestone_id || null,

            sprint_id:
              target.sprint_id || null,

            work_item_id:
              target.work_item_id || null,

            target_date:
              target.deadline_date,

            target_type:
              target.target_type || 'COUNT',

            target_value:
              targetValue,

            actual_value:
              actualValue,

            unit:
              target.unit || 'ITEMS',

            achievement_percent:
              targetValue === 0
                ? 0
                : Math.min(
                    100,
                    Math.round(
                      (actualValue /
                        targetValue) *
                        100,
                    ),
                  ),

            status:
              remaining <= 0
                ? 'COMPLETED'
                : actualValue > 0
                  ? 'PARTIAL'
                  : 'MISSED',

            result_reason:
              target.result_reason || null,

            result_note:
              target.result_note || null,

            actual_hours:
              target.actual_hours ?? null,

            deadline_date:
              target.deadline_date,

            deadline_time:
              target.deadline_time || null,

            health:
              target.health || 'GREEN',

            carry_forward_value:
              remaining,

            carry_forward_count:
              Number(
                target.carry_forward_count || 0,
              ),

            recorded_at:
              new Date().toISOString(),
          },
          {
            onConflict:
              'target_id,target_date',
          },
        )
    } catch (histErr) {
      console.error('Failed to upsert end-of-day result in daily_target_results:', histErr)
    }

    const nextCount =
      Number(
        target.carry_forward_count ||
          0,
      ) + 1

    const { data: nextTarget, error: insertError } =
      await supabaseAdmin
        .from('daily_work_targets')
        .insert({
          organization_id:
            organizationId,

          employee_id:
            target.employee_id,

          project_id:
            target.project_id,

          module_id:
            target.module_id,

          milestone_id:
            target.milestone_id,

          sprint_id:
            target.sprint_id,

          work_item_id:
            target.work_item_id,

          title:
            target.title,

          target_type:
            target.target_type,

          target_value:
            remaining,

          unit:
            target.unit,

          deadline_date:
            nextDate,

          deadline_time:
            target.deadline_time,

          priority:
            target.priority,

          status: 'OPEN',

          actual_value: 0,

          actual_hours: null,

          result_reason: null,

          result_note: null,

          carry_forward_value:
            remaining,

          carried_forward_from:
            target.id,

          carry_forward_count:
            nextCount,

          created_by:
            target.created_by,
        })
        .select()
        .single()

    if (insertError) {
      throw new Error(
        insertError.message,
      )
    }

    // Step 70: Notifications
    if (isMissed) {
      await createNotification({
        organizationId,
        userId: target.employee_id,
        type: 'DAILY_TARGET_CARRIED_FORWARD',
        title: 'DAILY TARGET MISSED',
        message: `Target: "${target.title}" (${targetValue} ${target.unit}). Completed: 0. Remaining: ${targetValue}. This target has been carried forward to ${nextDate}. Please prioritize this work.`,
        workItemId: target.work_item_id || undefined,
        projectId: target.project_id || undefined,
      })
    } else {
      await createNotification({
        organizationId,
        userId: target.employee_id,
        type: 'DAILY_TARGET_CARRIED_FORWARD',
        title: 'DAILY TARGET PARTIALLY COMPLETED',
        message: `"${target.title}" (${actualValue} / ${targetValue} ${target.unit} completed). ${remaining} ${target.unit} carried forward to ${nextDate}.`,
        workItemId: target.work_item_id || undefined,
        projectId: target.project_id || undefined,
      })
    }

    if (
      nextCount >=
      (settings.critical_carry_forward_count || 2)
    ) {
      await createNotification({
        organizationId,
        userId:
          target.employee_id,
        type:
          'DAILY_TARGET_ESCALATED',
        title:
          'Daily Target Repeatedly Missed',
        message:
          `"${target.title}" has been carried forward repeatedly and requires immediate attention.`,
        workItemId:
          target.work_item_id || undefined,
        projectId:
          target.project_id || undefined,
      })
    }

    carriedForward++
  }

  return {
    processed:
      (targets || []).length,
    completed,
    carriedForward,
    missed,
  }
}

export async function processDailyTargetCarryForward(
  organizationId: string,
) {
  return processEndOfDayDailyTargets(organizationId)
}

export async function updateDailyTarget(
  organizationId: string,
  targetId: string,
  input: {
    employee_id?: string
    target_value?: number
    deadline_date?: string
    deadline_time?: string | null
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
    title?: string
  },
) {
  const { data: existing, error: existingError } =
    await supabaseAdmin
      .from('daily_work_targets')
      .select(`
        id,
        organization_id,
        status,
        title,
        deadline_date,
        employee_id,
        work_item_id
      `)
      .eq('id', targetId)
      .eq('organization_id', organizationId)
      .maybeSingle()

  if (existingError) {
    throw new Error(existingError.message)
  }

  if (!existing) {
    throw new Error('Daily target not found.')
  }

  if (
    existing.status === 'COMPLETED' ||
    existing.status === 'CARRIED_FORWARD'
  ) {
    throw new Error(
      'Completed or carried-forward targets cannot be edited.',
    )
  }

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (input.employee_id !== undefined) {
    if (!input.employee_id) {
      throw new Error('Employee is required.')
    }

    const { data: employee, error: employeeError } =
      await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('id', input.employee_id)
        .eq('organization_id', organizationId)
        .maybeSingle()

    if (employeeError) {
      throw new Error(employeeError.message)
    }

    if (!employee) {
      throw new Error('Employee does not belong to this organization.')
    }

    const finalTitle =
      input.title !== undefined ? input.title.trim() : existing.title
    const finalDate =
      input.deadline_date !== undefined
        ? input.deadline_date
        : existing.deadline_date

    if (finalTitle && finalDate) {
      const { data: dupTarget } = await supabaseAdmin
        .from('daily_work_targets')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('employee_id', input.employee_id)
        .eq('title', finalTitle)
        .eq('deadline_date', finalDate)
        .neq('id', targetId)
        .maybeSingle()

      if (dupTarget) {
        throw new Error(
          'The target employee already has a daily target with this title on this date.',
        )
      }
    }

    updateData.employee_id = input.employee_id
  }

  if (input.title !== undefined) {
    if (!input.title.trim()) {
      throw new Error('Target title cannot be empty.')
    }

    updateData.title = input.title.trim()
  }

  if (input.target_value !== undefined) {
    if (input.target_value < 0) {
      throw new Error(
        'Target value cannot be negative.',
      )
    }

    updateData.target_value = input.target_value
  }

  if (input.deadline_date !== undefined) {
    updateData.deadline_date = input.deadline_date
  }

  if (input.deadline_time !== undefined) {
    updateData.deadline_time =
      input.deadline_time || null
  }

  if (input.priority !== undefined) {
    updateData.priority = input.priority
  }

  const { data, error } =
    await supabaseAdmin
      .from('daily_work_targets')
      .update(updateData)
      .eq('id', targetId)
      .eq('organization_id', organizationId)
      .select()
      .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function cancelDailyTarget(
  organizationId: string,
  targetId: string,
) {
  const { data: existing, error } =
    await supabaseAdmin
      .from('daily_work_targets')
      .select('id, status')
      .eq('id', targetId)
      .eq('organization_id', organizationId)
      .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!existing) {
    throw new Error('Daily target not found.')
  }

  if (
    existing.status === 'COMPLETED' ||
    existing.status === 'CARRIED_FORWARD'
  ) {
    throw new Error(
      'This target can no longer be cancelled.',
    )
  }

  const { data, error: updateError } =
    await supabaseAdmin
      .from('daily_work_targets')
      .update({
        status: 'CANCELLED',
        updated_at:
          new Date().toISOString(),
      })
      .eq('id', targetId)
      .eq('organization_id', organizationId)
      .select()
      .single()

  if (updateError) {
    throw new Error(updateError.message)
  }

  return data
}

export async function getEmployeeTargetPerformance(
  organizationId: string,
  employeeId: string,
  fromDate?: string,
  toDate?: string,
) {
  let query = supabaseAdmin
    .from('daily_target_results')
    .select(`
      *,
      projects:project_id (
        id,
        name,
        project_key
      ),
      project_modules:module_id (
        id,
        name
      )
    `)
    .eq('organization_id', organizationId)
    .eq('employee_id', employeeId)

  if (fromDate) {
    query = query.gte('target_date', fromDate)
  }

  if (toDate) {
    query = query.lte('target_date', toDate)
  }

  const { data, error } = await query.order('target_date', {
    ascending: false,
  })

  if (error) {
    throw new Error(error.message)
  }

  const results = data || []

  const total = results.length
  const completed = results.filter((result) => result.status === 'COMPLETED').length
  const partial = results.filter((result) => result.status === 'PARTIAL').length
  const missed = results.filter((result) => result.status === 'MISSED').length

  const totalTarget = results.reduce(
    (sum, result) => sum + Number(result.target_value || 0),
    0,
  )

  const totalActual = results.reduce(
    (sum, result) => sum + Number(result.actual_value || 0),
    0,
  )

  const targetAchievements = results.map((r) => Number(r.achievement_percent || 0))
  const achievement =
    targetAchievements.length === 0
      ? 0
      : Math.round(
          targetAchievements.reduce((sum, a) => sum + a, 0) /
            targetAchievements.length,
        )

  const carryForward = results.filter(
    (result) => Number(result.carry_forward_value || 0) > 0,
  ).length

  const onTimeCount = results.filter(
    (result) => result.status === 'COMPLETED' && Number(result.carry_forward_count || 0) === 0,
  ).length
  const onTimePercent = total === 0 ? 0 : Math.round((onTimeCount / total) * 100)

  const reasonCounts = results.reduce(
    (result: Record<string, number>, item) => {
      const reason = item.result_reason || 'UNSPECIFIED'
      result[reason] = (result[reason] || 0) + 1
      return result
    },
    {},
  )

  return {
    employeeId,
    summary: {
      total,
      completed,
      partial,
      missed,
      totalTarget,
      totalActual,
      achievement,
      carryForward,
      onTimePercent,
    },
    reasonCounts,
    results,
  }
}

export async function getTeamTargetPerformance(
  organizationId: string,
  fromDate?: string,
  toDate?: string,
) {
  let query = supabaseAdmin
    .from('daily_target_results')
    .select(`
      *,
      employee:employee_id (
        id,
        first_name,
        last_name,
        email,
        employee_id
      )
    `)
    .eq('organization_id', organizationId)

  if (fromDate) {
    query = query.gte('target_date', fromDate)
  }

  if (toDate) {
    query = query.lte('target_date', toDate)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  const map = new Map<string, any>()

  for (const result of data || []) {
    const employeeId = result.employee_id
    const current = map.get(employeeId) || {
      employee: result.employee,
      total: 0,
      completed: 0,
      partial: 0,
      missed: 0,
      carryForward: 0,
      targetValue: 0,
      actualValue: 0,
      achievements: [] as number[],
    }

    current.total++
    if (result.status === 'COMPLETED') current.completed++
    if (result.status === 'PARTIAL') current.partial++
    if (result.status === 'MISSED') current.missed++
    if (Number(result.carry_forward_value || 0) > 0) current.carryForward++

    current.targetValue += Number(result.target_value || 0)
    current.actualValue += Number(result.actual_value || 0)
    current.achievements.push(Number(result.achievement_percent || 0))

    map.set(employeeId, current)
  }

  return Array.from(map.values()).map((item) => ({
    employee: item.employee,
    total: item.total,
    completed: item.completed,
    partial: item.partial,
    missed: item.missed,
    carryForward: item.carryForward,
    targetValue: item.targetValue,
    actualValue: item.actualValue,
    achievement:
      item.achievements.length === 0
        ? 0
        : Math.round(
            item.achievements.reduce((sum: number, a: number) => sum + a, 0) /
              item.achievements.length,
          ),
  }))
}

export async function getCompanyTargetSummary(
  organizationId: string,
  fromDate?: string,
  toDate?: string,
) {
  let query = supabaseAdmin
    .from('daily_target_results')
    .select(`
      target_date,
      target_value,
      actual_value,
      achievement_percent,
      status,
      result_reason,
      carry_forward_value,
      carry_forward_count,
      health,
      employee_id,
      project_id,
      module_id,
      sprint_id,
      work_item_id,
      projects:project_id (
        id,
        name,
        project_key
      ),
      work_items:work_item_id (
        id,
        title,
        work_type_id,
        work_types (
          id,
          name
        )
      ),
      employee:employee_id (
        id,
        first_name,
        last_name,
        employee_id,
        email
      )
    `)
    .eq('organization_id', organizationId)

  if (fromDate) {
    query = query.gte('target_date', fromDate)
  }

  if (toDate) {
    query = query.lte('target_date', toDate)
  }

  const { data, error } = await query.order('target_date', {
    ascending: true,
  })

  if (error) {
    throw new Error(error.message)
  }

  const results = data || []

  const total = results.length
  const completed = results.filter((item) => item.status === 'COMPLETED').length
  const partial = results.filter((item) => item.status === 'PARTIAL').length
  const missed = results.filter((item) => item.status === 'MISSED').length

  const targetValue = results.reduce(
    (sum, item) => sum + Number(item.target_value || 0),
    0,
  )

  const actualValue = results.reduce(
    (sum, item) => sum + Number(item.actual_value || 0),
    0,
  )

  const targetAchievements = results.map((r) => Number(r.achievement_percent || 0))
  const achievement =
    targetAchievements.length === 0
      ? 0
      : Math.round(
          targetAchievements.reduce((sum, a) => sum + a, 0) /
            targetAchievements.length,
        )

  const carriedForward = results.filter(
    (item) => Number(item.carry_forward_value || 0) > 0,
  ).length

  const onTimeCount = results.filter(
    (item) => item.status === 'COMPLETED' && Number(item.carry_forward_count || 0) === 0,
  ).length
  const onTimePercent = total === 0 ? 0 : Math.round((onTimeCount / total) * 100)

  const reasonCounts = results.reduce(
    (map: Record<string, number>, item) => {
      if (item.status !== 'COMPLETED') {
        const reason = item.result_reason || 'UNSPECIFIED'
        map[reason] = (map[reason] || 0) + 1
      }
      return map
    },
    {},
  )

  // 1. Daily Trend map
  const dailyMap = new Map<
    string,
    {
      date: string
      targets: number
      completed: number
      partial: number
      missed: number
      targetValue: number
      actualValue: number
      achievements: number[]
    }
  >()

  for (const item of results) {
    const date = item.target_date
    const current = dailyMap.get(date) || {
      date,
      targets: 0,
      completed: 0,
      partial: 0,
      missed: 0,
      targetValue: 0,
      actualValue: 0,
      achievements: [] as number[],
    }

    current.targets++
    if (item.status === 'COMPLETED') current.completed++
    if (item.status === 'PARTIAL') current.partial++
    if (item.status === 'MISSED') current.missed++

    current.targetValue += Number(item.target_value || 0)
    current.actualValue += Number(item.actual_value || 0)
    current.achievements.push(Number(item.achievement_percent || 0))

    dailyMap.set(date, current)
  }

  const daily = Array.from(dailyMap.values()).map((day) => ({
    date: day.date,
    targets: day.targets,
    completed: day.completed,
    partial: day.partial,
    missed: day.missed,
    targetValue: day.targetValue,
    actualValue: day.actualValue,
    achievement:
      day.achievements.length === 0
        ? 0
        : Math.round(
            day.achievements.reduce((sum, a) => sum + a, 0) /
              day.achievements.length,
          ),
  }))

  // 2. Project Performance map (Step 150)
  const projectMap = new Map<string, any>()
  for (const item of results) {
    const pId = item.project_id || 'unassigned'
    const pName = (item.projects as any)?.name || 'General Operations'
    const current = projectMap.get(pId) || {
      id: pId,
      name: pName,
      total: 0,
      completed: 0,
      partial: 0,
      missed: 0,
      carriedForward: 0,
      onTimeCompleted: 0,
      achievements: [] as number[],
      healths: [] as string[],
    }

    current.total++
    if (item.status === 'COMPLETED') current.completed++
    if (item.status === 'PARTIAL') current.partial++
    if (item.status === 'MISSED') current.missed++
    if (Number(item.carry_forward_value || 0) > 0) current.carriedForward++
    if (item.status === 'COMPLETED' && Number(item.carry_forward_count || 0) === 0) {
      current.onTimeCompleted++
    }

    current.achievements.push(Number(item.achievement_percent || 0))
    if (item.health) current.healths.push(item.health)

    projectMap.set(pId, current)
  }

  const projects = Array.from(projectMap.values()).map((p) => {
    const pAchievement =
      p.achievements.length === 0
        ? 0
        : Math.round(
            p.achievements.reduce((sum: number, a: number) => sum + a, 0) /
              p.achievements.length,
          )
    const onTimeRate = p.total === 0 ? 0 : Math.round((p.onTimeCompleted / p.total) * 100)
    const carryForwardRate = p.total === 0 ? 0 : Math.round((p.carriedForward / p.total) * 100)

    let health = 'GREEN'
    if (p.healths.includes('CRITICAL')) health = 'CRITICAL'
    else if (p.healths.includes('RED')) health = 'RED'
    else if (p.healths.includes('ORANGE') || carryForwardRate > 15) health = 'ORANGE'
    else if (p.healths.includes('AMBER') || pAchievement < 80) health = 'AMBER'

    return {
      id: p.id,
      name: p.name,
      total: p.total,
      completed: p.completed,
      partial: p.partial,
      missed: p.missed,
      carryForward: p.carriedForward,
      carryForwardRate,
      achievement: pAchievement,
      onTimeRate,
      health,
    }
  })

  // 3. Work-Type Performance map (Step 146)
  const workTypeMap = new Map<string, any>()
  for (const item of results) {
    const wt = (item.work_items as any)?.work_types
    const wtId = wt?.id || 'standard'
    const wtName = wt?.name || 'General Targets'
    const current = workTypeMap.get(wtId) || {
      id: wtId,
      name: wtName,
      total: 0,
      completed: 0,
      partial: 0,
      missed: 0,
      achievements: [] as number[],
    }

    current.total++
    if (item.status === 'COMPLETED') current.completed++
    if (item.status === 'PARTIAL') current.partial++
    if (item.status === 'MISSED') current.missed++
    current.achievements.push(Number(item.achievement_percent || 0))

    workTypeMap.set(wtId, current)
  }

  const workTypes = Array.from(workTypeMap.values()).map((wt) => ({
    id: wt.id,
    name: wt.name,
    total: wt.total,
    completed: wt.completed,
    partial: wt.partial,
    missed: wt.missed,
    achievement:
      wt.achievements.length === 0
        ? 0
        : Math.round(
            wt.achievements.reduce((sum: number, a: number) => sum + a, 0) /
              wt.achievements.length,
          ),
  }))

  // 4. Employee Performance breakdown (Step 147 & 148)
  const employeeMap = new Map<string, any>()
  for (const item of results) {
    const empId = item.employee_id
    if (!empId) continue
    const current = employeeMap.get(empId) || {
      employee: item.employee,
      total: 0,
      completed: 0,
      partial: 0,
      missed: 0,
      carriedForward: 0,
      onTimeCompleted: 0,
      achievements: [] as number[],
    }

    current.total++
    if (item.status === 'COMPLETED') current.completed++
    if (item.status === 'PARTIAL') current.partial++
    if (item.status === 'MISSED') current.missed++
    if (Number(item.carry_forward_value || 0) > 0) current.carriedForward++
    if (item.status === 'COMPLETED' && Number(item.carry_forward_count || 0) === 0) {
      current.onTimeCompleted++
    }
    current.achievements.push(Number(item.achievement_percent || 0))

    employeeMap.set(empId, current)
  }

  const employees = Array.from(employeeMap.values()).map((emp) => ({
    employee: emp.employee,
    total: emp.total,
    completed: emp.completed,
    partial: emp.partial,
    missed: emp.missed,
    carryForward: emp.carriedForward,
    carryForwardRate: emp.total === 0 ? 0 : Math.round((emp.carriedForward / emp.total) * 100),
    missedRate: emp.total === 0 ? 0 : Math.round((emp.missed / emp.total) * 100),
    onTimeRate: emp.total === 0 ? 0 : Math.round((emp.onTimeCompleted / emp.total) * 100),
    achievement:
      emp.achievements.length === 0
        ? 0
        : Math.round(
            emp.achievements.reduce((sum: number, a: number) => sum + a, 0) /
              emp.achievements.length,
          ),
  }))

  return {
    summary: {
      total,
      completed,
      partial,
      missed,
      carriedForward,
      targetValue,
      actualValue,
      achievement,
      onTimePercent,
    },
    reasonCounts,
    daily,
    projects,
    workTypes,
    employees,
  }
}

export async function getEmployeeTargetHistory(
  organizationId: string,
  employeeId: string,
  fromDate?: string,
  toDate?: string,
) {
  let query = supabaseAdmin
    .from('daily_target_results')
    .select(`
      *,
      target:target_id (
        id,
        title,
        unit,
        target_value
      ),
      employee:employee_id (
        id,
        first_name,
        last_name,
        employee_id
      ),
      projects:project_id (
        id,
        name,
        project_key
      ),
      project_modules:module_id (
        id,
        name
      ),
      project_milestones:milestone_id (
        id,
        name
      ),
      sprints:sprint_id (
        id,
        name
      ),
      work_items:work_item_id (
        id,
        title
      )
    `)
    .eq('organization_id', organizationId)
    .eq('employee_id', employeeId)

  if (fromDate) {
    query = query.gte('target_date', fromDate)
  }

  if (toDate) {
    query = query.lte('target_date', toDate)
  }

  const { data, error } = await query
    .order('target_date', { ascending: false })
    .order('recorded_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  const results = data || []

  const dayMap = new Map<string, any>()

  for (const result of results) {
    const date = result.target_date

    const current = dayMap.get(date) || {
      date,
      targets: [],
      targetCount: 0,
      completed: 0,
      partial: 0,
      missed: 0,
      targetValue: 0,
      actualValue: 0,
      achievements: [] as number[],
    }

    const title =
      result.title ||
      result.target?.title ||
      result.work_items?.title ||
      'Daily Target'

    current.targets.push({
      ...result,
      title,
    })
    current.targetCount++

    if (result.status === 'COMPLETED') {
      current.completed++
    }
    if (result.status === 'PARTIAL') {
      current.partial++
    }
    if (result.status === 'MISSED') {
      current.missed++
    }

    current.targetValue += Number(result.target_value || 0)
    current.actualValue += Number(result.actual_value || 0)
    current.achievements.push(Number(result.achievement_percent || 0))

    dayMap.set(date, current)
  }

  return Array.from(dayMap.values()).map((day) => ({
    date: day.date,
    targets: day.targets,
    targetCount: day.targetCount,
    completed: day.completed,
    partial: day.partial,
    missed: day.missed,
    targetValue: day.targetValue,
    actualValue: day.actualValue,
    achievement:
      day.achievements.length === 0
        ? 0
        : Math.round(
            day.achievements.reduce((sum: number, a: number) => sum + a, 0) /
              day.achievements.length,
          ),
  }))
}

export async function createDailyTargetWithWorkItem(
  organizationId: string,
  createdBy: string,
  input: {
    employee_id?: string
    assigned_to?: string

    project_id?: string
    module_id?: string | null
    milestone_id?: string | null
    sprint_id?: string | null
    work_type_id?: string | null

    work_title?: string
    title?: string
    work_description?: string
    description?: string

    estimated_hours?: number | null
    story_points?: number | null

    target_type?: 'COUNT' | 'HOURS' | 'PERCENTAGE' | 'MILESTONE' | 'CUSTOM'
    target_value: number
    unit: string

    deadline_date?: string
    deadline?: string
    deadline_time?: string | null
    target_deadline_time?: string | null

    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  },
) {
  const workTitle = (input.work_title || input.title || '').trim()
  if (!workTitle) {
    throw new Error('Work title is required.')
  }

  const employeeId = input.employee_id || input.assigned_to
  if (!employeeId) {
    throw new Error('Employee is required.')
  }

  const deadlineDate =
    input.deadline_date ||
    input.deadline ||
    new Date().toISOString().slice(0, 10)

  const workDescription =
    (input.work_description || input.description || '').trim() || null

  const { data: workItem, error: workError } =
    await supabaseAdmin
      .from('work_items')
      .insert({
        organization_id: organizationId,
        project_id: input.project_id || null,
        module_id: input.module_id || null,
        milestone_id: input.milestone_id || null,
        work_type_id: input.work_type_id || null,
        assigned_to: employeeId,
        created_by: createdBy,
        title: workTitle,
        description: workDescription,
        priority: input.priority || 'MEDIUM',
        status: 'TODO',
        estimated_hours: input.estimated_hours ?? null,
        story_points: input.story_points ?? null,
        deadline: deadlineDate,
        deadline_time: input.deadline_time || null,
      })
      .select()
      .single()

  if (workError) {
    throw new Error(workError.message)
  }

  try {
    const target =
      await createDailyTarget(
        organizationId,
        createdBy,
        {
          employee_id: employeeId,
          project_id: input.project_id || null,
          module_id: input.module_id || null,

          milestone_id:
            input.milestone_id ||
            null,

          sprint_id:
            input.sprint_id ||
            null,

          work_item_id:
            workItem.id,

          title:
            workTitle,

          target_type:
            input.target_type || 'COUNT',

          target_value:
            input.target_value,

          unit:
            (input.unit && input.unit.trim()) || 'ITEMS',

          deadline_date:
            deadlineDate,

          deadline_time:
            input.deadline_time ||
            input.target_deadline_time ||
            null,

          priority:
            input.priority ||
            'MEDIUM',
        },
      )

    return {
      workItem,
      target,
    }
  } catch (error) {
    // Prevent an orphaned work item if target creation fails.
    await supabaseAdmin
      .from('work_items')
      .delete()
      .eq('id', workItem.id)

    throw error
  }
}

export async function getProjectDailyTargets(
  organizationId: string,
  projectId: string,
  date?: string,
) {
  const targetDate =
    date ||
    new Date()
      .toISOString()
      .slice(0, 10)

  const { data, error } =
    await supabaseAdmin
      .from('daily_work_targets')
      .select(`
        *,
        employee:employee_id (
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
          name
        ),
        sprints:sprint_id (
          id,
          name
        ),
        work_items:work_item_id (
          id,
          title,
          status,
          progress_percent,
          health
        )
      `)
      .eq(
        'organization_id',
        organizationId,
      )
      .eq(
        'project_id',
        projectId,
      )
      .eq(
        'deadline_date',
        targetDate,
      )
      .order(
        'deadline_time',
        {
          ascending: true,
          nullsFirst: false,
        },
      )

  if (error) {
    throw new Error(error.message)
  }

  return data || []
}

export async function getDailyResultsReport(
  organizationId: string,
  filters: {
    from?: string
    to?: string
    employeeId?: string
    projectId?: string
    status?: string
    reason?: string
  } = {},
) {
  let query = supabaseAdmin
    .from('daily_target_results')
    .select(`
      *,
      target:target_id (
        id,
        title,
        unit,
        target_value
      ),
      employee:employee_id (
        id,
        first_name,
        last_name,
        employee_id,
        email
      ),
      projects:project_id (
        id,
        name,
        project_key
      ),
      project_modules:module_id (
        id,
        name
      ),
      project_milestones:milestone_id (
        id,
        name
      ),
      sprints:sprint_id (
        id,
        name
      ),
      work_items:work_item_id (
        id,
        title,
        work_type_id,
        work_types (
          id,
          name,
          color
        )
      )
    `)
    .eq('organization_id', organizationId)

  if (filters.from) {
    query = query.gte('target_date', filters.from)
  }

  if (filters.to) {
    query = query.lte('target_date', filters.to)
  }

  if (filters.employeeId) {
    query = query.eq('employee_id', filters.employeeId)
  }

  if (filters.projectId) {
    query = query.eq('project_id', filters.projectId)
  }

  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  if (filters.reason) {
    query = query.eq('result_reason', filters.reason)
  }

  const { data, error } = await query
    .order('target_date', { ascending: false })
    .order('recorded_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (data || []).map((row) => ({
    ...row,
    title:
      row.title ||
      row.target?.title ||
      row.work_items?.title ||
      'Daily Target',
  }))
}

export async function getCompanyTodayTargets(
  organizationId: string,
  date?: string,
) {
  const targetDate =
    date ||
    new Date()
      .toISOString()
      .slice(0, 10)

  const { data, error } =
    await supabaseAdmin
      .from('daily_work_targets')
      .select(`
        *,
        employee:employee_id (
          id,
          first_name,
          last_name,
          employee_id
        ),
        projects:project_id (
          id,
          name,
          project_key
        ),
        project_modules:module_id (
          id,
          name
        ),
        work_items:work_item_id (
          id,
          title,
          status,
          health
        )
      `)
      .eq(
        'organization_id',
        organizationId,
      )
      .eq(
        'deadline_date',
        targetDate,
      )
      .neq(
        'status',
        'CANCELLED',
      )

  if (error) {
    throw new Error(error.message)
  }

  const targets = data || []

  const enriched = targets.map(
    (target) => {
      const targetValue =
        Number(
          target.target_value || 0,
        )

      const actualValue =
        Number(
          target.actual_value || 0,
        )

      const remaining =
        Math.max(
          0,
          targetValue - actualValue,
        )

      const achievement =
        targetValue === 0
          ? 0
          : Math.min(
              100,
              Math.round(
                (actualValue /
                  targetValue) *
                  100,
              ),
            )

      return {
        ...target,
        achievement,
        remaining,
      }
    },
  )

  const active =
    enriched.filter(
      (target) =>
        target.status !==
          'COMPLETED',
    )

  return {
    date: targetDate,

    summary: {
      total:
        enriched.length,

      completed:
        enriched.filter(
          (target) =>
            target.status ===
            'COMPLETED',
        ).length,

      partial:
        enriched.filter(
          (target) =>
            target.status ===
            'PARTIAL',
        ).length,

      pending:
        enriched.filter(
          (target) =>
            target.status ===
              'OPEN' ||
            target.status ===
              'IN_PROGRESS',
        ).length,

      overdue:
        active.filter(
          (target) =>
            target.health ===
            'RED',
        ).length,

      critical:
        active.filter(
          (target) =>
            target.health ===
            'CRITICAL',
        ).length,

      atRisk:
        active.filter(
          (target) =>
            target.health ===
              'AMBER' ||
            target.health ===
              'ORANGE',
        ).length,
    },

    targets: enriched,
  }
}

