import { supabaseAdmin } from '../../lib/supabase.js'
import { createNotification } from '../notifications/notification.service.js'
import {
  createDeadlineDateTime,
  getDeadlineState,
  type DeadlineState,
} from './work-deadline.utils.js'
import { calculateWorkItemPacing } from './work-item-pacing.service.js'
import { calculateWorkHealth } from './work-health.service.js'

type DeadlineWorkItem = {
  id: string
  organization_id: string
  project_id: string | null
  assigned_to: string | null
  title: string
  status: string
  priority: string | null
  health: string | null
  deadline: string | null
  deadline_time: string | null
  target_quantity?: number | null
  completed_quantity?: number | null
  quantity_unit?: string | null
  pacing_start_date?: string | null
  pacing_enabled?: boolean | null
  escalation_level?: number | null
}

async function alertAlreadySent(
  workItemId: string,
  userId: string,
  alertKey: string,
): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .from('work_item_deadline_alerts')
      .select('id')
      .eq('work_item_id', workItemId)
      .eq('user_id', userId)
      .eq('alert_key', alertKey)
      .maybeSingle()

    if (error) {
      if (error.code === '42P01') {
        return false
      }
      throw new Error(error.message)
    }

    return Boolean(data)
  } catch (err) {
    console.warn('[Deadline Monitor] alertAlreadySent check note:', err)
    return false
  }
}

async function recordAlert(
  organizationId: string,
  workItemId: string,
  userId: string,
  alertKey: string,
  alertType: string,
): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from('work_item_deadline_alerts')
      .insert({
        organization_id: organizationId,
        work_item_id: workItemId,
        user_id: userId,
        alert_key: alertKey,
        alert_type: alertType,
      })

    if (error && error.code !== '23505' && error.code !== '42P01') {
      throw new Error(error.message)
    }
  } catch (err) {
    console.warn('[Deadline Monitor] recordAlert check note:', err)
  }
}

async function sendAlertOnce(
  item: DeadlineWorkItem,
  userId: string,
  alertKey: string,
  type:
    | 'DEADLINE_REMINDER'
    | 'DEADLINE_WARNING'
    | 'DEADLINE_CRITICAL'
    | 'DEADLINE_URGENT'
    | 'WORK_OVERDUE'
    | 'WORK_ESCALATED',
  title: string,
  message: string,
): Promise<boolean> {
  const alreadySent = await alertAlreadySent(item.id, userId, alertKey)
  if (alreadySent) {
    return false
  }

  await recordAlert(item.organization_id, item.id, userId, alertKey, type)

  await createNotification({
    userId,
    organizationId: item.organization_id,
    type,
    title,
    message,
    workItemId: item.id,
    projectId: item.project_id || undefined,
  })

  return true
}

async function getProjectManagerId(projectId: string): Promise<string | null> {
  try {
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('project_manager_id')
      .eq('id', projectId)
      .maybeSingle()
    return project?.project_manager_id || null
  } catch {
    return null
  }
}

async function getAdminIds(organizationId: string): Promise<string[]> {
  try {
    const { data: admins } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('organization_id', organizationId)
      .in('role', ['SUPER_ADMIN', 'ADMIN'])

    return (admins || []).map((a) => a.id)
  } catch {
    return []
  }
}

/**
 * Scheduled and on-demand processor for active work items.
 * Evaluates deadline state, pacing, health, escalation levels, and deduplicated reminders.
 */
