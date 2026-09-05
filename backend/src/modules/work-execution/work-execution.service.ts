import { DateTime } from 'luxon'
import { supabaseAdmin } from '../../lib/supabase.js'
import {
  createNotification,
  notifyStakeholders,
} from '../notifications/notification.service.js'
import { getOrganizationWorkSettings } from '../organization-settings/organization-setting.service.js'
import { getProjectMilestones } from '../project-milestones/project-milestone.service.js'
import { logActivity } from '../work-activity/work-activity.service.js'
import {
  dateInTimezone,
  dayOfWeekInTimezone,
  timeInTimezone,
  formatDateInTimezone,
} from '../../utils/timezone.js'
import {
  processEndOfDayDailyTargets,
  refreshDailyTargetHealth,
} from '../daily-targets/daily-target.service.js'

import {
  calculateWorkHealth,
  healthRank,
  type WorkHealth,
  type WorkHealthResult,
} from './work-health.js'

export {
  calculateWorkHealth,
  healthRank,
  type WorkHealth,
  type WorkHealthResult,
}

async function getEscalationRecipients(
  organizationId: string,
  assignedTo: string,
  level: 'RED' | 'CRITICAL',
) {
  const recipients = new Set<string>()

  // Always notify the assigned employee.
  recipients.add(assignedTo)

  // Find the employee's direct manager.
  const { data: employee, error: employeeError } =
    await supabaseAdmin
      .from('profiles')
      .select('manager_id')
      .eq('id', assignedTo)
      .eq('organization_id', organizationId)
      .maybeSingle()

  if (employeeError) {
    throw new Error(employeeError.message)
  }

  if (employee?.manager_id) {
    recipients.add(employee.manager_id)
  }

  // CRITICAL goes to Admin/Super Admin as well.
  if (level === 'CRITICAL') {
    const { data: admins, error: adminError } =
      await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('organization_id', organizationId)
        .in('role', ['ADMIN', 'SUPER_ADMIN'])

    if (adminError) {
      throw new Error(adminError.message)
    }

    for (const admin of admins || []) {
      recipients.add(admin.id)
    }
  }

  return [...recipients]
}

async function sendWorkEscalationNotification(
  organizationId: string,
  item: {
    id: string
    title: string
    project_id: string
    assigned_to: string | null
    created_by: string
    health: WorkHealth
    escalation_level: number
  },
  warningMinutes = 120,
  atRiskMinutes = 60,
) {
  if (!item.assigned_to) return

  let title = ''
  let message = ''
  let type = ''
  let escalationLevel: 'RED' | 'CRITICAL' | null = null

  switch (item.health) {
    case 'AMBER':
      title = 'Deadline Approaching'
      message = `"${item.title}" deadline is approaching. ${warningMinutes} minutes remaining.`
      type = 'WORK_DEADLINE_APPROACHING'
      break

    case 'ORANGE':
      title = 'Work At Risk'
      message = `"${item.title}" is at risk. Less than ${atRiskMinutes} minutes remain.`
      type = 'WORK_AT_RISK'
      break

    case 'RED':
      title = 'Deadline Crossed'
      message = `"${item.title}" has crossed its deadline and is still incomplete.`
      type = 'WORK_DEADLINE_CROSSED'
      escalationLevel = 'RED'
      break

    case 'CRITICAL':
      title = 'Critical Work Delay'
      message = `"${item.title}" has been repeatedly delayed and requires immediate attention.`
      type = 'WORK_CRITICAL'
      escalationLevel = 'CRITICAL'
      break

    default:
      return
  }

  try {
    if (escalationLevel) {
      const recipients = await getEscalationRecipients(
        organizationId,
        item.assigned_to,
        escalationLevel,
      )

      for (const recipientId of recipients) {
        if (recipientId === item.created_by) {
          continue
        }

        await createNotification({
          userId: recipientId,
          organizationId,
          type,
          title,
          message,
          workItemId: item.id,
          projectId: item.project_id,
        })
      }
    } else {
      await createNotification({
        userId: item.assigned_to,
        organizationId,
        type,
        title,
        message,
        workItemId: item.id,
        projectId: item.project_id,
      })
    }
  } catch (error) {
    console.error(
      `Work escalation notification failed for ${item.id}:`,
      error,
    )
  }
}

