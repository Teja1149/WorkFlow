import type { Request, Response } from 'express'
import { getEmployeeDashboard } from './employee-dashboard.service.js'

export async function employeeDashboard(req: Request, res: Response) {
  try {
    const organizationId = req.profile?.organization_id
    const employeeId = req.userId

    if (!organizationId || !employeeId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      })
    }

    const dashboard = await getEmployeeDashboard(organizationId, employeeId)

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
          : 'Unable to load employee dashboard.',
    })
  }
}
