import { supabaseAdmin } from '../../lib/supabase.js'
import {
  type ProjectReportTemplate,
  type ProjectReportField,
  type ProjectReportTemplateData,
  type ProjectDailyReportSubmission,
  type ProjectDailyReportsSummary,
  type MemberReportStatus,
  type ReportAnswer,
} from './project-daily-report.types.js'
import {
  createNotification,
  notifyDailyReportSubmitted,
  notifyStakeholders,
  getDirectManagerId,
  getOrganizationStakeholderIds,
} from '../notifications/notification.service.js'
import { NotificationType } from '../notifications/notification.types.js'
import { nowInTimezone, dateInTimezone } from '../../utils/timezone.js'

const TEMPLATE_TITLE_KEY = 'PROJECT_DAILY_REPORT_TEMPLATE'

/**
 * 1. Get the active Daily Report Template for a Project
 */
export async function getProjectReportTemplate(
  projectId: string,
): Promise<ProjectReportTemplate | null> {
  const { data, error } = await supabaseAdmin
    .from('recurring_work_templates')
    .select('*')
    .eq('project_id', projectId)
    .eq('title', TEMPLATE_TITLE_KEY)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    return null
  }

  let parsed: ProjectReportTemplateData = {
    name: 'Daily Report',
    fields: [],
  }

  try {
    if (data.description) {
      parsed = JSON.parse(data.description)
    }
  } catch (err) {
    console.warn('[ProjectDailyReport] Failed to parse template JSON:', err)
  }

  return {
    id: data.id,
    project_id: data.project_id,
    organization_id: data.organization_id,
    name: parsed.name || 'Daily Report',
    description: parsed.description,
    is_active: data.is_active,
    fields: parsed.fields || [],
    created_by: data.created_by,
    created_at: data.created_at,
    updated_at: data.updated_at,
  }
}

/**
 * 2. Create or Update Project Daily Report Template
 */