export async function refreshWorkHealth(
  organizationId: string,
) {
  const settings =
    await getOrganizationWorkSettings(
      organizationId,
    )

  const { data: items, error } = await supabaseAdmin
    .from('work_items')
    .select(`
      id,
      title,
      project_id,
      assigned_to,
      created_by,
      deadline,
      deadline_time,
      progress_percent,
      status,
      health,
      escalation_level,
      carry_forward_count
    `)
    .eq('organization_id', organizationId)
    .neq('status', 'DONE')

  const { data: openConcerns } = await supabaseAdmin
    .from('work_concerns')
    .select('work_item_id, priority')
    .eq('status', 'OPEN')

  const concernPriorityMap = new Map<string, string>()
  for (const c of openConcerns || []) {
    const prev = concernPriorityMap.get(c.work_item_id)
    if (c.priority === 'CRITICAL' || prev !== 'CRITICAL') {
      if (c.priority === 'CRITICAL') concernPriorityMap.set(c.work_item_id, 'CRITICAL')
      else if (c.priority === 'HIGH' && prev !== 'CRITICAL') concernPriorityMap.set(c.work_item_id, 'HIGH')
      else if (!prev) concernPriorityMap.set(c.work_item_id, c.priority || 'MEDIUM')
    }
  }

  let updatedCount = 0

  for (const item of items || []) {
    let result = calculateWorkHealth(
      item.deadline,
      item.deadline_time,
      Number(item.progress_percent || 0),
      item.status,
      settings.warning_minutes,
      settings.at_risk_minutes,
      settings.timezone,
      settings.workday_end,
    )

    const concernPriority = concernPriorityMap.get(item.id)
    if (concernPriority === 'CRITICAL') {
      result = {
        health: 'RED',
        escalationLevel: Math.max(result.escalationLevel, 3),
        minutesRemaining: result.minutesRemaining,
      }
    } else if (concernPriority === 'HIGH') {
      if (result.health === 'GREEN' || result.health === 'AMBER') {
        result = {
          health: 'ORANGE',
          escalationLevel: Math.max(result.escalationLevel, 2),
          minutesRemaining: result.minutesRemaining,
        }
      }
    }

    const healthChanged =
      result.health !== item.health

    const shouldNotify =
      healthChanged &&
      result.health !== 'GREEN'

    if (healthChanged) {
      const { error: updateError } = await supabaseAdmin
        .from('work_items')
        .update({
          health: result.health,
          escalation_level: result.escalationLevel,
          last_health_notification: shouldNotify ? result.health : item.health,
          last_health_notification_at: shouldNotify
            ? new Date().toISOString()
            : undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id)

      if (updateError) {
        console.error(
          `Failed to update work health for ${item.id}:`,
          updateError.message,
        )
        continue
      }

      updatedCount++

      if (result.health === 'CRITICAL' && item.health !== 'CRITICAL') {
        try {
          await logActivity(
            item.id,
            item.created_by || item.assigned_to || organizationId,
            'WORK_ESCALATED',
            'Work escalated to CRITICAL.',
          )
        } catch (actErr) {
          console.error('Failed to log WORK_ESCALATED activity:', actErr)
        }
      }

      if (shouldNotify) {
        await sendWorkEscalationNotification(
          organizationId,
          {
            id: item.id,
            title: item.title,
            project_id: item.project_id,
            assigned_to: item.assigned_to,
            created_by: item.created_by,
            health: result.health,
            escalation_level: result.escalationLevel,
          },
          settings.warning_minutes,
          settings.at_risk_minutes,
        )
      }
    }

    try {
      await supabaseAdmin
        .from('work_execution_history')
        .insert({
          organization_id: organizationId,
          work_item_id: item.id,
          user_id: item.assigned_to,
          status: item.status,
          health: result.health,
          progress_percent: Number(
            item.progress_percent || 0,
          ),
          deadline: item.deadline,
          deadline_time: item.deadline_time,
          carry_forward_count: Number(
            item.carry_forward_count || 0,
          ),
          escalation_level:
            result.escalationLevel,
        })
    } catch (histErr) {
      console.error(`Failed to record work_execution_history for ${item.id}:`, histErr)
    }
  }

  return {
    processed: items?.length || 0,
    updated: updatedCount,
  }
}

export async function getTodayWork(
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
        color,
        icon
      ),
      project_modules:module_id (
        id,
        name,
        description
      ),
      assignee:assigned_to (
        id,
        first_name,
        last_name,
        email,
        employee_id
      )
    `)
    .eq('organization_id', organizationId)

  query = query.eq('assigned_to', userId)

  const { data, error } = await query
    .order('deadline', {
      ascending: true,
      nullsFirst: false,
    })
    .order('created_at', {
      ascending: true,
    })

  if (error) {
    throw new Error(error.message)
  }

  const items = data || []

  const carryForward: any[] = []
  const overdue: any[] = []
  const atRisk: any[] = []
  const inProgress: any[] = []
  const newWork: any[] = []
  const critical: any[] = []

  for (const item of items) {
    if (item.status === 'DONE') {
      continue
    }

    if (Number(item.escalation_level || 0) >= 5) {
      critical.push(item)
      continue
    }

    if (
      Number(item.carry_forward_count || 0) > 0 &&
      item.carried_forward_from
    ) {
      carryForward.push(item)
    }

    if (item.health === 'RED') {
      overdue.push(item)
    } else if (
      item.health === 'ORANGE' ||
      item.health === 'AMBER'
    ) {
      atRisk.push(item)
    } else if (
      item.status === 'IN_PROGRESS' ||
      item.status === 'DEVELOPMENT'
    ) {
      inProgress.push(item)
    } else {
      newWork.push(item)
    }
  }

  return {
    carryForward,
    newWork,
    inProgress,
    atRisk,
    overdue,
    critical,
  }
}

function getNextWorkingDay(
  date: DateTime,
  workingDays: number[],
) {
  let next = date.plus({ days: 1 })

  while (!workingDays.includes(next.weekday)) {
    next = next.plus({ days: 1 })
  }

  return next
}

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10)
}

export async function processCarryForward(
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

  const todayString =
    now.toISODate()!

  const nextWorkingDay =
    getNextWorkingDay(
      now,
      settings.working_days,
    )

  const nextDeadline =
    nextWorkingDay.toISODate()!

  const { data: items, error } = await supabaseAdmin
    .from('work_items')
    .select(`
      id,
      organization_id,
      assigned_to,
      created_by,
      project_id,
      title,
      status,
      deadline,
      original_deadline,
      carried_forward_from,
      carry_forward_count,
      health,
      escalation_level,
      last_carried_forward_at
    `)
    .eq('organization_id', organizationId)
    .lt('deadline', todayString)
    .neq('status', 'DONE')

  if (error) {
    throw new Error(error.message)
  }

  let processed = 0
  let carriedForward = 0

  for (const item of items || []) {
    // Avoid processing the same work item multiple times
    // during the same day.
    if (
      item.last_carried_forward_at &&
      item.last_carried_forward_at.startsWith(todayString)
    ) {
      continue
    }

    const originalDeadline =
      item.original_deadline ||
      item.deadline

    const currentCount =
      Number(item.carry_forward_count || 0)

    const newCount = currentCount + 1

    let health:
      | 'RED'
      | 'CRITICAL' = 'RED'

    let escalationLevel = Math.min(
      5,
      Math.max(3, newCount + 2),
    )

    if (
      newCount >=
      settings.critical_carry_forward_count
    ) {
      health = 'CRITICAL'

      escalationLevel = Math.min(
        5,
        4 + newCount -
          settings.critical_carry_forward_count,
      )
    }

    const { error: updateError } =
      await supabaseAdmin
        .from('work_items')
        .update({
          original_deadline: originalDeadline,
          carried_forward_from:
            item.deadline,
          deadline: nextDeadline,
          carry_forward_count: newCount,
          health,
          escalation_level: escalationLevel,
          last_carried_forward_at:
            new Date().toISOString(),
          updated_at:
            new Date().toISOString(),
        })
        .eq('id', item.id)

    if (updateError) {
      console.error(
        `Failed to carry forward work item ${item.id}:`,
        updateError.message,
      )
      continue
    }

    processed += 1
    carriedForward += 1

    try {
      await logActivity(
        item.id,
        item.created_by || item.assigned_to || organizationId,
        'WORK_CARRIED_FORWARD',
        `Work carried forward from ${item.deadline} to ${nextDeadline}.`,
      )
    } catch (actErr) {
      console.error('Failed to log WORK_CARRIED_FORWARD activity:', actErr)
    }

    try {
      const isEmergency = health === 'CRITICAL'
      const type = isEmergency
        ? 'WORK_EMERGENCY'
        : 'WORK_CARRIED_FORWARD'

      const title = isEmergency
        ? 'Emergency Work Item'
        : 'Work Item Carried Forward'

      const message = isEmergency
        ? `"${item.title}" has been carried forward repeatedly and is now an emergency work item.`
        : `"${item.title}" was not completed by its deadline and has been carried forward to the next working day (${nextDeadline}).`

      await notifyStakeholders({
        organizationId,
        title,
        message,
        type,
        workItemId: item.id,
        projectId: item.project_id,
        authorUserId: item.created_by,
        recipients: [item.assigned_to],
      })
    } catch (notificationError) {
      console.error(
        'Failed to send carry-forward notification:',
        notificationError,
      )
    }
  }

  return {
    processed,
    carriedForward,
    nextWorkingDay: nextDeadline,
  }
}

export async function getCompanyExecutionSummary(
  organizationId: string,
) {
  const { data: items, error } = await supabaseAdmin
    .from('work_items')
    .select(`
      id,
      title,
      status,
      priority,
      deadline,
      progress_percent,
      health,
      escalation_level,
      carry_forward_count,
      assigned_to,
      project_id,
      module_id,
      work_type_id,
      projects:project_id (
        id,
        name,
        project_key
      ),
      project_modules:module_id (
        id,
        name
      ),
      work_types:work_type_id (
        id,
        name,
        color
      ),
      assignee:assigned_to (
        id,
        first_name,
        last_name,
        employee_id
      )
    `)
    .eq('organization_id', organizationId)

  if (error) {
    throw new Error(error.message)
  }

  const all = items || []

  const summary = {
    totalWork: all.length,
    completed: all.filter(
      (x) => x.status === 'DONE',
    ).length,
    inProgress: all.filter(
      (x) =>
        x.status === 'IN_PROGRESS' ||
        x.status === 'DEVELOPMENT',
    ).length,
    pending: all.filter(
      (x) =>
        x.status !== 'DONE' &&
        x.status !== 'IN_PROGRESS' &&
        x.status !== 'DEVELOPMENT',
    ).length,
    overdue: all.filter(
      (x) =>
        x.status !== 'DONE' &&
        x.health === 'RED',
    ).length,
    critical: all.filter(
      (x) =>
        x.status !== 'DONE' &&
        x.health === 'CRITICAL',
    ).length,
    blocked: all.filter(
      (x) => x.status === 'BLOCKED',
    ).length,
    carriedForward: all.filter(
      (x) =>
        Number(x.carry_forward_count || 0) > 0,
    ).length,
  }

  const completionRate =
    all.length === 0
      ? 0
      : Math.round(
          (summary.completed / all.length) * 100,
        )

  return {
    summary: {
      ...summary,
      completionRate,
    },
    work: all,
  }
}

export async function getEmployeePerformance(
  organizationId: string,
) {
  const { data: employees, error: employeeError } =
    await supabaseAdmin
      .from('profiles')
      .select(`
        id,
        first_name,
        last_name,
        email,
        employee_id,
        role
      `)
      .eq('organization_id', organizationId)

  if (employeeError) {
    throw new Error(employeeError.message)
  }

  const { data: workItems, error: workError } =
    await supabaseAdmin
      .from('work_items')
      .select(`
        id,
        assigned_to,
        created_by,
        status,
        priority,
        completed_at,
        deadline,
        deadline_time,
        original_deadline,
        progress_percent,
        health,
        escalation_level,
        carry_forward_count,
        project_id,
        module_id,
        work_type_id,
        projects:project_id (
          id,
          name,
          project_key
        ),
        project_modules:module_id (
          id,
          name
        ),
        work_types:work_type_id (
          id,
          name
        )
      `)
      .eq('organization_id', organizationId)

  if (workError) {
    throw new Error(workError.message)
  }

  const items = workItems || []

  const settings =
    await getOrganizationWorkSettings(
      organizationId,
    )

  return (employees || []).map((employee) => {
    const assigned = items.filter(
      (item) =>
        item.assigned_to === employee.id,
    )

    const completed = assigned.filter(
      (item) => item.status === 'DONE',
    )

    const completedOnTime = completed.filter((item) => {
      if (
        !item.completed_at ||
        !item.original_deadline
      ) {
        return false
      }

      const deadlineTime =
        item.deadline_time ||
        settings.workday_end

      const deadlineDate = DateTime.fromISO(
        `${item.original_deadline}T${deadlineTime}`,
        {
          zone: settings.timezone,
        },
      )

      const completedDate =
        DateTime.fromISO(item.completed_at, {
          zone: settings.timezone,
        })

      return (
        completedDate.toMillis() <=
        deadlineDate.toMillis()
      )
    })

    const completedLate = completed.filter((item) => {
      if (
        !item.completed_at ||
        !item.original_deadline
      ) {
        return false
      }

      const deadlineTime =
        item.deadline_time ||
        settings.workday_end

      const deadlineDate = DateTime.fromISO(
        `${item.original_deadline}T${deadlineTime}`,
        {
          zone: settings.timezone,
        },
      )

      const completedDate =
        DateTime.fromISO(item.completed_at, {
          zone: settings.timezone,
        })

      return (
        completedDate.toMillis() >
        deadlineDate.toMillis()
      )
    })

    const onTimeCompletionRate =
      completed.length === 0
        ? 0
        : Math.round(
            (completedOnTime.length / completed.length) * 100,
          )

    const delayValues = completedLate
      .map((item) => {
        if (
          !item.completed_at ||
          !item.original_deadline
        ) {
          return 0
        }

        const deadlineTime =
          item.deadline_time ||
          settings.workday_end

        const deadlineDate = DateTime.fromISO(
          `${item.original_deadline}T${deadlineTime}`,
          {
            zone: settings.timezone,
          },
        )

        const completedDate =
          DateTime.fromISO(item.completed_at, {
            zone: settings.timezone,
          })

        return Math.max(
          0,
          completedDate.diff(
            deadlineDate,
            'hours',
          ).hours / 24,
        )
      })
      .filter((value) => value > 0)

    const averageDelayDays =
      delayValues.length === 0
        ? 0
        : Number(
            (
              delayValues.reduce(
                (sum, value) => sum + value,
                0,
              ) / delayValues.length
            ).toFixed(1),
          )

    const overdue = assigned.filter(
      (item) =>
        item.status !== 'DONE' &&
        (item.health === 'RED' ||
          item.health === 'CRITICAL'),
    )

    const critical = assigned.filter(
      (item) => item.health === 'CRITICAL',
    )

    const carriedForward = assigned.filter(
      (item) =>
        Number(item.carry_forward_count || 0) > 0,
    )

    const blocked = assigned.filter(
      (item) => item.status === 'BLOCKED',
    )

    const total = assigned.length

    const completionRate =
      total === 0
        ? 0
        : Math.round(
            (completed.length / total) * 100,
          )

    const active = assigned.filter(
      (item) => item.status !== 'DONE',
    )

    const projectIds = [
      ...new Set(
        assigned
          .map((item) => item.project_id)
          .filter(Boolean),
      ),
    ]

    const moduleIds = [
      ...new Set(
        assigned
          .map((item) => item.module_id)
          .filter(Boolean),
      ),
    ]

    return {
      employee: {
        id: employee.id,
        first_name: employee.first_name,
        last_name: employee.last_name,
        email: employee.email,
        employee_id: employee.employee_id,
        role: employee.role,
      },

      totalAssigned: total,
      completed: completed.length,
      completedOnTime: completedOnTime.length,
      completedLate: completedLate.length,
      onTimeCompletionRate,
      averageDelayDays,
      active: active.length,
      overdue: overdue.length,
      critical: critical.length,
      blocked: blocked.length,
      carriedForward: carriedForward.length,
      completionRate,

      projectCount: projectIds.length,
      moduleCount: moduleIds.length,

      work: assigned,
    }
  })
}

export async function runExecutionCycle(
  organizationId: string,
) {
  const settings =
    await getOrganizationWorkSettings(
      organizationId,
    )

  const currentDay =
    dayOfWeekInTimezone(settings.timezone)

  const currentTime =
    timeInTimezone(settings.timezone)

  const isWorkingDay =
    settings.working_days.includes(currentDay)

  const carryForwardReached =
    currentTime >= settings.carry_forward_time

  const healthResult =
    await refreshWorkHealth(organizationId)

  let carryForwardResult = {
    processed: 0,
    carriedForward: 0,
    nextWorkingDay: null as string | null,
  }

  if (
    isWorkingDay &&
    carryForwardReached
  ) {
    carryForwardResult =
      await processCarryForward(
        organizationId,
      )
  }

  const dailyTargetHealth =
    await refreshDailyTargetHealth(
      organizationId,
    )

  const dailyTargetResult =
    await processEndOfDayDailyTargets(
      organizationId,
    )

  return {
    health: healthResult,
    carryForward: carryForwardResult,
    dailyTargetHealth,
    dailyTargets: dailyTargetResult,
    timezone: settings.timezone,
    currentDate: dateInTimezone(
      settings.timezone,
    ),
    currentTime,
    processedAt:
      new Date().toISOString(),
  }
}

export async function runOrganizationExecutionCycle() {
  const { data: organizations, error } =
    await supabaseAdmin
      .from('organizations')
      .select('id')

  if (error) {
    throw new Error(error.message)
  }

  const results = []

  for (const organization of organizations || []) {
    try {
      const result =
        await runExecutionCycle(organization.id)

      results.push({
        organizationId: organization.id,
        success: true,
        result,
      })
    } catch (error) {
      console.error(
        `Execution cycle failed for organization ${organization.id}:`,
        error,
      )

      results.push({
        organizationId: organization.id,
        success: false,
      })
    }
  }

  return results
}

export async function getTeamTodayWork(
  organizationId: string,
) {
  const { data, error } = await supabaseAdmin
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
        color,
        icon
      ),
      project_modules:module_id (
        id,
        name,
        description
      ),
      assignee:assigned_to (
        id,
        first_name,
        last_name,
        email,
        employee_id,
        role
      )
    `)
    .eq('organization_id', organizationId)
    .neq('status', 'DONE')
    .order('deadline', {
      ascending: true,
      nullsFirst: false,
    })

  if (error) {
    throw new Error(error.message)
  }

  const items = data || []

  const { data: concernsData } = await supabaseAdmin
    .from('work_concerns')
    .select(`
      id,
      work_item_id,
      concern,
      priority,
      status,
      created_at,
      reported_by,
      reporter:reported_by (
        id,
        first_name,
        last_name
      ),
      work_items:work_item_id (
        id,
        title,
        project_id,
        organization_id,
        projects:project_id (
          id,
          name
        )
      )
    `)
    .eq('status', 'OPEN')

  const openConcerns = ((concernsData || []) as any[])
    .filter((c) => c.work_items?.organization_id === organizationId)
    .map((c) => ({
      id: c.id,
      workItemId: c.work_item_id,
      workItemTitle: c.work_items?.title || 'Work Item',
      projectName: c.work_items?.projects?.name || 'Project',
      reporterName: c.reporter ? `${c.reporter.first_name} ${c.reporter.last_name || ''}`.trim() : 'Employee',
      priority: c.priority || 'MEDIUM',
      concern: c.concern,
      createdAt: c.created_at,
    }))

  return {
    total: items.length,

    critical: items.filter(
      (item) => item.health === 'CRITICAL',
    ),

    overdue: items.filter(
      (item) =>
        item.health === 'RED' &&
        item.status !== 'DONE',
    ),

    atRisk: items.filter(
      (item) =>
        item.health === 'AMBER' ||
        item.health === 'ORANGE',
    ),

    carriedForward: items.filter(
      (item) =>
        Number(item.carry_forward_count || 0) > 0,
    ),

    inProgress: items.filter(
      (item) =>
        item.status === 'IN_PROGRESS' ||
        item.status === 'DEVELOPMENT',
    ),

    newWork: items.filter(
      (item) =>
        item.status === 'TODO' &&
        Number(item.carry_forward_count || 0) === 0,
    ),

    openConcerns,

    work: items,
  }
}

