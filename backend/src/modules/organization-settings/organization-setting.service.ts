import { supabaseAdmin } from '../../lib/supabase.js'
import type {
  OrganizationWorkSettings,
  UpdateOrganizationWorkSettingsInput,
} from './organization-setting.types.js'

const DEFAULTS = {
  timezone: 'Asia/Kolkata',
  workday_start: '09:00',
  workday_end: '18:00',
  working_days: [1, 2, 3, 4, 5],
  carry_forward_time: '18:00',
  warning_minutes: 120,
  at_risk_minutes: 60,
  critical_carry_forward_count: 2,
}

export async function getOrganizationWorkSettings(
  organizationId: string,
) {
  const { data, error } = await supabaseAdmin
    .from('organization_work_settings')
    .select('*')
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (data) {
    return data as OrganizationWorkSettings
  }

  const { data: created, error: createError } =
    await supabaseAdmin
      .from('organization_work_settings')
      .insert({
        organization_id: organizationId,
        ...DEFAULTS,
      })
      .select()
      .single()

  if (createError) {
    throw new Error(createError.message)
  }

  return created as OrganizationWorkSettings
}

export async function updateOrganizationWorkSettings(
  organizationId: string,
  input: UpdateOrganizationWorkSettingsInput,
) {
  if (
    input.working_days &&
    (
      input.working_days.length === 0 ||
      input.working_days.some(
        (day) => day < 1 || day > 7,
      )
    )
  ) {
    throw new Error('Working days are invalid.')
  }

  if (
    input.warning_minutes !== undefined &&
    input.warning_minutes <= 0
  ) {
    throw new Error(
      'Warning threshold must be greater than zero.',
    )
  }

  if (
    input.at_risk_minutes !== undefined &&
    input.at_risk_minutes <= 0
  ) {
    throw new Error(
      'At-risk threshold must be greater than zero.',
    )
  }

  if (
    input.critical_carry_forward_count !== undefined &&
    input.critical_carry_forward_count < 1
  ) {
    throw new Error(
      'Critical carry-forward count must be at least 1.',
    )
  }

  const { data, error } = await supabaseAdmin
    .from('organization_work_settings')
    .upsert(
      {
        organization_id: organizationId,
        ...input,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'organization_id',
      },
    )
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data as OrganizationWorkSettings
}
