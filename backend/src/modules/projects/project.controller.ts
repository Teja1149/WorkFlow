import type { Request, Response } from 'express'
import {
  getProjects,
  createProject,
  getProjectMembers,
  addProjectMember,
  removeProjectMember,
} from './project.service.js'

export async function listProjects(req: Request, res: Response) {
  try {
    const organizationId = req.profile?.organization_id

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Organization not found.',
      })
    }

    const projects = await getProjects(
      organizationId,
      req.userId!,
      req.profile!.role,
    )

    return res.json({
      success: true,
      data: projects,
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Unable to load projects.',
    })
  }
}

export async function addProject(req: Request, res: Response) {
  try {
    const organizationId = req.profile?.organization_id
    const createdBy = req.userId

    if (!organizationId || !createdBy) {
      return res.status(400).json({
        success: false,
        message: 'User organization not found.',
      })
    }

    const project = await createProject(
      organizationId,
      createdBy,
      req.body,
    )

    return res.status(201).json({
      success: true,
      data: project,
    })
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Unable to create project.',
    })
  }
}

export async function listProjectMembers(req: Request, res: Response) {
  try {
    const projectId = req.params.id as string
    const members = await getProjectMembers(projectId)
    return res.json({
      success: true,
      data: members,
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Unable to load project members.',
    })
  }
}

export async function addMemberToProject(req: Request, res: Response) {
  try {
    const projectId = req.params.id as string
    const { user_id } = req.body
    const assignedBy = req.userId!

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required.',
      })
    }

    const member = await addProjectMember(projectId, user_id, assignedBy)
    return res.status(201).json({
      success: true,
      data: member,
    })
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Unable to add member.',
    })
  }
}

export async function removeMemberFromProject(req: Request, res: Response) {
  try {
    const projectId = req.params.id as string
    const userId = req.params.userId as string

    await removeProjectMember(projectId, userId)
    return res.json({
      success: true,
      message: 'Member removed.',
    })
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Unable to remove member.',
    })
  }
}