export async function getEmployeeWorkDetail(
  organizationId: string,
  employeeId: string,
) {
  const { data: employee, error: employeeError } =
    await supabaseAdmin
      .from('profiles')
      .select(`
        id,
        first_name,
        last_name,
        email,
        employee_id,
        role
      `)
      .eq('id', employeeId)
      .eq('organization_id', organizationId)
      .maybeSingle()

  if (employeeError) {
    throw new Error(employeeError.message)
  }

  if (!employee) {
    throw new Error('Employee not found.')
  }

  const { data: work, error: workError } =
    await supabaseAdmin
      .from('work_items')
      .select(`
        *,
        projects:project_id (
          id,
          name,
          project_key
        ),
        project_modules:module_id (
          id,
          name,
          description
        ),
        work_types:work_type_id (
          id,
          name,
          color,
          icon
        )
      `)
      .eq('organization_id', organizationId)
      .eq('assigned_to', employeeId)
      .neq('title', 'PROJECT_DAILY_REPORT_TEMPLATE')
      .order('deadline', {
        ascending: true,
        nullsFirst: false,
      })

  if (workError) {
    throw new Error(workError.message)
  }

  const items = (work || []).filter(
    (item) => item.title !== 'PROJECT_DAILY_REPORT_TEMPLATE',
  )

  return {
    employee,
    summary: {
      total: items.length,
      completed: items.filter(
        (item) => item.status === 'DONE',
      ).length,
      inProgress: items.filter(
        (item) =>
          item.status === 'IN_PROGRESS' ||
          item.status === 'DEVELOPMENT',
      ).length,
      overdue: items.filter(
        (item) =>
          item.status !== 'DONE' &&
          item.health === 'RED',
      ).length,
      critical: items.filter(
        (item) =>
          item.status !== 'DONE' &&
          item.health === 'CRITICAL',
      ).length,
      blocked: items.filter(
        (item) => item.status === 'BLOCKED',
      ).length,
      carriedForward: items.filter(
        (item) =>
          Number(item.carry_forward_count || 0) > 0,
      ).length,
    },
    work: items,
  }
}

