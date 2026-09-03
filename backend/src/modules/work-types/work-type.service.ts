import { supabaseAdmin } from '../../lib/supabase.js'
import type {
  CreateWorkTypeInput,
  UpdateWorkTypeInput,
} from './work-type.types.js'

function cleanName(value?: string) {
  return value?.trim() || ''
}

function unpackWorkType(record: any): any {
  if (!record) return record
  let parsedConfig: any = null
  let cleanDescription = record.description

  if (
    record.description &&
    typeof record.description === 'string' &&
    record.description.trim().startsWith('{')
  ) {
    try {
      parsedConfig = JSON.parse(record.description)
      cleanDescription =
        parsedConfig.summary !== undefined
          ? parsedConfig.summary
          : record.description
    } catch {
      // fallback to raw
    }
  }

  return {
    ...record,
    description: cleanDescription,
    code: parsedConfig?.code || null,
    measurement: parsedConfig?.measurement || 'COUNT',
    unit: parsedConfig?.unit || 'tasks',
    default_target:
      parsedConfig?.default_target != null
        ? Number(parsedConfig.default_target)
        : null,
    default_period: parsedConfig?.default_period || 'DAILY',
    daily_target:
      parsedConfig?.daily_target != null
        ? Number(parsedConfig.daily_target)
        : null,
    completion_rule: parsedConfig?.completion_rule || 'TARGET_REACHED',
    report_fields: Array.isArray(parsedConfig?.report_fields)
      ? parsedConfig.report_fields
      : [],
    fields: Array.isArray(parsedConfig?.fields)
      ? parsedConfig.fields
      : (Array.isArray(parsedConfig?.report_fields) ? parsedConfig.report_fields : []),
  }
}

function packDescription(
  inputDesc: string | null | undefined,
  config: {
    code?: string | null
    measurement?: string | null
    unit?: string | null
    default_target?: number | null
    default_period?: string | null
    daily_target?: number | null
    completion_rule?: string | null
    report_fields?: any[] | null
    fields?: any[] | null
  },
  existingRawDesc?: string | null,
): string | null {
  let prevConfig: any = {}
  if (
    existingRawDesc &&
    typeof existingRawDesc === 'string' &&
    existingRawDesc.trim().startsWith('{')
  ) {
    try {
      prevConfig = JSON.parse(existingRawDesc)
    } catch {
      // ignore
    }
  }

  const hasRichConfig =
    config.code !== undefined ||
    config.measurement !== undefined ||
    config.unit !== undefined ||
    config.default_target !== undefined ||
    config.default_period !== undefined ||
    config.daily_target !== undefined ||
    config.completion_rule !== undefined ||
    config.report_fields !== undefined ||
    config.fields !== undefined ||
    Object.keys(prevConfig).length > 0

  if (!hasRichConfig) {
    return inputDesc?.trim() || null
  }

  const activeFields = config.fields || config.report_fields || prevConfig.fields || prevConfig.report_fields || []

  const merged = {
    ...prevConfig,
    summary:
      inputDesc !== undefined
        ? inputDesc?.trim() || null
        : prevConfig.summary ?? existingRawDesc ?? null,
    code:
      config.code !== undefined
        ? config.code?.trim() || null
        : prevConfig.code || null,
    measurement:
      config.measurement !== undefined
        ? config.measurement
        : prevConfig.measurement || 'COUNT',
    unit:
      config.unit !== undefined
        ? config.unit?.trim() || 'tasks'
        : prevConfig.unit || 'tasks',
    default_target:
      config.default_target !== undefined
        ? config.default_target
        : prevConfig.default_target ?? null,
    default_period:
      config.default_period !== undefined
        ? config.default_period
        : prevConfig.default_period || 'DAILY',
    daily_target:
      config.daily_target !== undefined
        ? config.daily_target
        : prevConfig.daily_target ?? null,
    completion_rule:
      config.completion_rule !== undefined
        ? config.completion_rule
        : prevConfig.completion_rule || 'TARGET_REACHED',
    report_fields: activeFields,
    fields: activeFields,
  }

  return JSON.stringify(merged)
}