export async function saveProjectReportTemplate(
  organizationId: string,
  projectId: string,
  userId: string,
  input: {
    name: string
    description?: string
    fields: ProjectReportField[]
  },
): Promise<ProjectReportTemplate> {
  if (!input.name?.trim()) {
    throw new Error('Template name is required.')
  }

  if (!input.fields || input.fields.length === 0) {
    throw new Error('At least one report field is required.')
  }

  // Sanitize fields and ensure IDs / keys
  const sanitizedFields: ProjectReportField[] = input.fields.map((f, idx) => {
    const rawKey = f.field_key || f.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    return {
      id: f.id || `f_${idx + 1}_${Date.now().toString(36)}`,
      label: f.label.trim(),
      field_key: rawKey || `field_${idx + 1}`,
      field_type: f.field_type || 'TEXT',
      required: Boolean(f.required),
      counts_toward_performance: Boolean(f.counts_toward_performance),
      counts_toward_target: Boolean(f.counts_toward_target),
      options: Array.isArray(f.options) ? f.options.filter(Boolean) : undefined,
      sort_order: typeof f.sort_order === 'number' ? f.sort_order : idx + 1,
    }
  })

  const templatePayload: ProjectReportTemplateData = {
    name: input.name.trim(),
    description: input.description?.trim(),
    fields: sanitizedFields,
  }

  // Check if active template exists
  const { data: existing } = await supabaseAdmin
    .from('recurring_work_templates')
    .select('id')
    .eq('project_id', projectId)
    .eq('title', TEMPLATE_TITLE_KEY)
    .limit(1)
    .maybeSingle()

  let templateId: string

  if (existing) {
    const { data: updated, error } = await supabaseAdmin
      .from('recurring_work_templates')
      .update({
        description: JSON.stringify(templatePayload),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single()

    if (error) throw new Error(error.message)
    templateId = updated.id
  } else {
    const { data: created, error } = await supabaseAdmin
      .from('recurring_work_templates')
      .insert({
        organization_id: organizationId,
        project_id: projectId,
        title: TEMPLATE_TITLE_KEY,
        description: JSON.stringify(templatePayload),
        assignment_mode: 'ALL',
        frequency: null,
        is_active: true,
        created_by: userId,
      })
      .select()
      .single()

    if (error) throw new Error(error.message)
    templateId = created.id
  }

  // Purge any accidental work items or targets created for this template
  await cleanupDailyReportWorkItems(organizationId, projectId)

  return (await getProjectReportTemplate(projectId))!
}

/**
 * Helper to clean up any accidental work items or targets created for daily report templates
 */
export async function cleanupDailyReportWorkItems(
  organizationId?: string,
  projectId?: string,
) {
  try {
    let targetQuery = supabaseAdmin
      .from('daily_work_targets')
      .delete()
      .eq('title', TEMPLATE_TITLE_KEY)
    if (organizationId) targetQuery = targetQuery.eq('organization_id', organizationId)
    if (projectId) targetQuery = targetQuery.eq('project_id', projectId)
    await targetQuery

    let workQuery = supabaseAdmin
      .from('work_items')
      .delete()
      .eq('title', TEMPLATE_TITLE_KEY)
    if (organizationId) workQuery = workQuery.eq('organization_id', organizationId)
    if (projectId) workQuery = workQuery.eq('project_id', projectId)
    await workQuery
  } catch (err) {
    console.warn('[ProjectDailyReport] Failed to cleanup daily report work items:', err)
  }
}

/**
 * 3. Submit Daily Report for a Project
 */
export async function submitProjectDailyReport(
  organizationId: string,
  projectId: string,
  employeeId: string,
  input: {
    report_date?: string
    answers: Record<string, any>
  },
): Promise<ProjectDailyReportSubmission> {
  const targetDate =
    input.report_date || new Date().toISOString().split('T')[0]

  // 1. Verify template exists
  const template = await getProjectReportTemplate(projectId)
  if (!template) {
    throw new Error('No active Daily Report Template is configured for this project.')
  }

  // 2. Check for duplicate submission for this date
  const { data: existingSubmission } = await supabaseAdmin
    .from('project_daily_updates')
    .select('id')
    .eq('project_id', projectId)
    .eq('employee_id', employeeId)
    .eq('update_date', targetDate)
    .maybeSingle()

  if (existingSubmission) {
    throw new Error(`You have already submitted a daily report for ${targetDate}.`)
  }

  // 3. Validate required fields & assemble answer array
  const formattedAnswers: ReportAnswer[] = []
  let performanceScore = 100
  let isBlocked = false

  for (const field of template.fields) {
    const val = input.answers[field.id] ?? input.answers[field.field_key]

    if (field.required && (val === undefined || val === null || val === '')) {
      throw new Error(`Field "${field.label}" is required.`)
    }

    if (field.field_type === 'BOOLEAN' && field.field_key.includes('block') && Boolean(val)) {
      isBlocked = true
    }

    formattedAnswers.push({
      field_id: field.id,
      label: field.label,
      field_key: field.field_key,
      field_type: field.field_type,
      value: val,
      counts_toward_performance: field.counts_toward_performance,
      counts_toward_target: field.counts_toward_target,
    })
  }

  const submissionPayload = {
    status: 'SUBMITTED' as const,
    submitted_at: new Date().toISOString(),
    values: input.answers,
    answers: formattedAnswers,
    template_snapshot: {
      template_id: template.id,
      name: template.name,
      fields: template.fields,
    },
  }

  const { data, error } = await supabaseAdmin
    .from('project_daily_updates')
    .insert({
      project_id: projectId,
      template_id: template.id,
      employee_id: employeeId,
      update_date: targetDate,
      paragraph_update: JSON.stringify(submissionPayload),
      progress_percent: performanceScore,
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  // 4. Notify Manager & Leadership (excluding submitter)
  try {
    const [{ data: emp }, { data: proj }] = await Promise.all([
      supabaseAdmin.from('profiles').select('first_name, last_name').eq('id', employeeId).single(),
      supabaseAdmin.from('projects').select('name').eq('id', projectId).single(),
    ])

    const empName = emp ? `${emp.first_name} ${emp.last_name || ''}`.trim() : 'An employee'
    const projName = proj?.name || 'Project'

    await notifyDailyReportSubmitted({
      organizationId,
      submitterId: employeeId,
      projectId,
      title: 'Daily Report Submitted',
      message: `${empName} submitted the daily report for "${projName}".`,
    })
  } catch (notifErr) {
    console.error('[ProjectDailyReport] Notification failed:', notifErr)
  }

  return {
    id: data.id,
    project_id: data.project_id,
    template_id: data.template_id,
    employee_id: data.employee_id,
    report_date: data.update_date,
    submitted_at: submissionPayload.submitted_at,
    status: 'SUBMITTED',
    values: input.answers,
    answers: formattedAnswers,
    progress_percent: data.progress_percent,
    created_at: data.created_at,
    updated_at: data.updated_at,
  }
}

/**
 * 4. Get Daily Reports Compliance Summary for a specific Project & Date
 */
export async function getProjectDailyReportsSummary(
  projectId: string,
  date?: string,
): Promise<ProjectDailyReportsSummary> {
  const targetDate = date || new Date().toISOString().split('T')[0]

  // Get project, members, template, and submissions
  const [{ data: project }, { data: members }, template, { data: submissions }] =
    await Promise.all([
      supabaseAdmin.from('projects').select('id, name').eq('id', projectId).single(),
      supabaseAdmin
        .from('project_members')
        .select(`
          user_id,
          user:profiles!project_members_user_id_fkey(
            id,
            first_name,
            last_name,
            email,
            role,
            designation,
            status
          )
        `)
        .eq('project_id', projectId),
      getProjectReportTemplate(projectId),
      supabaseAdmin
        .from('project_daily_updates')
        .select('*')
        .eq('project_id', projectId)
        .eq('update_date', targetDate),
    ])

  const activeMembers = (members || [])
    .map((m: any) => m.user)
    .filter((u: any) => Boolean(u) && u.status !== 'SUSPENDED')

  const submissionMap = new Map<string, any>()
  for (const sub of submissions || []) {
    let parsed: any = {}
    try {
      if (sub.paragraph_update) parsed = JSON.parse(sub.paragraph_update)
    } catch {}
    submissionMap.set(sub.employee_id, {
      ...sub,
      parsed,
    })
  }

  const memberStatuses: MemberReportStatus[] = activeMembers.map((emp: any) => {
    const sub = submissionMap.get(emp.id)
    if (sub) {
      return {
        employee_id: emp.id,
        employee_name: `${emp.first_name} ${emp.last_name || ''}`.trim(),
        email: emp.email,
        role: emp.role,
        status: 'SUBMITTED',
        submitted_at: sub.parsed?.submitted_at || sub.created_at,
        report_id: sub.id,
        values: sub.parsed?.values || {},
        answers: sub.parsed?.answers || [],
      }
    }

    return {
      employee_id: emp.id,
      employee_name: `${emp.first_name} ${emp.last_name || ''}`.trim(),
      email: emp.email,
      role: emp.role,
      status: 'MISSING',
      submitted_at: null,
      report_id: null,
    }
  })

  const totalRequired = activeMembers.length
  const totalSubmitted = memberStatuses.filter((m) => m.status === 'SUBMITTED').length
  const totalMissing = totalRequired - totalSubmitted
  const complianceRate = totalRequired > 0 ? Math.round((totalSubmitted / totalRequired) * 100) : 100

  return {
    project_id: projectId,
    project_name: project?.name || 'Project',
    report_date: targetDate,
    template,
    total_required: totalRequired,
    total_submitted: totalSubmitted,
    total_missing: totalMissing,
    compliance_rate: complianceRate,
    members: memberStatuses,
  }
}

/**
 * 5. Get Daily Report History for a Project
 */
export async function getProjectDailyReportsHistory(
  projectId: string,
  filters?: {
    from?: string
    to?: string
    employee_id?: string
  },
): Promise<ProjectDailyReportSubmission[]> {
  let query = supabaseAdmin
    .from('project_daily_updates')
    .select(`
      id,
      project_id,
      template_id,
      employee_id,
      update_date,
      paragraph_update,
      progress_percent,
      created_at,
      updated_at,
      employee:profiles!project_daily_updates_employee_id_fkey(
        id,
        first_name,
        last_name,
        email,
        designation
      )
    `)
    .eq('project_id', projectId)
    .order('update_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (filters?.from) {
    query = query.gte('update_date', filters.from)
  }
  if (filters?.to) {
    query = query.lte('update_date', filters.to)
  }
  if (filters?.employee_id) {
    query = query.eq('employee_id', filters.employee_id)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return (data || []).map((row: any) => {
    let parsed: any = {}
    try {
      if (row.paragraph_update) parsed = JSON.parse(row.paragraph_update)
    } catch {}

    return {
      id: row.id,
      project_id: row.project_id,
      template_id: row.template_id,
      employee_id: row.employee_id,
      employee: row.employee,
      report_date: row.update_date,
      submitted_at: parsed.submitted_at || row.created_at,
      status: parsed.status || 'SUBMITTED',
      values: parsed.values || {},
      answers: parsed.answers || [],
      progress_percent: row.progress_percent,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }
  })
}

/**
 * 6. Get All Pending Project Daily Reports for an Employee
 */
export async function getEmployeePendingReports(
  organizationId: string,
  employeeId: string,
  date?: string,
) {
  const targetDate = date || new Date().toISOString().split('T')[0]

  // Find all projects where this user is a member
  const { data: memberships, error: memErr } = await supabaseAdmin
    .from('project_members')
    .select('project_id')
    .eq('user_id', employeeId)

  if (memErr) throw new Error(memErr.message)

  const projectIds = (memberships || []).map((m) => m.project_id)
  if (projectIds.length === 0) {
    return []
  }

  // Get project info
  const { data: projects, error: projErr } = await supabaseAdmin
    .from('projects')
    .select('id, name, project_key, status')
    .in('id', projectIds)
    .eq('organization_id', organizationId)
    .neq('status', 'COMPLETED')
    .neq('status', 'ARCHIVED')

  if (projErr) throw new Error(projErr.message)

  // Get active templates for these projects
  const { data: templates } = await supabaseAdmin
    .from('recurring_work_templates')
    .select('project_id, id, description')
    .in('project_id', projectIds)
    .eq('title', TEMPLATE_TITLE_KEY)
    .eq('is_active', true)

  const templateMap = new Map<string, any>()
  for (const t of templates || []) {
    try {
      if (t.description) templateMap.set(t.project_id, { id: t.id, ...JSON.parse(t.description) })
    } catch {}
  }

  // Get existing submissions for targetDate
  const { data: submissions } = await supabaseAdmin
    .from('project_daily_updates')
    .select('id, project_id, created_at, paragraph_update')
    .in('project_id', projectIds)
    .eq('employee_id', employeeId)
    .eq('update_date', targetDate)

  const submissionMap = new Map<string, any>()
  for (const s of submissions || []) {
    submissionMap.set(s.project_id, s)
  }

  return (projects || []).map((proj) => {
    const hasTemplate = templateMap.has(proj.id)
    const template = templateMap.get(proj.id)
    const submission = submissionMap.get(proj.id)

    return {
      project_id: proj.id,
      project_name: proj.name,
      project_key: proj.project_key,
      has_template: hasTemplate,
      template: template || null,
      is_submitted: Boolean(submission),
      submitted_at: submission?.created_at || null,
      submission_id: submission?.id || null,
    }
  })
}

/**
 * 5:45 PM Daily Report Reminder Job
 * Evaluates each organization's timezone and sends a reminder at 5:45 PM (17:45)
 * to users who have not yet submitted their required daily report for today.
 * Deduplicated per user per project per day.
 */
export async function runDailyReportReminderJob(): Promise<{ remindersSent: number }> {
  let remindersSent = 0

  try {
    const { data: orgs, error: orgErr } = await supabaseAdmin
      .from('organizations')
      .select('id, name')

    if (orgErr || !orgs) {
      return { remindersSent }
    }

    for (const org of orgs) {
      try {
        // Fetch organization timezone setting
        const { data: orgSetting } = await supabaseAdmin
          .from('organization_settings')
          .select('timezone')
          .eq('organization_id', org.id)
          .maybeSingle()

        const tz = orgSetting?.timezone || 'Asia/Kolkata'
        const nowInTz = nowInTimezone(tz)
        const todayStr = dateInTimezone(tz)

        // Check if 5:45 PM (17:45) or later in org timezone
        const isReminderTime =
          nowInTz.hour > 17 || (nowInTz.hour === 17 && nowInTz.minute >= 45)

        if (!isReminderTime) {
          continue
        }

        // Find active templates for this organization
        const { data: templates } = await supabaseAdmin
          .from('recurring_work_templates')
          .select('id, project_id')
          .eq('organization_id', org.id)
          .eq('title', TEMPLATE_TITLE_KEY)
          .eq('is_active', true)

        if (!templates || templates.length === 0) {
          continue
        }

        const projectIds = templates.map((t) => t.project_id).filter(Boolean) as string[]
        if (projectIds.length === 0) continue

        // Fetch projects
        const { data: projects } = await supabaseAdmin
          .from('projects')
          .select('id, name, status')
          .in('id', projectIds)
          .neq('status', 'COMPLETED')
          .neq('status', 'ARCHIVED')

        if (!projects || projects.length === 0) continue

        for (const project of projects) {
          // Fetch project members
          const { data: members } = await supabaseAdmin
            .from('project_members')
            .select('user_id')
            .eq('project_id', project.id)

          if (!members || members.length === 0) continue

          // Fetch submissions for today
          const { data: submissions } = await supabaseAdmin
            .from('project_daily_updates')
            .select('employee_id')
            .eq('project_id', project.id)
            .eq('update_date', todayStr)

          const submittedUserIds = new Set((submissions || []).map((s) => s.employee_id))

          for (const member of members) {
            if (submittedUserIds.has(member.user_id)) {
              continue // Already submitted today
            }

            const alertKey = `daily-report-reminder-${member.user_id}-${project.id}-${todayStr}`

            // Check if alert already recorded for today in work_item_deadline_alerts
            const { data: existingAlert } = await supabaseAdmin
              .from('work_item_deadline_alerts')
              .select('id')
              .eq('user_id', member.user_id)
              .eq('alert_key', alertKey)
              .maybeSingle()

            if (existingAlert) {
              continue // Already sent today
            }

            // Record alert
            try {
              await supabaseAdmin
                .from('work_item_deadline_alerts')
                .insert({
                  organization_id: org.id,
                  work_item_id: null,
                  user_id: member.user_id,
                  alert_key: alertKey,
                  alert_type: NotificationType.DAILY_REPORT_REMINDER,
                })
            } catch (insErr) {
              // Ignore unique constraint violation
            }

            // Send notification to pending user ONLY
            await createNotification({
              userId: member.user_id,
              organizationId: org.id,
              type: NotificationType.DAILY_REPORT_REMINDER,
              title: 'Daily Report Reminder',
              message: `Reminder: You have not submitted your daily report for "${project.name}" today. Please submit it before the workday ends.`,
              projectId: project.id,
            })

            remindersSent++
          }
        }
      } catch (orgProcessErr) {
        console.warn(`[DailyReportReminder] Error for org ${org.id}:`, orgProcessErr)
      }
    }
  } catch (err) {
    console.error('[DailyReportReminder] Job error:', err)
  }

  return { remindersSent }
}