export async function getProjectExecution(
  organizationId: string,
  projectId: string,
) {
  const { data: project, error: projectError } =
    await supabaseAdmin
      .from('projects')
      .select(`
        id,
        name,
        project_key,
        organization_id
      `)
      .eq('id', projectId)
      .eq('organization_id', organizationId)
      .maybeSingle()

  if (projectError) {
    throw new Error(projectError.message)
  }

  if (!project) {
    throw new Error('Project not found.')
  }

  const { data: members, error: memberError } =
    await supabaseAdmin
      .from('project_members')
      .select(`
        id,
        user_id,
        profiles:user_id (
          id,
          first_name,
          last_name,
          email,
          employee_id,
          role
        )
      `)
      .eq('project_id', projectId)

  if (memberError) {
    throw new Error(memberError.message)
  }

  const { data: modules, error: moduleError } =
    await supabaseAdmin
      .from('project_modules')
      .select(`
        id,
        project_id,
        work_type_id,
        name,
        description,
        is_active,
        work_types:work_type_id (
          id,
          name,
          color,
          icon
        )
      `)
      .eq('project_id', projectId)
      .eq('is_active', true)
      .order('name', { ascending: true })

  if (moduleError) {
    throw new Error(moduleError.message)
  }

  const { data: work, error: workError } =
    await supabaseAdmin
      .from('work_items')
      .select(`
        id,
        title,
        description,
        status,
        priority,
        deadline,
        deadline_time,
        progress_percent,

        health,
        escalation_level,
        carry_forward_count,

        assigned_to,
        project_id,
        module_id,
        milestone_id,
        work_type_id,

        assignee:assigned_to (
          id,
          first_name,
          last_name,
          email,
          employee_id
        ),

        project_modules:module_id (
          id,
          name,
          description
        ),

        project_milestones:milestone_id (
          id,
          name,
          deadline,
          status,
          progress_percent
        ),

        work_types:work_type_id (
          id,
          name,
          color,
          icon
        )
      `)
      .eq('organization_id', organizationId)
      .eq('project_id', projectId)
      .order('deadline', {
        ascending: true,
        nullsFirst: false,
      })

  if (workError) {
    throw new Error(workError.message)
  }

  const items = work || []

  const completed = items.filter(
    (item) => item.status === 'DONE',
  )

  const overdue = items.filter(
    (item) =>
      item.status !== 'DONE' &&
      item.health === 'RED',
  )

  const critical = items.filter(
    (item) =>
      item.status !== 'DONE' &&
      item.health === 'CRITICAL',
  )

  const blocked = items.filter(
    (item) => item.status === 'BLOCKED',
  )

  const progress =
    items.length === 0
      ? 0
      : Math.round(
          items.reduce(
            (sum, item) =>
              sum + Number(item.progress_percent || 0),
            0,
          ) / items.length,
        )

  const moduleExecution = (modules || []).map(
    (module) => {
      const moduleItems = items.filter(
        (item) => item.module_id === module.id,
      )

      const moduleCompleted = moduleItems.filter(
        (item) => item.status === 'DONE',
      )

      const moduleOverdue = moduleItems.filter(
        (item) =>
          item.status !== 'DONE' &&
          item.health === 'RED',
      )

      const moduleCritical = moduleItems.filter(
        (item) =>
          item.status !== 'DONE' &&
          item.health === 'CRITICAL',
      )

      const memberIds = [
        ...new Set(
          moduleItems
            .map((item) => item.assigned_to)
            .filter(Boolean),
        ),
      ]

      return {
        ...module,
        totalWork: moduleItems.length,
        completed: moduleCompleted.length,
        overdue: moduleOverdue.length,
        critical: moduleCritical.length,
        progress:
          moduleItems.length === 0
            ? 0
            : Math.round(
                moduleItems.reduce(
                  (sum, item) =>
                    sum +
                    Number(
                      item.progress_percent || 0,
                    ),
                  0,
                ) / moduleItems.length,
              ),
        memberIds,
        work: moduleItems,
      }
    },
  )

  const milestones = await getProjectMilestones(organizationId, projectId)

  return {
    project,
    summary: {
      totalWork: items.length,
      completed: completed.length,
      inProgress: items.filter(
        (item) =>
          item.status === 'IN_PROGRESS' ||
          item.status === 'DEVELOPMENT',
      ).length,
      overdue: overdue.length,
      critical: critical.length,
      blocked: blocked.length,
      carryForward: items.filter(
        (item) =>
          Number(item.carry_forward_count || 0) > 0,
      ).length,
      progress,
      memberCount: members?.length || 0,
      moduleCount: modules?.length || 0,
      milestoneCount: milestones?.length || 0,
    },
    members: members || [],
    modules: moduleExecution,
    milestones: milestones || [],
    work: items,
  }
}

