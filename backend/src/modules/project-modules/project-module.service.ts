import { supabaseAdmin } from '../../lib/supabase.js'
import type {
  CreateProjectModuleInput,
  UpdateProjectModuleInput,
} from './project-module.types.js'

export async function getProjectModules(
  organizationId: string,
  projectId: string,
) {
  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('id, organization_id')
    .eq('id', projectId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (!project) {
    throw new Error('Project not found.')
  }

  const { data, error } = await supabaseAdmin
    .from('project_modules')
    .select(`
      *,
      work_types (
        id,
        name,
        color,
        icon,
        is_active
      )
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return data || []
}

export async function createProjectModule(
  organizationId: string,
  createdBy: string,
  input: CreateProjectModuleInput,
) {
  if (!input.name?.trim()) {
    throw new Error('Module name is required.')
  }

  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('id, organization_id')
    .eq('id', input.project_id)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (!project) {
    throw new Error('Project not found.')
  }

  if (input.work_type_id) {
    const { data: workType } = await supabaseAdmin
      .from('work_types')
      .select('id, is_active')
      .eq('id', input.work_type_id)
      .eq('organization_id', organizationId)
      .maybeSingle()

    if (!workType) {
      throw new Error('Work type not found.')
    }

    if (!workType.is_active) {
      throw new Error('Selected work type is archived.')
    }
  }

  const { data, error } = await supabaseAdmin
    .from('project_modules')
    .insert({
      project_id: input.project_id,
      work_type_id: input.work_type_id || null,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      is_active: true,
      created_by: createdBy,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error('A module with this name already exists in the project.')
    }

    throw new Error(error.message)
  }

  return data
}

export async function updateProjectModule(
  organizationId: string,
  moduleId: string,
  input: UpdateProjectModuleInput,
) {
  const { data: existing } = await supabaseAdmin
    .from('project_modules')
    .select(`
      id,
      project_id,
      projects!inner (
        organization_id
      )
    `)
    .eq('id', moduleId)
    .eq('projects.organization_id', organizationId)
    .maybeSingle()

  if (!existing) {
    throw new Error('Module not found.')
  }

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (input.name !== undefined) {
    if (!input.name.trim()) {
      throw new Error('Module name cannot be empty.')
    }

    payload.name = input.name.trim()
  }

  if (input.description !== undefined) {
    payload.description = input.description?.trim() || null
  }

  if (input.work_type_id !== undefined) {
    payload.work_type_id = input.work_type_id || null
  }

  if (input.is_active !== undefined) {
    payload.is_active = input.is_active
  }

  const { data, error } = await supabaseAdmin
    .from('project_modules')
    .update(payload)
    .eq('id', moduleId)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function deleteProjectModule(
  organizationId: string,
  moduleId: string,
) {
  const { data: module } = await supabaseAdmin
    .from('project_modules')
    .select(`
      id,
      project_id,
      projects!inner (
        organization_id
      )
    `)
    .eq('id', moduleId)
    .eq('projects.organization_id', organizationId)
    .maybeSingle()

  if (!module) {
    throw new Error('Module not found.')
  }

  const { count, error: countError } = await supabaseAdmin
    .from('work_items')
    .select('id', {
      count: 'exact',
      head: true,
    })
    .eq('module_id', moduleId)

  if (countError) {
    throw new Error(countError.message)
  }

  if ((count || 0) > 0) {
    throw new Error(
      'This module contains work items. Archive it instead of deleting it.',
    )
  }

  const { error } = await supabaseAdmin
    .from('project_modules')
    .delete()
    .eq('id', moduleId)

  if (error) {
    throw new Error(error.message)
  }

  return { success: true }
}
