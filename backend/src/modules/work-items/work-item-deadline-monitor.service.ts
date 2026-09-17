import { supabaseAdmin } from '../../lib/supabase.js'
import {
  createNotification,
  getRelevantManagementStakeholders,
} from '../notifications/notification.service.js'
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
    | 'DEADLINE_APPROACHING'
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

  const [{ data, error }, { data: orgSettings }] = await Promise.all([
    supabaseAdmin
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
      .neq('status', 'DONE'),
    supabaseAdmin
      .from('organization_settings')
      .select('organization_id, timezone'),
  ])

  if (error) {
    throw new Error(error.message)
  }

  const orgTimezoneMap = new Map<string, string>()
  for (const s of orgSettings || []) {
    if (s.organization_id && s.timezone) {
      orgTimezoneMap.set(s.organization_id, s.timezone)
    }
  }

  const items = (data || []) as DeadlineWorkItem[]

  let processed = 0
  let notificationsSent = 0
  let overdueCount = 0

  for (const item of items) {
    try {
      const orgTz = (item.organization_id && orgTimezoneMap.get(item.organization_id)) || 'Asia/Kolkata'
      const deadline = createDeadlineDateTime(item.deadline, item.deadline_time, orgTz)
      if (!deadline) {
        continue
      }

      processed += 1

      const deadlineState: DeadlineState = getDeadlineState(deadline, now)
      const msRemaining = deadline.getTime() - now.getTime()
      const minutesRemaining = msRemaining / (1000 * 60)
      const hoursOverdue = Math.max(0, -msRemaining / (1000 * 60 * 60))

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
            `pacing-backlog-emp-${todayStr}-${item.id}`,
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
              `pacing-backlog-pm-${todayStr}-${item.id}`,
              'WORK_ESCALATED',
              'Employee Behind Daily Target Pace',
              `"${item.title}" is behind schedule with a backlog of ${pacing.backlog} ${unitLabel}. Required pace increased to ${Math.ceil(pacing.requiredPerDay)} ${unitLabel}/day.`,
            )
            if (sent) notificationsSent++
          }
        }
      }

      // 1. OVERDUE STATE (Deadline has passed & status != DONE)
      if (msRemaining <= 0 || deadlineState === 'OVERDUE') {
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

        // Alert Assigned User when crossing deadline (1x)
        if (item.assigned_to) {
          const sent = await sendAlertOnce(
            item,
            item.assigned_to,
            `overdue-assigned-${item.id}`,
            'WORK_OVERDUE',
            'Work is overdue',
            `"${item.title}" has passed its deadline (${item.deadline} ${item.deadline_time || ''}). Please update progress immediately.`,
          )
          if (sent) notificationsSent++
        }

        // Alert Relevant Admin & Manager when crossing deadline (1x)
        const mgmtRecipients = await getRelevantManagementStakeholders({
          organizationId: item.organization_id,
          assignedTo: item.assigned_to,
          projectId: item.project_id,
        })
        for (const mgmtId of mgmtRecipients) {
          if (mgmtId !== item.assigned_to) {
            const sent = await sendAlertOnce(
              item,
              mgmtId,
              `overdue-mgmt-${mgmtId}-${item.id}`,
              'WORK_OVERDUE',
              'Work is overdue',
              `"${item.title}" has passed its deadline (${item.deadline} ${item.deadline_time || ''}).`,
            )
            if (sent) notificationsSent++
          }
        }

        // Tier 2: Alert Project Manager after 2 hours overdue
        if (hoursOverdue >= 2 && item.project_id) {
          const pmId = await getProjectManagerId(item.project_id)
          if (pmId && pmId !== item.assigned_to) {
            const sent = await sendAlertOnce(
              item,
              pmId,
              `overdue-manager-2h-${item.id}`,
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
                `overdue-admin-4h-${item.id}`,
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

      // 2. 5 MINUTES BEFORE DEADLINE (<= 5 mins, > 0 mins) -> DEADLINE_URGENT (Assigned user only)
      if (minutesRemaining <= 5 && minutesRemaining > 0) {
        if (item.assigned_to) {
          const sent = await sendAlertOnce(
            item,
            item.assigned_to,
            `deadline-5m-${item.id}`,
            'DEADLINE_URGENT',
            '🔴 5 Minutes Remaining',
            `"${item.title}" is due in 5 minutes! Please submit your work immediately.`,
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

      // 3. 30 MINUTES BEFORE DEADLINE (<= 30 mins, > 5 mins) -> DEADLINE_WARNING (Assigned user only)
      if (minutesRemaining <= 30 && minutesRemaining > 5) {
        if (item.assigned_to) {
          const sent = await sendAlertOnce(
            item,
            item.assigned_to,
            `deadline-30m-${item.id}`,
            'DEADLINE_WARNING',
            '⚠️ 30 Minutes Remaining',
            `"${item.title}" is due in 30 minutes. Please finalize and review your deliverables.`,
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

      // 4. 1 HOUR BEFORE DEADLINE (<= 60 mins, > 30 mins) -> DEADLINE_APPROACHING (Assigned user only)
      if (minutesRemaining <= 60 && minutesRemaining > 30) {
        if (item.assigned_to) {
          const sent = await sendAlertOnce(
            item,
            item.assigned_to,
            `deadline-1h-${item.id}`,
            'DEADLINE_APPROACHING',
            '⏳ 1 Hour Remaining',
            `"${item.title}" is due in 1 hour. Please prepare deliverables.`,
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

      // 5. NORMAL (> 60 minutes remaining) -> Update health if changed, no notification sent
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
