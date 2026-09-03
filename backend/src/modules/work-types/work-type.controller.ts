import type { Request, Response } from 'express'
import {
  createWorkType,
  deleteWorkType,
  archiveWorkType,
  getWorkTypes,
  updateWorkType,
} from './work-type.service.js'

function organizationId(req: Request) {
  return req.profile?.organization_id || null
}

function userId(req: Request) {
  return req.userId || null
}

function canManage(req: Request) {
  const role = req.profile?.role

  return (
    role === 'SUPER_ADMIN' ||
    role === 'ADMIN' ||
    role === 'MANAGER'
  )
}

export async function getWorkTypesController(
  req: Request,
  res: Response,
) {
  try {
    const orgId = organizationId(req)

    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: 'Organization context is missing.',
      })
    }

    const data = await getWorkTypes(orgId)

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

export async function createWorkTypeController(
  req: Request,
  res: Response,
) {
  try {
    if (!canManage(req)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to create work types.',
      })
    }

    const orgId = organizationId(req)
    const createdBy = userId(req)

    if (!orgId || !createdBy) {
      return res.status(401).json({
        success: false,
        message: 'Authentication or organization context is missing.',
      })
    }

    const data = await createWorkType(
      orgId,
      createdBy,
      req.body,
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

export async function updateWorkTypeController(
  req: Request,
  res: Response,
) {
  try {
    if (!canManage(req)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update work types.',
      })
    }

    const orgId = organizationId(req)

    if (!orgId) {
      return res.status(401).json({
        success: false,
        message: 'Organization context is missing.',
      })
    }

    const data = await updateWorkType(
      orgId,
      req.params.workTypeId as string,
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

export async function archiveWorkTypeController(
  req: Request,
  res: Response,
) {
  try {
    if (!canManage(req)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to archive work types.',
      })
    }

    const orgId = organizationId(req)

    if (!orgId) {
      return res.status(401).json({
        success: false,
        message: 'Organization context is missing.',
      })
    }

    const data = await archiveWorkType(
      orgId,
      req.params.workTypeId as string,
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

export async function deleteWorkTypeController(
  req: Request,
  res: Response,
) {
  try {
    if (!canManage(req)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete work types.',
      })
    }

    const orgId = organizationId(req)

    if (!orgId) {
      return res.status(401).json({
        success: false,
        message: 'Organization context is missing.',
      })
    }

    const data = await deleteWorkType(
      orgId,
      req.params.workTypeId as string,
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
