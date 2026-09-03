import type { Request, Response } from 'express'
import { getCompanyOperations } from './company-operations.service.js'

function organizationId(req: Request) {
  return req.profile?.organization_id || null
}

export async function getCompanyOperationsController(
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

    const role = req.profile?.role

    if (
      role !== 'SUPER_ADMIN' &&
      role !== 'ADMIN'
    ) {
      return res.status(403).json({
        success: false,
        message:
          'Only administrators can view company operations.',
      })
    }

    const data =
      await getCompanyOperations(orgId)

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
