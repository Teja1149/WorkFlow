import type { Request, Response } from 'express'
import {
  getEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} from './employee.service.js'

export async function listEmployees(req: Request, res: Response) {
  try {
    const organizationId = req.profile?.organization_id

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Organization not found.',
      })
    }

    const employees = await getEmployees(organizationId)

    return res.json({
      success: true,
      data: employees,
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Unable to load employees.',
    })
  }
}

export async function addEmployee(req: Request, res: Response) {
  try {
    const organizationId = req.profile?.organization_id
    const requesterRole = req.profile?.role as 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'EMPLOYEE'
    const requesterId = req.profile?.id

    if (!organizationId || !requesterRole || !requesterId) {
      return res.status(400).json({
        success: false,
        message: 'Organization or user context not found.',
      })
    }

    const employee = await createEmployee(
      organizationId,
      requesterRole,
      requesterId,
      req.body,
    )

    return res.status(201).json({
      success: true,
      data: employee,
    })
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Unable to create employee.',
    })
  }
}

export async function editEmployee(req: Request, res: Response) {
  try {
    const organizationId = req.profile?.organization_id

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Organization not found.',
      })
    }

    const employee = await updateEmployee(
      organizationId,
      req.params.id as string,
      req.body,
    )

    return res.json({
      success: true,
      data: employee,
    })
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Unable to update employee.',
    })
  }
}

export async function removeEmployee(req: Request, res: Response) {
  try {
    const organizationId = req.profile?.organization_id
    const requesterRole = req.profile?.role as 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'EMPLOYEE'
    const employeeId = req.params.id as string

    if (!organizationId || !requesterRole || !employeeId) {
      return res.status(400).json({
        success: false,
        message: 'Organization or user context not found.',
      })
    }

    const result = await deleteEmployee(
      organizationId,
      requesterRole,
      employeeId,
    )

    return res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Unable to delete employee account.',
    })
  }
}