export async function getEmployeeCapacity(
  organizationId: string,
) {
  const { data: employees, error: employeeError } =
    await supabaseAdmin
      .from('profiles')
      .select(`
        id,
        first_name,
        last_name,
        employee_id,
        role
      `)
      .eq('organization_id', organizationId)

  if (employeeError) {
    throw new Error(employeeError.message)
  }

  const { data: capacityRows } =
    await supabaseAdmin
      .from('employee_work_capacity')
      .select('*')
      .eq('organization_id', organizationId)

  const { data: workItems, error: workError } =
    await supabaseAdmin
      .from('work_items')
      .select(`
        id,
        title,
        assigned_to,
        status,
        estimated_hours,
        progress_percent,
        health,
        deadline
      `)
      .eq('organization_id', organizationId)
      .neq('status', 'DONE')
      .neq('title', 'PROJECT_DAILY_REPORT_TEMPLATE')

  if (workError) {
    throw new Error(workError.message)
  }

  const validWorkItems = (workItems || []).filter(
    (item) => item.title !== 'PROJECT_DAILY_REPORT_TEMPLATE',
  )

  const capacityMap = new Map(
    (capacityRows || []).map((row) => [
      row.employee_id,
      row,
    ]),
  )

  return (employees || [])
    .filter(
      (employee) =>
        employee.role === 'EMPLOYEE',
    )
    .map((employee) => {
      const capacity =
        capacityMap.get(employee.id)

      const dailyCapacity =
        Number(
          capacity?.daily_capacity_hours ?? 8,
        )

      const assigned = validWorkItems.filter(
        (item) =>
          item.assigned_to === employee.id,
      )

      const estimatedRemainingHours =
        assigned.reduce(
          (sum, item) => {
            const estimate =
              Number(
                item.estimated_hours || 0,
              )

            const progress =
              Number(
                item.progress_percent || 0,
              )

            return (
              sum +
              estimate *
                Math.max(
                  0,
                  1 - progress / 100,
                )
            )
          },
          0,
        )

      const utilization =
        dailyCapacity === 0
          ? 0
          : Math.round(
              (estimatedRemainingHours /
                dailyCapacity) *
                100,
            )

      let workloadStatus:
        | 'AVAILABLE'
        | 'NORMAL'
        | 'HIGH'
        | 'OVERLOADED'

      if (utilization <= 50) {
        workloadStatus = 'AVAILABLE'
      } else if (utilization <= 85) {
        workloadStatus = 'NORMAL'
      } else if (utilization <= 100) {
        workloadStatus = 'HIGH'
      } else {
        workloadStatus = 'OVERLOADED'
      }

      return {
        employee: {
          id: employee.id,
          first_name: employee.first_name,
          last_name: employee.last_name,
          employee_id: employee.employee_id,
        },

        dailyCapacityHours: dailyCapacity,
        assignedWork: assigned.length,
        estimatedRemainingHours:
          Number(
            estimatedRemainingHours.toFixed(2),
          ),

        utilizationPercent: utilization,
        workloadStatus,

        assignedItems: assigned.map((item) => ({
          id: item.id,
          title: item.title,
          estimatedRemainingHours: Number(
            (
              Number(item.estimated_hours || 0) *
              Math.max(0, 1 - Number(item.progress_percent || 0) / 100)
            ).toFixed(2),
          ),
        })),

        overdueCount: assigned.filter(
          (item) =>
            item.health === 'RED' ||
            item.health === 'CRITICAL',
        ).length,

        criticalCount: assigned.filter(
          (item) =>
            item.health === 'CRITICAL',
        ).length,
      }
    })
}

