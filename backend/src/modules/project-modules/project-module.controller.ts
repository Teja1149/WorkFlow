import type { Request, Response } from 'express'
import {
  createProjectModule,
  deleteProjectModule,
  getProjectModules,
  updateProjectModule,
} from './project-module.service.js'

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

export async function getProjectModulesController(
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

    const data = await getProjectModules(
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

export async function createProjectModuleController(
  req: Request,
  res: Response,
) {
  try {
    if (!canManage(req)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to manage modules.',
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

    const data = await createProjectModule(
      orgId,
      createdBy,
      {
        ...req.body,
        project_id: req.params.projectId as string,
      },
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

export async function updateProjectModuleController(
  req: Request,
  res: Response,
) {
  try {
    if (!canManage(req)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to manage modules.',
      })
    }

    const orgId = organizationId(req)

    if (!orgId) {
      return res.status(401).json({
        success: false,
        message: 'Organization context is missing.',
      })
    }

    const data = await updateProjectModule(
      orgId,
      req.params.moduleId as string,
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

export async function deleteProjectModuleController(
  req: Request,
  res: Response,
) {
  try {
    if (!canManage(req)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to manage modules.',
      })
    }

    const orgId = organizationId(req)

    if (!orgId) {
      return res.status(401).json({
        success: false,
        message: 'Organization context is missing.',
      })
    }

    const data = await deleteProjectModule(
      orgId,
      req.params.moduleId as string,
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
