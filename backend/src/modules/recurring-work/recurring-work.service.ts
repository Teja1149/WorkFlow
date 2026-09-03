import { supabaseAdmin } from '../../lib/supabase.js'
import { logActivity } from '../work-activity/work-activity.service.js'
import { notifyStakeholders } from '../notifications/notification.service.js'

type AssignmentMode = 'ALL' | 'SELECTED'

interface RecurringInput {
  title: string
  description?: string | null
  project_id?: string | null
  work_type_id?: string | null
  module_id?: string | null
  milestone_id?: string | null
  priority?: string
  assignment_mode: AssignmentMode
  employee_ids?: string[]
  frequency?: 'DAILY'
  deadline_time?: string | null
  start_date: string
  end_date?: string | null
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

async function resolveEmployees(
  organizationId: string,
  mode: AssignmentMode,
  employeeIds: string[] = [],
) {
  let query = supabaseAdmin
    .from('profiles')
    .select('id, first_name, last_name, role')
    .eq('organization_id', organizationId)

  if (mode === 'ALL') {
    query = query.in('role', ['EMPLOYEE', 'MANAGER'])
  } else {
    query = query.in('id', employeeIds)
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)

  return data || []
}

export async function createRecurringWorkTemplate(
  organizationId: string,
  createdBy: string,
  input: RecurringInput,
) {
  if (!input.title?.trim()) {
    throw new Error('Recurring work title is required.')
  }

  if (!input.start_date) {
    throw new Error('Start date is required.')
  }

  if (!['ALL', 'SELECTED'].includes(input.assignment_mode)) {
    throw new Error('Invalid assignment mode.')
  }

  const employees = await resolveEmployees(
    organizationId,
    input.assignment_mode,
    input.employee_ids || [],
  )

  if (employees.length === 0) {
    throw new Error('No employees were selected for recurring work.')
  }

  const { data, error } = await supabaseAdmin
    .from('recurring_work_templates')
    .insert({
      organization_id: organizationId,
      created_by: createdBy,
      title: input.title.trim(),
      description: input.description || null,
      project_id: input.project_id || null,
      work_type_id: input.work_type_id || null,
      module_id: input.module_id || null,
      milestone_id: input.milestone_id || null,
      priority: input.priority || 'MEDIUM',
      assignment_mode: input.assignment_mode,
      employee_ids: employees.map((employee) => employee.id),
      frequency: 'DAILY',
      deadline_time: input.deadline_time || null,
      is_active: true,
      start_date: input.start_date,
      end_date: input.end_date || null,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  return data
}

export async function listRecurringWorkTemplates(
  organizationId: string,
) {
  const { data, error } = await supabaseAdmin
    .from('recurring_work_templates')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return data || []
}

export async function archiveRecurringWorkTemplate(
  organizationId: string,
  templateId: string,
) {
  const { data, error } = await supabaseAdmin
    .from('recurring_work_templates')
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', templateId)
    .eq('organization_id', organizationId)
    .select()
    .single()

  if (error) throw new Error(error.message)

  return data
}

export async function generateDailyRecurringWork(
  organizationId?: string,
) {
  const date = today()

  let query = supabaseAdmin
    .from('recurring_work_templates')
    .select('*')
    .eq('is_active', true)
    .eq('frequency', 'DAILY')
    .lte('start_date', date)
    .or(`end_date.is.null,end_date.gte.${date}`)

  if (organizationId) {
    query = query.eq('organization_id', organizationId)
  }

  const { data: templates, error } = await query

  if (error) throw new Error(error.message)

  const generated: string[] = []
  const warnings: string[] = []
  let skippedCount = 0
  let failedCount = 0

  for (const template of templates || []) {
    // 1. Validate template.project_id if present
    if (template.project_id) {
      const { data: project, error: projectError } = await supabaseAdmin
        .from('projects')
        .select('id')
        .eq('id', template.project_id)
        .eq('organization_id', template.organization_id)
        .maybeSingle()

      if (projectError) {
        const msg = `Could not validate project for template "${template.title}" (${template.id}): ${projectError.message}`
        console.error(`[RecurringWork] ${msg}`)
        warnings.push(msg)
        skippedCount++
        continue
      }

      if (!project) {
        const msg = `Skipping template "${template.title}" (${template.id}): project ${template.project_id} does not exist or belongs to another organization.`
        console.warn(`[RecurringWork] ${msg}`)
        warnings.push(msg)
        skippedCount++
        continue
      }
    }

    const employees = await resolveEmployees(
      template.organization_id,
      template.assignment_mode,
      template.employee_ids || [],
    )

    let templateGeneratedCount = 0

    for (const employee of employees) {
      try {
        const { data: existing, error: existingError } =
          await supabaseAdmin
            .from('work_items')
            .select('id')
            .eq('organization_id', template.organization_id)
            .eq('recurring_template_id', template.id)
            .eq('assigned_to', employee.id)
            .eq('deadline', date)
            .maybeSingle()

        if (existingError) {
          console.error(
            `[RecurringWork] Error checking existing work item for employee ${employee.id}:`,
            existingError.message,
          )
          failedCount++
          warnings.push(`Error checking existing work for employee ${employee.id}: ${existingError.message}`)
          continue
        }

        if (existing) continue

        const { data: work, error: workError } =
          await supabaseAdmin
            .from('work_items')
            .insert({
              organization_id: template.organization_id,
              project_id: template.project_id,
              assigned_to: employee.id,
              created_by: template.created_by,
              title: template.title,
              description: template.description,
              priority: template.priority || 'MEDIUM',
              status: 'TODO',
              deadline: date,
              deadline_time: template.deadline_time,
              original_deadline: date,
              work_type_id: template.work_type_id,
              module_id: template.module_id,
              milestone_id: template.milestone_id,
              recurring_template_id: template.id,
              progress_percent: 0,
              estimated_hours: 0,
              actual_hours: 0,
              carry_forward_count: 0,
              escalation_level: 0,
              health: 'GREEN',
            })
            .select()
            .single()

        if (workError) {
          console.error(
            `[RecurringWork] Failed to insert work item for template "${template.title}", employee ${employee.id}:`,
            workError.message,
          )
          failedCount++
          warnings.push(`Failed to insert work item for employee ${employee.id}: ${workError.message}`)
          continue
        }

        // 2. Resolve Work Type & Allocation target values
        let resolvedTargetType = 'COUNT'
        let resolvedTargetValue = 1
        let resolvedUnit = 'Units'

        if (template.work_type_id) {
          const { data: wt } = await supabaseAdmin
            .from('work_types')
            .select('description')
            .eq('id', template.work_type_id)
            .maybeSingle()

          if (wt?.description && wt.description.trim().startsWith('{')) {
            try {
              const parsed = JSON.parse(wt.description)
              if (parsed.unit) resolvedUnit = parsed.unit
              if (parsed.measurement) {
                if (parsed.measurement === 'STORY_POINTS') resolvedTargetType = 'POINTS'
                else if (parsed.measurement === 'HOURS') resolvedTargetType = 'HOURS'
                else if (parsed.measurement === 'PERCENTAGE') resolvedTargetType = 'PERCENTAGE'
                else resolvedTargetType = 'COUNT'
              }
              if (parsed.default_target) resolvedTargetValue = Number(parsed.default_target)
            } catch {
              // ignore JSON parse error
            }
          }
        }

        // 3. Schema-aligned target-allocation lookup (project_targets -> project_target_allocations)
        if (template.project_id) {
          let targetQuery = supabaseAdmin
            .from('project_targets')
            .select('id, unit, target_type')
            .eq('project_id', template.project_id)

          if (template.work_type_id) {
            targetQuery = targetQuery.eq('work_type_id', template.work_type_id)
          }

          const { data: projTargets } = await targetQuery

          if (projTargets && projTargets.length > 0) {
            const targetIds = projTargets.map((t) => t.id)
            const { data: alloc } = await supabaseAdmin
              .from('project_target_allocations')
              .select('allocated_value, target_id')
              .in('target_id', targetIds)
              .eq('employee_id', employee.id)
              .maybeSingle()

            if (alloc) {
              const matchedTarget = projTargets.find((t) => t.id === alloc.target_id) || projTargets[0]
              if (matchedTarget?.unit) resolvedUnit = matchedTarget.unit
              if (matchedTarget?.target_type) resolvedTargetType = matchedTarget.target_type
              if (alloc.allocated_value) {
                resolvedTargetValue = Math.max(1, Math.ceil(Number(alloc.allocated_value) / 20))
              }
            } else {
              const pt = projTargets[0]
              if (pt.unit) resolvedUnit = pt.unit
              if (pt.target_type) resolvedTargetType = pt.target_type
            }
          }
        }

        // 4. Create today's daily target for the generated recurring work
        const { error: targetError } = await supabaseAdmin
          .from('daily_work_targets')
          .insert({
            organization_id: template.organization_id,
            employee_id: employee.id,
            project_id: template.project_id,
            module_id: template.module_id,
            milestone_id: template.milestone_id,
            work_item_id: work.id,

            title: template.title,
            target_type: resolvedTargetType,
            target_value: resolvedTargetValue,
            unit: resolvedUnit,

            deadline_date: date,
            deadline_time: template.deadline_time,
            priority: template.priority || 'MEDIUM',

            status: 'OPEN',
            actual_value: 0,
            carry_forward_value: 0,
            carry_forward_count: 0,

            created_by: template.created_by,
          })

        if (targetError) {
          console.error(
            `[RecurringWork] Failed to insert daily target for work ${work.id}:`,
            targetError.message,
          )
          warnings.push(`Failed to insert daily target for work ${work.id}: ${targetError.message}`)
        }

        await supabaseAdmin
          .from('work_assignment_history')
          .insert({
            work_item_id: work.id,
            organization_id: template.organization_id,
            previous_assignee: null,
            new_assignee: employee.id,
            changed_by: template.created_by,
            reason: `Daily recurring work: ${template.title}`,
          })

        await logActivity(
          work.id,
          template.created_by,
          'WORK_ASSIGNED',
          `Daily recurring work generated: ${template.title}`,
        )

        try {
          await notifyStakeholders({
            organizationId: template.organization_id,
            title: 'Daily Work Assigned',
            message: `"${template.title}" has been assigned to you for today.`,
            type: 'WORK_ASSIGNED',
            workItemId: work.id,
            projectId: template.project_id,
            authorUserId: template.created_by,
            recipients: [employee.id],
          })
        } catch {
          // Notification failure must not prevent generation.
        }

        generated.push(work.id)
        templateGeneratedCount++
      } catch (empErr: any) {
        console.error(
          `[RecurringWork] Unexpected error generating work for employee ${employee.id}:`,
          empErr,
        )
        failedCount++
        warnings.push(`Unexpected error for employee ${employee.id}: ${empErr?.message || empErr}`)
      }
    }

    if (templateGeneratedCount > 0) {
      await supabaseAdmin
        .from('recurring_work_templates')
        .update({
          last_generated_date: date,
          updated_at: new Date().toISOString(),
        })
        .eq('id', template.id)
    }
  }

  return {
    date,
    generatedCount: generated.length,
    skippedCount,
    failedCount,
    workItemIds: generated,
    warnings,
  }
}
