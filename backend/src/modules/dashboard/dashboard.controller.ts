import type { Request, Response } from 'express'
import { getManagerDashboard } from './dashboard.service.js'
import { getAdminDashboard, getEmployeeCapacity } from './admin-dashboard.service.js'

export async function adminDashboard(req: Request, res: Response) {
  try {
    const organizationId = req.profile?.organization_id

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      })
    }

    const dashboard = await getAdminDashboard(organizationId)

    return res.json({
      success: true,
      data: dashboard,
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Unable to load admin dashboard.',
    })
  }
}

export async function managerDashboard(req: Request, res: Response) {
  try {
    const organizationId = req.profile?.organization_id
    const managerId = req.userId

    if (!organizationId || !managerId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      })
    }

    const dashboard = await getManagerDashboard(organizationId, managerId)

    return res.json({
      success: true,
      data: dashboard,
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Unable to load dashboard.',
    })
  }
}

export async function getEmployeeCapacityController(
  req: Request,
  res: Response,
) {
  try {
    const organizationId = req.profile?.organization_id

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      })
    }

    const data = await getEmployeeCapacity(organizationId)

    return res.json({
      success: true,
      data,
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Unable to load employee capacity.',
    })
  }
}
