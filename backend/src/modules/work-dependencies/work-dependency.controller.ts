import type { Request, Response } from 'express'
import {
  addWorkDependency,
  getWorkDependencies,
  removeWorkDependency,
} from './work-dependency.service.js'

function organizationId(req: Request) {
  return req.profile?.organization_id || null
}

function userId(req: Request) {
  return req.userId || null
}

export async function getWorkDependenciesController(
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

    const { workItemId } = req.params

    const data = await getWorkDependencies(
      orgId,
      workItemId as string,
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

export async function addWorkDependencyController(
  req: Request,
  res: Response,
) {
  try {
    const orgId = organizationId(req)
    const currentUserId = userId(req)

    if (!orgId || !currentUserId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication context is missing.',
      })
    }

    const { workItemId } = req.params
    const { dependsOnWorkItemId } = req.body

    if (!dependsOnWorkItemId) {
      return res.status(400).json({
        success: false,
        message: 'dependsOnWorkItemId is required.',
      })
    }

    const data = await addWorkDependency(
      orgId,
      currentUserId,
      workItemId as string,
      dependsOnWorkItemId,
    )

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

export async function removeWorkDependencyController(
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

    const { dependencyId } = req.params

    const data = await removeWorkDependency(
      orgId,
      dependencyId as string,
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