export async function getAttentionCounts(organizationId: string) {
  const { data: items, error } = await supabaseAdmin
    .from('work_items')
    .select('id, health, status, title')
    .eq('organization_id', organizationId)
    .neq('status', 'DONE')
    .neq('title', 'PROJECT_DAILY_REPORT_TEMPLATE')

  if (error) throw new Error(error.message)

  const active = (items || []).filter((i: any) => i.title !== 'PROJECT_DAILY_REPORT_TEMPLATE')

  const { data: concerns, error: concernError } = await supabaseAdmin
    .from('work_concerns')
    .select('id, work_items!inner(organization_id)')
    .eq('status', 'OPEN')
    .eq('work_items.organization_id', organizationId)

  if (concernError) throw new Error(concernError.message)

  return {
    critical: active.filter((i) => i.health === 'CRITICAL').length,
    overdue: active.filter((i) => i.health === 'RED').length,
    atRisk: active.filter((i) => i.health === 'AMBER' || i.health === 'ORANGE').length,
    blocked: active.filter((i) => i.status === 'BLOCKED').length,
    openConcerns: (concerns || []).length,
  }
}

export async function getLiveOverview(organizationId: string) {
  let tz = 'Asia/Kolkata'
  try {
    const settings = await getOrganizationWorkSettings(organizationId)
    if (settings?.timezone) tz = settings.timezone
  } catch (settingsErr) {
    console.warn('[getLiveOverview settings fallback]:', settingsErr)
  }

  const today = dateInTimezone(tz)
  const currentTime = timeInTimezone(tz)

  // 1. Fetch Profiles for Organization
  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from('profiles')
    .select('id, first_name, last_name, email, role, designation, status, created_at')
    .eq('organization_id', organizationId)

  if (profilesError) {
    console.error('[getLiveOverview profiles error]:', profilesError)
    throw new Error(profilesError.message)
  }

  const profileMap = new Map<string, any>(
    (profiles || []).map((p: any) => [p.id, p]),
  )

  // 2. Fetch Projects for Organization
  const { data: projects, error: projectsError } = await supabaseAdmin
    .from('projects')
    .select('id, name, project_key, status, start_date, target_date')
    .eq('organization_id', organizationId)

  if (projectsError) {
    console.error('[getLiveOverview projects error]:', projectsError)
    throw new Error(projectsError.message)
  }

  const projectMap = new Map<string, any>(
    (projects || []).map((p: any) => [p.id, p]),
  )

  const activeProjects = (projects || []).filter(
    (p: any) => !['COMPLETED', 'CANCELLED', 'ARCHIVED'].includes(p.status),
  )

  // 3. Fetch Work Items for Organization
  const { data: rawWorkItems, error: workError } = await supabaseAdmin
    .from('work_items')
    .select(`
      id,
      title,
      status,
      health,
      priority,
      assigned_to,
      project_id,
      work_type_id,
      deadline,
      deadline_time,
      completed_at,
      updated_at,
      created_at,
      carry_forward_count,
      progress_percent
    `)
    .eq('organization_id', organizationId)
    .neq('title', 'PROJECT_DAILY_REPORT_TEMPLATE')

  if (workError) {
    console.error('[getLiveOverview work items error]:', workError)
    throw new Error(workError.message)
  }

  // In-memory mapping for relational consistency
  const allWork = (rawWorkItems || [])
    .filter((w: any) => w.title !== 'PROJECT_DAILY_REPORT_TEMPLATE')
    .map((w: any) => {
    const assignee = w.assigned_to ? profileMap.get(w.assigned_to) : null
    const project = w.project_id ? projectMap.get(w.project_id) : null
    return {
      ...w,
      assignee: assignee
        ? {
            id: assignee.id,
            first_name: assignee.first_name,
            last_name: assignee.last_name,
            email: assignee.email,
            role: assignee.role,
          }
        : null,
      project: project
        ? {
            id: project.id,
            name: project.name,
            project_key: project.project_key,
          }
        : null,
    }
  })

  const workItemMap = new Map<string, any>(
    allWork.map((w: any) => [w.id, w]),
  )

  // 4. Mathematical card definitions
  const activeAssignedWork = allWork.filter(
    (w) => w.assigned_to && w.status !== 'DONE',
  )
  const activeWork = allWork.filter(
    (w) => ['IN_PROGRESS', 'DEVELOPMENT', 'IN_REVIEW'].includes(w.status),
  )
  const completedTodayWork = allWork.filter(
    (w) =>
      w.status === 'DONE' &&
      ((w.completed_at && formatDateInTimezone(w.completed_at, tz) === today) ||
        (w.updated_at && formatDateInTimezone(w.updated_at, tz) === today)),
  )
  const overdueWork = allWork.filter(
    (w) =>
      w.status !== 'DONE' &&
      (w.health === 'RED' ||
        w.health === 'CRITICAL' ||
        (w.deadline &&
          (w.deadline < today ||
            (w.deadline === today && w.deadline_time && w.deadline_time < currentTime)))),
  )
  const carriedForwardWork = allWork.filter(
    (w) => w.status !== 'DONE' && Number(w.carry_forward_count || 0) > 0,
  )
  const dueTodayWork = allWork.filter(
    (w) => w.status !== 'DONE' && w.deadline === today,
  )
  const atRiskWork = allWork.filter(
    (w) =>
      w.status !== 'DONE' &&
      ['AMBER', 'ORANGE', 'RED', 'CRITICAL'].includes(w.health),
  )
  const blockedWork = allWork.filter(
    (w) => w.status === 'BLOCKED',
  )

  const totalEmployees = (profiles || []).length
  const activeEmployees = (profiles || []).filter(
    (p: any) => p.status !== 'INACTIVE' && p.status !== 'SUSPENDED' && p.role !== 'INACTIVE',
  ).length
  const managersCount = (profiles || []).filter((p: any) => ['MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(p.role)).length
  const employeesOnLeave = (profiles || []).filter((p: any) => p.status === 'ON_LEAVE' || p.is_on_leave).length

  const summary = {
    employees: totalEmployees,
    totalEmployees,
    activeEmployees,
    managers: managersCount,
    employeesOnLeave,

    projects: (projects || []).length,
    totalProjects: (projects || []).length,
    activeProjects: activeProjects.length,

    totalWork: allWork.length,
    assigned: activeAssignedWork.length,
    active: activeWork.length,
    inProgress: activeWork.length,

    completedToday: completedTodayWork.length,
    overdue: overdueWork.length,
    carriedForward: carriedForwardWork.length,
    dueToday: dueTodayWork.length,
    atRisk: atRiskWork.length,
    blocked: blockedWork.length,
  }

  // Pulse
  const pulseAssigned = activeAssignedWork.length + completedTodayWork.length
  const pulseCompleted = completedTodayWork.length
  const pulseInProgress = activeWork.length
  const pulseOverdue = overdueWork.length
  const pulsePending = Math.max(
    0,
    pulseAssigned - (pulseCompleted + pulseInProgress + pulseOverdue),
  )
  const pulsePercentage =
    pulseAssigned > 0
      ? Math.min(100, Math.round((pulseCompleted / pulseAssigned) * 100))
      : 0

  const pulse = {
    assigned: pulseAssigned,
    completed: pulseCompleted,
    inProgress: pulseInProgress,
    overdue: pulseOverdue,
    pending: pulsePending,
    percentage: pulsePercentage,
  }

  // Attention collections
  const formatAttentionItem = (w: any) => ({
    id: w.id,
    title: w.title,
    status: w.status,
    health: w.health,
    priority: w.priority,
    deadline: w.deadline,
    deadline_time: w.deadline_time,
    progress_percent: w.progress_percent,
    carry_forward_count: w.carry_forward_count,
    assigneeName: w.assignee
      ? `${w.assignee.first_name || ''} ${w.assignee.last_name || ''}`.trim() || w.assignee.email
      : 'Unassigned',
    projectName: w.project?.name || 'No Project',
  })

  const attention = {
    overdue: overdueWork.map(formatAttentionItem),
    carriedForward: carriedForwardWork.map(formatAttentionItem),
    atRisk: atRiskWork.map(formatAttentionItem),
    blocked: blockedWork.map(formatAttentionItem),
  }

  // Project Health roll-up
  const projectHealth = activeProjects.map((p: any) => {
    const pWork = allWork.filter((w) => w.project_id === p.id)
    const total = pWork.length
    const done = pWork.filter((w) => w.status === 'DONE').length
    const inProg = pWork.filter((w) => ['IN_PROGRESS', 'DEVELOPMENT', 'IN_REVIEW'].includes(w.status)).length
    const ovd = pWork.filter(
      (w) =>
        w.status !== 'DONE' &&
        (w.health === 'RED' ||
          w.health === 'CRITICAL' ||
          (w.deadline && (w.deadline < today || (w.deadline === today && w.deadline_time && w.deadline_time < currentTime)))),
    ).length
    const pct = total > 0 ? Math.round((done / total) * 100) : 0
    let health: 'GREEN' | 'AMBER' | 'ORANGE' | 'RED' = 'GREEN'
    if (ovd > 0 || (total > 0 && pct < 40)) health = ovd > 2 || pct < 25 ? 'RED' : 'ORANGE'
    else if (total > 0 && pct < 70) health = 'AMBER'

    return {
      id: p.id,
      name: p.name,
      project_key: p.project_key,
      total,
      completed: done,
      inProgress: inProg,
      overdue: ovd,
      progress: pct,
      health,
    }
  })

  // Team Workload roll-up
  const teamWorkload = (profiles || []).map((emp: any) => {
    const empWork = allWork.filter((w) => w.assigned_to === emp.id)
    const activeTasks = empWork.filter((w) => w.status !== 'DONE').length
    const completedToday = empWork.filter(
      (w) =>
        w.status === 'DONE' &&
        ((w.completed_at && formatDateInTimezone(w.completed_at, tz) === today) ||
          (w.updated_at && formatDateInTimezone(w.updated_at, tz) === today)),
    ).length
    const empOverdue = empWork.filter(
      (w) =>
        w.status !== 'DONE' &&
        (w.health === 'RED' ||
          w.health === 'CRITICAL' ||
          (w.deadline && (w.deadline < today || (w.deadline === today && w.deadline_time && w.deadline_time < currentTime)))),
    ).length
    const empCarried = empWork.filter((w) => w.status !== 'DONE' && Number(w.carry_forward_count || 0) > 0).length

    let loadStatus: 'NORMAL' | 'HIGH' | 'OVERLOADED' = 'NORMAL'
    if (activeTasks >= 6 || empOverdue >= 3) {
      loadStatus = 'OVERLOADED'
    } else if (activeTasks >= 4 || empOverdue >= 1) {
      loadStatus = 'HIGH'
    }

    return {
      id: emp.id,
      name: `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.email,
      role: emp.role,
      activeTasks,
      completedToday,
      overdue: empOverdue,
      carriedForward: empCarried,
      loadStatus,
    }
  })

  // 5. Broad Live Activity Stream
  const activityEvents: Array<{
    id: string
    createdAt: string
    actorName: string
    workItemTitle: string
    updateText: string
    type?: string
    progressPercent?: number
  }> = []

  // (a) Work updates
  const workItemIds = allWork.map((w) => w.id)
  if (workItemIds.length > 0) {
    const { data: updates, error: updatesError } = await supabaseAdmin
      .from('work_updates')
      .select('id, work_item_id, employee_id, update_text, progress_percent, created_at')
      .in('work_item_id', workItemIds)
      .order('created_at', { ascending: false })
      .limit(10)

    if (!updatesError && updates) {
      for (const u of updates as any[]) {
        const emp = u.employee_id ? profileMap.get(u.employee_id) : null
        const item = u.work_item_id ? workItemMap.get(u.work_item_id) : null
        activityEvents.push({
          id: u.id,
          createdAt: u.created_at,
          actorName: emp ? `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.email : 'Team Member',
          workItemTitle: item?.title || 'Work Task',
          updateText: u.update_text || `Progress updated to ${u.progress_percent || 0}%`,
          progressPercent: u.progress_percent,
          type: 'WORK_UPDATE',
        })
      }
    }
  }

  // (b) Notifications / Work events
  const { data: recentNotifs, error: notifsError } = await supabaseAdmin
    .from('notifications')
    .select('id, title, message, type, user_id, created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(10)

  if (!notifsError && recentNotifs) {
    for (const n of recentNotifs as any[]) {
      const user = n.user_id ? profileMap.get(n.user_id) : null
      activityEvents.push({
        id: n.id,
        createdAt: n.created_at,
        actorName: user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email : 'System',
        workItemTitle: n.title,
        updateText: n.message,
        type: n.type,
      })
    }
  }

  // (c) Concerns
  if (workItemIds.length > 0) {
    const { data: recentConcerns, error: concernsError } = await supabaseAdmin
      .from('work_concerns')
      .select('id, title, status, priority, reported_by, work_item_id, created_at')
      .in('work_item_id', workItemIds)
      .order('created_at', { ascending: false })
      .limit(8)

    if (!concernsError && recentConcerns) {
      for (const c of recentConcerns as any[]) {
        const reporter = c.reported_by ? profileMap.get(c.reported_by) : null
        const item = c.work_item_id ? workItemMap.get(c.work_item_id) : null
        activityEvents.push({
          id: c.id,
          createdAt: c.created_at,
          actorName: reporter ? `${reporter.first_name || ''} ${reporter.last_name || ''}`.trim() || reporter.email : 'Team Member',
          workItemTitle: item?.title || 'Work Concern',
          updateText: `Concern (${c.priority || 'MEDIUM'}): ${c.title} [${c.status}]`,
          type: 'CONCERN',
        })
      }
    }
  }

  activityEvents.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const liveActivity = activityEvents.slice(0, 15)

  return {
    generatedAt: new Date().toISOString(),
    timezone: tz,
    today,
    summary,
    pulse,
    attention,
    projectHealth,
    teamWorkload,
    liveActivity,
    freshness: {
      generatedAt: new Date().toISOString(),
      source: 'database',
    },
  }
}

