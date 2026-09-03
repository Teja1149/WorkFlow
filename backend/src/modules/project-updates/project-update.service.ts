import { supabaseAdmin } from '../../lib/supabase.js'
import { notifyStakeholders } from '../notifications/notification.service.js'

export interface ProjectUpdateFieldInput {
  field_name: string
  field_key: string
  field_type:
    | 'text'
    | 'number'
    | 'paragraph'
    | 'boolean'
    | 'date'
  is_required?: boolean
  display_order?: number
}

export interface SubmitDailyUpdateInput {
  paragraphUpdate?: string
  progressPercent?: number
  values?: Record<string, any>
}

export interface DailyUpdateFilters {
  employeeId?: string
  fromDate?: string
  toDate?: string
}

export interface DailyUpdateViewer {
  userId: string
  role?: string
}

export async function createProjectUpdateTemplate(
  projectId: string,
  input?: {
    title?: string
    description?: string
    createdBy?: string
  },
) {
  if (!input?.createdBy) {
    throw new Error('Authenticated user is required.')
  }

  const { data: existing, error: existingError } =
    await supabaseAdmin
      .from('project_update_templates')
      .select('*')
      .eq('project_id', projectId)
      .maybeSingle()

  if (existingError) {
    throw new Error(existingError.message)
  }

  if (existing) {
    return existing
  }

  const { data, error } = await supabaseAdmin
    .from('project_update_templates')
    .insert({
      project_id: projectId,
      created_by: input.createdBy,
      name:
        input.title ||
        'Daily Work Report Template',
      description:
        input.description ||
        'Custom daily report fields',
      is_active: true,
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function addFieldsToTemplate(
  templateId: string,
  fields: ProjectUpdateFieldInput[],
) {
  if (!fields || fields.length === 0) {
    return []
  }

  // 1. Deduplicate incoming fields by field_key
  const uniqueInputFields: ProjectUpdateFieldInput[] = []
  const seenInputKeys = new Set<string>()
  for (const f of fields) {
    const key =
      f.field_key ||
      f.field_name.toLowerCase().trim().replace(/\s+/g, '_')
    if (key && !seenInputKeys.has(key)) {
      seenInputKeys.add(key)
      uniqueInputFields.push({
        ...f,
        field_key: key,
      })
    }
  }

  // 2. Try clearing all existing fields for this template to ensure a clean list
  const { error: clearErr } = await supabaseAdmin
    .from('project_update_fields')
    .delete()
    .eq('template_id', templateId)

  if (!clearErr) {
    const payload = uniqueInputFields.map((f, idx) => ({
      template_id: templateId,
      field_name: f.field_name.trim(),
      field_key: f.field_key,
      field_type: f.field_type || 'text',
      is_required: f.is_required ?? false,
      display_order: f.display_order ?? idx + 1,
    }))

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('project_update_fields')
      .insert(payload)
      .select()

    if (insertErr) {
      throw new Error(insertErr.message)
    }

    return inserted || []
  }

  // 3. Fallback if FK constraints prevent deletion: cleanup duplicates and update/insert
  const { data: existingFields } = await supabaseAdmin
    .from('project_update_fields')
    .select('*')
    .eq('template_id', templateId)

  const seenMap = new Map<string, string>()
  const duplicateIdsToDelete: string[] = []

  for (const ef of existingFields || []) {
    if (seenMap.has(ef.field_key)) {
      duplicateIdsToDelete.push(ef.id)
    } else {
      seenMap.set(ef.field_key, ef.id)
    }
  }

  if (duplicateIdsToDelete.length > 0) {
    await supabaseAdmin
      .from('project_update_fields')
      .delete()
      .in('id', duplicateIdsToDelete)
  }

  const results = []
  for (let idx = 0; idx < uniqueInputFields.length; idx++) {
    const f = uniqueInputFields[idx]
    const existingId = seenMap.get(f.field_key)

    const payload = {
      template_id: templateId,
      field_name: f.field_name.trim(),
      field_key: f.field_key,
      field_type: f.field_type || 'text',
      is_required: f.is_required ?? false,
      display_order: f.display_order ?? idx + 1,
    }

    if (existingId) {
      const { data: updated } = await supabaseAdmin
        .from('project_update_fields')
        .update(payload)
        .eq('id', existingId)
        .select()
        .single()
      if (updated) results.push(updated)
    } else {
      const { data: inserted } = await supabaseAdmin
        .from('project_update_fields')
        .insert(payload)
        .select()
        .single()
      if (inserted) results.push(inserted)
    }
  }

  return results
}

export async function getProjectUpdateTemplate(projectId: string) {
  const { data: template, error: templateError } = await supabaseAdmin
    .from('project_update_templates')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle()

  if (templateError) {
    throw new Error(templateError.message)
  }

  if (!template) {
    return null
  }

  const { data: rawFields, error: fieldsError } = await supabaseAdmin
    .from('project_update_fields')
    .select('*')
    .eq('template_id', template.id)
    .order('display_order', { ascending: true })

  if (fieldsError) {
    throw new Error(fieldsError.message)
  }

  // Deduplicate fields by field_key so duplicate rows are eliminated
  const fields = []
  const seenKeys = new Set<string>()
  for (const f of rawFields || []) {
    const key =
      f.field_key ||
      f.field_name.toLowerCase().trim().replace(/\s+/g, '_')
    if (key && !seenKeys.has(key)) {
      seenKeys.add(key)
      fields.push(f)
    }
  }

  return {
    ...template,
    fields,
  }
}

export async function submitProjectDailyUpdate(
  projectId: string,
  employeeId: string,
  input: SubmitDailyUpdateInput,
) {
  const todayStr = new Date().toISOString().split('T')[0]

  // Check if an update for today already exists for this employee & project
  const { data: existingRecord } = await supabaseAdmin
    .from('project_daily_updates')
    .select('id, created_at')
    .eq('project_id', projectId)
    .eq('employee_id', employeeId)
    .eq('update_date', todayStr)
    .maybeSingle()

  let updateRecord: any

  if (existingRecord) {
    // Update existing daily update for today whenever submitted
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('project_daily_updates')
      .update({
        paragraph_update: input.paragraphUpdate || '',
        progress_percent: input.progressPercent ?? 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingRecord.id)
      .select()
      .single()

    if (updateErr) {
      throw new Error(updateErr.message)
    }
    updateRecord = updated
  } else {
    // Insert new daily update for today
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('project_daily_updates')
      .insert({
        project_id: projectId,
        employee_id: employeeId,
        update_date: todayStr,
        paragraph_update: input.paragraphUpdate || '',
        progress_percent: input.progressPercent ?? 0,
      })
      .select()
      .single()

    if (insertError) {
      throw new Error(insertError.message)
    }
    updateRecord = inserted
  }

  // Update dynamic metric field values
  if (input.values && Object.keys(input.values).length > 0) {
    // Remove previous field values for today's record before inserting updated ones
    await supabaseAdmin
      .from('project_daily_update_values')
      .delete()
      .eq('daily_update_id', updateRecord.id)

    // Resolve all field keys/names/IDs to actual project_update_fields IDs
    const { data: templateFields } = await supabaseAdmin
      .from('project_update_fields')
      .select('id, field_key, field_name')
      .eq('project_id', projectId)

    const resolvedValues = new Map<string, string>()

    for (const [key, val] of Object.entries(input.values)) {
      if (val === undefined || val === null || String(val).trim() === '') continue

      // Match key against field.id, field.field_key, or field.field_name
      const matchedField = (templateFields || []).find(
        (f) =>
          f.id === key ||
          f.field_key === key ||
          f.field_name?.toLowerCase().trim() === key.toLowerCase().trim(),
      )

      const targetFieldId = matchedField ? matchedField.id : key
      resolvedValues.set(targetFieldId, String(val))
    }

    const valuePayloads = Array.from(resolvedValues.entries()).map(
      ([fieldId, valueText]) => ({
        daily_update_id: updateRecord.id,
        field_id: fieldId,
        value_text: valueText,
      }),
    )

    if (valuePayloads.length > 0) {
      const { error: valuesError } = await supabaseAdmin
        .from('project_daily_update_values')
        .insert(valuePayloads)

      if (valuesError) {
        console.error('Error inserting project daily update values:', valuesError)
      }
    }
  }

  // Send real-time notification to Managers & Admins
  try {
    const [{ data: proj }, { data: emp }] = await Promise.all([
      supabaseAdmin
        .from('projects')
        .select('name, organization_id, project_manager_id')
        .eq('id', projectId)
        .single(),
      supabaseAdmin
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', employeeId)
        .single(),
    ])

    if (proj?.organization_id) {
      const empName = emp ? `${emp.first_name} ${emp.last_name || ''}`.trim() : 'An employee'
      const projName = proj.name || 'Project'

      await notifyStakeholders({
        organizationId: proj.organization_id,
        title: 'Daily Report Submitted',
        message: `${empName} submitted daily update for "${projName}" (${input.progressPercent ?? 0}% progress).`,
        type: 'WORK_UPDATED',
        projectId,
        authorUserId: employeeId,
        recipients: [proj.project_manager_id],
      })
    }
  } catch (notifErr) {
    console.error('Failed to dispatch daily update notification:', notifErr)
  }

  return updateRecord
}

export async function getProjectDailyUpdates(
  projectId: string,
  filters: DailyUpdateFilters = {},
  viewer: DailyUpdateViewer,
) {
  const normalizedRole = String(viewer.role || '')
    .toUpperCase()

  const canViewAll =
    normalizedRole === 'MANAGER' ||
    normalizedRole === 'ADMIN' ||
    normalizedRole === 'SUPER_ADMIN'

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
      profiles:employee_id (
        id,
        first_name,
        last_name,
        email,
        employee_id
      ),
      project_daily_update_values (
        id,
        daily_update_id,
        field_id,
        value_text,
        project_update_fields (
          field_name,
          field_key,
          field_type,
          display_order
        )
      )
    `)
    .eq('project_id', projectId)
    .order('update_date', {
      ascending: false,
    })
    .order('created_at', {
      ascending: false,
    })

  /*
   * SECURITY RULE
   *
   * Employee:
   *   ALWAYS see only their own updates.
   *
   * Manager/Admin:
   *   Can see all updates.
   */

  if (!canViewAll) {
    query = query.eq(
      'employee_id',
      viewer.userId,
    )
  } else if (filters.employeeId) {
    query = query.eq(
      'employee_id',
      filters.employeeId,
    )
  }

  if (filters.fromDate) {
    query = query.gte(
      'update_date',
      filters.fromDate,
    )
  }

  if (filters.toDate) {
    query = query.lte(
      'update_date',
      filters.toDate,
    )
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  const mapped = (data || []).map((item: any) => ({
    ...item,
    values: item.values || item.project_daily_update_values || [],
  }))

  return mapped
}

export interface SubmitTeamUpdateInput {
  updateDate?: string
  paragraphUpdate?: string
  progressPercent?: number
  values?: Record<string, any>
}

export async function submitProjectTeamUpdate(
  projectId: string,
  organizationId: string,
  submittedBy: string,
  input: SubmitTeamUpdateInput,
) {
  const updateDate =
    input.updateDate ||
    new Date().toISOString().slice(0, 10)

  const progressPercent = Math.max(
    0,
    Math.min(100, Number(input.progressPercent ?? 0)),
  )

  const { data: existing, error: existingError } =
    await supabaseAdmin
      .from('project_team_updates')
      .select('*')
      .eq('project_id', projectId)
      .eq('update_date', updateDate)
      .maybeSingle()

  if (existingError) {
    throw new Error(existingError.message)
  }

  let teamUpdate: any

  if (existing) {
    const { data, error } = await supabaseAdmin
      .from('project_team_updates')
      .update({
        submitted_by: submittedBy,
        paragraph_update: input.paragraphUpdate || null,
        progress_percent: progressPercent,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single()

    if (error) {
      throw new Error(error.message)
    }

    teamUpdate = data
  } else {
    const { data, error } = await supabaseAdmin
      .from('project_team_updates')
      .insert({
        project_id: projectId,
        organization_id: organizationId,
        update_date: updateDate,
        submitted_by: submittedBy,
        paragraph_update: input.paragraphUpdate || null,
        progress_percent: progressPercent,
      })
      .select()
      .single()

    if (error) {
      throw new Error(error.message)
    }

    teamUpdate = data
  }

  return teamUpdate
}

export async function getProjectTeamUpdates(
  projectId: string,
  filters?: {
    fromDate?: string
    toDate?: string
  },
) {
  let query = supabaseAdmin
    .from('project_team_updates')
    .select(`
      *,
      profiles:submitted_by (
        id,
        first_name,
        last_name,
        email,
        employee_id
      )
    `)
    .eq('project_id', projectId)
    .order('update_date', {
      ascending: false,
    })

  if (filters?.fromDate) {
    query = query.gte(
      'update_date',
      filters.fromDate,
    )
  }

  if (filters?.toDate) {
    query = query.lte(
      'update_date',
      filters.toDate,
    )
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return data || []
}

