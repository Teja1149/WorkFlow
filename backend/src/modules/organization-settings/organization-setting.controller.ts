import type { Request, Response } from 'express'
import {
  getOrganizationWorkSettings,
  updateOrganizationWorkSettings,
} from './organization-setting.service.js'

function organizationId(req: Request) {
  return req.profile?.organization_id || null
}

function canManage(req: Request) {
  return (
    req.profile?.role === 'SUPER_ADMIN' ||
    req.profile?.role === 'ADMIN'
  )
}

export async function getOrganizationWorkSettingsController(
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

    const data =
      await getOrganizationWorkSettings(orgId)

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

export async function updateOrganizationWorkSettingsController(
  req: Request,
  res: Response,
) {
  try {
    if (!canManage(req)) {
      return res.status(403).json({
        success: false,
        message:
          'Only administrators can change organization work settings.',
      })
    }

    const orgId = organizationId(req)

    if (!orgId) {
      return res.status(401).json({
        success: false,
        message: 'Organization context is missing.',
      })
    }

    const data =
      await updateOrganizationWorkSettings(
        orgId,
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
