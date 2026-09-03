import type { Request, Response } from 'express'
import {
  createProjectMilestone,
  deleteProjectMilestone,
  getProjectMilestones,
  updateProjectMilestone,
} from './project-milestone.service.js'

function organizationId(req: Request) {
  return req.profile?.organization_id || null
}

function userId(req: Request) {
  return req.userId || null
}

function canManage(req: Request) {
  return (
    req.profile?.role === 'SUPER_ADMIN' ||
    req.profile?.role === 'ADMIN' ||
    req.profile?.role === 'MANAGER'
  )
}

export async function getProjectMilestonesController(
  req: Request,
  res: Response,
) {
  try {
    const orgId = organizationId(req)

    if (!orgId) {
      return res.status(401).json({
        success: false,
        message: 'Organization context is missing.',
      })
    }

    const data = await getProjectMilestones(
      orgId,
      req.params.projectId as string,
    )

    return res.json({
      success: true,
      data,
    })
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message,
    })
  }
}

export async function createProjectMilestoneController(
  req: Request,
  res: Response,
) {
  try {
    if (!canManage(req)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to manage milestones.',
      })
    }

    const orgId = organizationId(req)
    const createdBy = userId(req)

    if (!orgId || !createdBy) {
      return res.status(401).json({
        success: false,
        message: 'Authentication context is missing.',
      })
    }

    const data = await createProjectMilestone(orgId, createdBy, {
      ...req.body,
      project_id: req.params.projectId as string,
    })

    return res.status(201).json({
      success: true,
      data,
    })
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message,
    })
  }
}

export async function updateProjectMilestoneController(
  req: Request,
  res: Response,
) {
  try {
    if (!canManage(req)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to manage milestones.',
      })
    }

    const orgId = organizationId(req)

    if (!orgId) {
      return res.status(401).json({
        success: false,
        message: 'Organization context is missing.',
      })
    }

    const data = await updateProjectMilestone(
      orgId,
      req.params.milestoneId as string,
      req.body,
    )

    return res.json({
      success: true,
      data,
    })
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message,
    })
  }
}

export async function deleteProjectMilestoneController(
  req: Request,
  res: Response,
) {
  try {
    if (!canManage(req)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to manage milestones.',
      })
    }

    const orgId = organizationId(req)

    if (!orgId) {
      return res.status(401).json({
        success: false,
        message: 'Organization context is missing.',
      })
    }

    const data = await deleteProjectMilestone(
      orgId,
      req.params.milestoneId as string,
    )

    return res.json({
      success: true,
      data,
    })
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message,
    })
  }
}