export async function getWorkTypes(organizationId: string) {
  const { data, error } = await supabaseAdmin
    .from('work_types')
    .select('*')
    .eq('organization_id', organizationId)
    .order('name', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data || []).map(unpackWorkType)
}

export async function createWorkType(
  organizationId: string,
  createdBy: string,
  input: CreateWorkTypeInput,
) {
  const name = cleanName(input.name)

  if (!name) {
    throw new Error('Work type name is required.')
  }

  const { data: existing, error: existingError } =
    await supabaseAdmin
      .from('work_types')
      .select('id')
      .eq('organization_id', organizationId)
      .ilike('name', name)
      .maybeSingle()

  if (existingError) {
    throw new Error(existingError.message)
  }

  if (existing) {
    throw new Error('A work type with this name already exists.')
  }

  const packedDesc = packDescription(input.description, {
    code: input.code,
    measurement: input.measurement,
    unit: input.unit,
    default_target: input.default_target,
    default_period: input.default_period,
    daily_target: input.daily_target,
    report_fields: input.report_fields,
  })

  const { data, error } = await supabaseAdmin
    .from('work_types')
    .insert({
      organization_id: organizationId,
      name,
      description: packedDesc,
      icon: input.icon?.trim() || null,
      color: input.color?.trim() || null,
      is_active: true,
      created_by: createdBy,
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return unpackWorkType(data)
}

export async function updateWorkType(
  organizationId: string,
  workTypeId: string,
  input: UpdateWorkTypeInput,
) {
  const { data: existing, error: existingError } =
    await supabaseAdmin
      .from('work_types')
      .select('*')
      .eq('id', workTypeId)
      .eq('organization_id', organizationId)
      .maybeSingle()

  if (existingError) {
    throw new Error(existingError.message)
  }

  if (!existing) {
    throw new Error('Work type not found.')
  }

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (input.name !== undefined) {
    const name = cleanName(input.name)

    if (!name) {
      throw new Error('Work type name cannot be empty.')
    }

    payload.name = name
  }

  const hasConfigChanges =
    input.description !== undefined ||
    input.code !== undefined ||
    input.measurement !== undefined ||
    input.unit !== undefined ||
    input.default_target !== undefined ||
    input.default_period !== undefined ||
    input.daily_target !== undefined ||
    input.report_fields !== undefined

  if (hasConfigChanges) {
    payload.description = packDescription(
      input.description,
      {
        code: input.code,
        measurement: input.measurement,
        unit: input.unit,
        default_target: input.default_target,
        default_period: input.default_period,
        daily_target: input.daily_target,
        report_fields: input.report_fields,
      },
      existing.description,
    )
  }

  if (input.icon !== undefined) {
    payload.icon = input.icon?.trim() || null
  }

  if (input.color !== undefined) {
    payload.color = input.color?.trim() || null
  }

  if (input.is_active !== undefined) {
    payload.is_active = input.is_active
  }

  const { data, error } = await supabaseAdmin
    .from('work_types')
    .update(payload)
    .eq('id', workTypeId)
    .eq('organization_id', organizationId)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return unpackWorkType(data)
}

export async function archiveWorkType(
  organizationId: string,
  workTypeId: string,
) {
  const { data, error } = await supabaseAdmin
    .from('work_types')
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', workTypeId)
    .eq('organization_id', organizationId)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    throw new Error('Work type not found.')
  }

  return data
}

export async function deleteWorkType(
  organizationId: string,
  workTypeId: string,
) {
  const { count, error: countError } = await supabaseAdmin
    .from('work_items')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('work_type_id', workTypeId)

  if (countError) {
    throw new Error(countError.message)
  }

  if ((count || 0) > 0) {
    throw new Error(
      'This work type is already used by work items. Archive it instead of deleting it.',
    )
  }

  const { error } = await supabaseAdmin
    .from('work_types')
    .delete()
    .eq('id', workTypeId)
    .eq('organization_id', organizationId)

  if (error) {
    throw new Error(error.message)
  }

  return { success: true }
}