export async function runDeadlineMonitor() {
  const now = new Date()

  const { data, error } = await supabaseAdmin
    .from('work_items')
    .select(`
      id,
      organization_id,
      project_id,
      assigned_to,
      title,
      status,
      priority,
      health,
      deadline,
      deadline_time,
      target_quantity,
      completed_quantity,
      quantity_unit,
      pacing_start_date,
      pacing_enabled,
      escalation_level
    `)
    .not('deadline', 'is', null)
    .neq('status', 'DONE')

  if (error) {
    throw new Error(error.message)
  }

  const items = (data || []) as DeadlineWorkItem[]

  let processed = 0
  let notificationsSent = 0
  let overdueCount = 0

  for (const item of items) {
    try {
      const deadline = createDeadlineDateTime(item.deadline, item.deadline_time)
      if (!deadline) {
        continue
      }

      processed += 1

      const deadlineState: DeadlineState = getDeadlineState(deadline, now)
      const msRemaining = deadline.getTime() - now.getTime()
      const hoursRemaining = msRemaining / (1000 * 60 * 60)
      const hoursOverdue = Math.max(0, -hoursRemaining)

      // Calculate pacing independently
      const pacing = calculateWorkItemPacing({
        status: item.status,
        target_quantity: item.target_quantity,
        completed_quantity: item.completed_quantity,
        pacing_start_date: item.pacing_start_date,
        deadline: item.deadline,
        deadline_time: item.deadline_time,
        pacing_enabled: item.pacing_enabled,
      })

      // Calculate health from deadline state, status, pacing, and priority
      const health = calculateWorkHealth({
        status: item.status,
        deadlineState,
        pacingStatus: pacing.status,
        priority: item.priority,
        escalationLevel: item.escalation_level,
      })

      // Check Daily Target & Pacing Backlog (deduplicated per day)
      if (
        item.pacing_enabled &&
        pacing.isBacklog &&
        pacing.backlog > 0 &&
        item.status !== 'DONE'
      ) {
        const todayStr = now.toISOString().slice(0, 10)
        const unitLabel = item.quantity_unit || 'items'

        // 1. Notify Employee if workload increased / behind schedule (1x per day)
        if (item.assigned_to) {
          const sent = await sendAlertOnce(
            item,
            item.assigned_to,
            `pacing-backlog-emp-${todayStr}`,
            'DEADLINE_WARNING',
            'Workload Increased (Behind Schedule)',
            `Expected by today: ${pacing.expectedQuantity} ${unitLabel}, Completed: ${pacing.completedQuantity} ${unitLabel}. You have a backlog of ${pacing.backlog} ${unitLabel}. Required pace increased to ${Math.ceil(pacing.requiredPerDay)} ${unitLabel}/day to meet deadline.`,
          )
          if (sent) notificationsSent++
        }

        // 2. Notify Project Manager if backlog is significant (1x per day)
        if (item.project_id && (pacing.backlog >= 2 || pacing.status === 'BEHIND')) {
          const pmId = await getProjectManagerId(item.project_id)
          if (pmId && pmId !== item.assigned_to) {
            const sent = await sendAlertOnce(
              item,
              pmId,
              `pacing-backlog-pm-${todayStr}`,
              'WORK_ESCALATED',
              'Employee Behind Daily Target Pace',
              `"${item.title}" is behind schedule with a backlog of ${pacing.backlog} ${unitLabel}. Required pace increased to ${Math.ceil(pacing.requiredPerDay)} ${unitLabel}/day.`,
            )
            if (sent) notificationsSent++
          }
        }
      }

      // 1. OVERDUE STATE (Deadline has passed & status != DONE)
      if (deadlineState === 'OVERDUE') {
        overdueCount += 1

        let escalationLevel = 1
        if (hoursOverdue >= 4) {
          escalationLevel = 3
        } else if (hoursOverdue >= 2) {
          escalationLevel = 2
        }

        // Persist health & escalation
        try {
          await supabaseAdmin
            .from('work_items')
            .update({
              health: 'RED',
              escalation_level: escalationLevel,
              updated_at: now.toISOString(),
            })
            .eq('id', item.id)
            .neq('status', 'DONE')
        } catch (updErr) {
          console.warn('Health update note:', updErr)
        }

        // Tier 1: Alert Employee immediately
        if (item.assigned_to) {
          const sent = await sendAlertOnce(
            item,
            item.assigned_to,
            'overdue-employee',
            'WORK_OVERDUE',
            'Work is overdue',
            `"${item.title}" has passed its deadline (${item.deadline} ${item.deadline_time || ''}). Please update progress immediately.`,
          )
          if (sent) notificationsSent++
        }

        // Tier 2: Alert Project Manager after 2 hours overdue
        if (hoursOverdue >= 2 && item.project_id) {
          const pmId = await getProjectManagerId(item.project_id)
          if (pmId && pmId !== item.assigned_to) {
            const sent = await sendAlertOnce(
              item,
              pmId,
              'overdue-manager-2h',
              'WORK_ESCALATED',
              'Overdue work escalation',
              `"${item.title}" is overdue by ${Math.floor(hoursOverdue)} hours and requires managerial attention.`,
            )
            if (sent) notificationsSent++
          }
        }

        // Tier 3: Alert Admins after 4 hours overdue
        if (hoursOverdue >= 4) {
          const adminIds = await getAdminIds(item.organization_id)
          for (const adminId of adminIds) {
            if (adminId !== item.assigned_to) {
              const sent = await sendAlertOnce(
                item,
                adminId,
                'overdue-admin-4h',
                'WORK_ESCALATED',
                'Critical overdue escalation',
                `"${item.title}" is overdue by ${Math.floor(hoursOverdue)} hours. Admin escalation triggered.`,
              )
              if (sent) notificationsSent++
            }
          }
        }

        continue
      }

      // 2. FINAL WARNING (< 1 hour remaining)
      if (deadlineState === 'FINAL_WARNING') {
        if (item.assigned_to) {
          const sent = await sendAlertOnce(
            item,
            item.assigned_to,
            'deadline-final-warning',
            'DEADLINE_URGENT',
            '🔴 1 Hour Remaining',
            `"${item.title}" is due in less than 1 hour. This work is now urgent.`,
          )
          if (sent) notificationsSent++
        }

        try {
          await supabaseAdmin
            .from('work_items')
            .update({
              health: 'RED',
              escalation_level: 2,
              updated_at: now.toISOString(),
            })
            .eq('id', item.id)
        } catch (updErr) {
          console.warn('Health update note:', updErr)
        }

        continue
      }

      // 3. URGENT (1 to 6 hours remaining) -> reminder every 1 hour
      if (deadlineState === 'URGENT') {
        if (item.assigned_to) {
          const hourBucket = Math.max(1, Math.ceil(hoursRemaining))
          const alertKey = `urgent-1h-${hourBucket}h`

          const sent = await sendAlertOnce(
            item,
            item.assigned_to,
            alertKey,
            'DEADLINE_URGENT',
            '⚠ Urgent Deadline',
            `"${item.title}" has approximately ${hourBucket} hours remaining. Please complete pending deliverables.`,
          )
          if (sent) notificationsSent++
        }

        try {
          await supabaseAdmin
            .from('work_items')
            .update({
              health: 'RED',
              escalation_level: 1,
              updated_at: now.toISOString(),
            })
            .eq('id', item.id)
        } catch (updErr) {
          console.warn('Health update note:', updErr)
        }

        continue
      }

      // 4. CRITICAL (6 to 24 hours remaining) -> reminder every 2 hours
      if (deadlineState === 'CRITICAL') {
        if (item.assigned_to) {
          const twoHourWindow = Math.ceil(hoursRemaining / 2) * 2
          const alertKey = `critical-2h-${twoHourWindow}h`

          const sent = await sendAlertOnce(
            item,
            item.assigned_to,
            alertKey,
            'DEADLINE_CRITICAL',
            'Deadline Approaching',
            `"${item.title}" has approximately ${Math.ceil(hoursRemaining)} hours remaining.`,
          )
          if (sent) notificationsSent++
        }

        try {
          await supabaseAdmin
            .from('work_items')
            .update({
              health,
              updated_at: now.toISOString(),
            })
            .eq('id', item.id)
        } catch (updErr) {
          console.warn('Health update note:', updErr)
        }

        continue
      }

      // 5. WARNING (24 to 48 hours remaining) -> 1 reminder
      if (deadlineState === 'WARNING') {
        if (item.assigned_to) {
          const sent = await sendAlertOnce(
            item,
            item.assigned_to,
            'deadline-warning-24h',
            'DEADLINE_WARNING',
            'Deadline in 24–48 Hours',
            `"${item.title}" is due in ${Math.ceil(hoursRemaining / 24)} days. Please review your progress.`,
          )
          if (sent) notificationsSent++
        }

        try {
          await supabaseAdmin
            .from('work_items')
            .update({
              health,
              updated_at: now.toISOString(),
            })
            .eq('id', item.id)
        } catch (updErr) {
          console.warn('Health update note:', updErr)
        }

        continue
      }

      // 6. NORMAL (> 48 hours remaining) -> Update health if changed
      if (item.health !== health) {
        try {
          await supabaseAdmin
            .from('work_items')
            .update({
              health,
              updated_at: now.toISOString(),
            })
            .eq('id', item.id)
        } catch (updErr) {
          console.warn('Health update note:', updErr)
        }
      }
    } catch (itemErr) {
      // Individual record failure isolation
      console.error(`[Deadline Monitor] Error processing item ${item.id}:`, itemErr)
    }
  }

  return {
    processed,
    notificationsSent,
    overdueCount,
  }
}
