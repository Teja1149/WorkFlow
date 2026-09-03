import type { Request, Response } from 'express'
import {
  createDailyTarget,
  getEmployeeDailyTargets,
  getTeamDailyTargets,
  updateDailyTargetResult,
  updateDailyTarget,
  cancelDailyTarget,
  processDailyTargetCarryForward,
  getEmployeeTargetPerformance,
  getTeamTargetPerformance,
  getCompanyTargetSummary,
  getEmployeeTargetHistory,
  createDailyTargetWithWorkItem,
  getProjectDailyTargets,
  getDailyResultsReport,
  getCompanyTodayTargets,
} from './daily-target.service.js'

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

export async function createDailyTargetController(
  req: Request,
  res: Response,
) {
  try {
    if (!canManage(req)) {
      return res.status(403).json({
        success: false,
        message:
          'Only managers and administrators can create daily targets.',
      })
    }

    const orgId = organizationId(req)
    const creatorId = userId(req)

    if (!orgId || !creatorId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication context is missing.',
      })
    }

    const data = await createDailyTarget(
      orgId,
      creatorId,
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

export async function getEmployeeDailyTargetsController(
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

    const requestedEmployee =
      req.params.employeeId as string

    const currentUser =
      userId(req)

    const role =
      req.profile?.role

    const employeeId =
      role === 'EMPLOYEE'
        ? currentUser
        : requestedEmployee

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: 'Employee is required.',
      })
    }

    if (
      role === 'EMPLOYEE' &&
      requestedEmployee &&
      requestedEmployee !== currentUser
    ) {
      return res.status(403).json({
        success: false,
        message:
          'You cannot view another employee’s targets.',
      })
    }

    const data =
      await getEmployeeDailyTargets(
        orgId,
        employeeId,
        req.query.date as string | undefined,
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

export async function getTeamDailyTargetsController(
  req: Request,
  res: Response,
) {
  try {
    const role = req.profile?.role

    if (
      role !== 'SUPER_ADMIN' &&
      role !== 'ADMIN' &&
      role !== 'MANAGER'
    ) {
      return res.status(403).json({
        success: false,
        message:
          'You do not have permission to view team targets.',
      })
    }

    const orgId = organizationId(req)

    if (!orgId) {
      return res.status(401).json({
        success: false,
        message:
          'Organization context is missing.',
      })
    }

    const data =
      await getTeamDailyTargets(
        orgId,
        req.query.date as
          | string
          | undefined,
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

export async function updateDailyTargetResultController(
  req: Request,
  res: Response,
) {
  try {
    const orgId = organizationId(req)
    const currentUser =
      userId(req)

    if (!orgId || !currentUser) {
      return res.status(401).json({
        success: false,
        message: 'Authentication context is missing.',
      })
    }

    const data =
      await updateDailyTargetResult(
        orgId,
        currentUser,
        req.params.targetId as string,
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

export async function updateDailyTargetController(
  req: Request,
  res: Response,
) {
  try {
    const role = req.profile?.role

    if (
      role !== 'SUPER_ADMIN' &&
      role !== 'ADMIN' &&
      role !== 'MANAGER'
    ) {
      return res.status(403).json({
        success: false,
        message:
          'Only managers and administrators can edit targets.',
      })
    }

    const orgId = organizationId(req)

    if (!orgId) {
      return res.status(401).json({
        success: false,
        message:
          'Organization context is missing.',
      })
    }

    const data = await updateDailyTarget(
      orgId,
      req.params.targetId as string,
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

export async function cancelDailyTargetController(
  req: Request,
  res: Response,
) {
  try {
    const role = req.profile?.role

    if (
      role !== 'SUPER_ADMIN' &&
      role !== 'ADMIN' &&
      role !== 'MANAGER'
    ) {
      return res.status(403).json({
        success: false,
        message:
          'Only managers and administrators can cancel targets.',
      })
    }

    const orgId = organizationId(req)

    if (!orgId) {
      return res.status(401).json({
        success: false,
        message:
          'Organization context is missing.',
      })
    }

    const data = await cancelDailyTarget(
      orgId,
      req.params.targetId as string,
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

export async function processDailyTargetCarryForwardController(
  req: Request,
  res: Response,
) {
  try {
    const role = req.profile?.role

    if (
      role !== 'SUPER_ADMIN' &&
      role !== 'ADMIN' &&
      role !== 'MANAGER'
    ) {
      return res.status(403).json({
        success: false,
        message:
          'You do not have permission to process daily targets.',
      })
    }

    const orgId = organizationId(req)

    if (!orgId) {
      return res.status(401).json({
        success: false,
        message:
          'Organization context is missing.',
      })
    }

    const data =
      await processDailyTargetCarryForward(
        orgId,
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

export async function getEmployeeTargetPerformanceController(
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
    const requestedEmployee = req.params.employeeId as string
    const currentUser = userId(req)

    if (
      role !== 'SUPER_ADMIN' &&
      role !== 'ADMIN' &&
      role !== 'MANAGER' &&
      currentUser !== requestedEmployee
    ) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view performance.',
      })
    }

    const data = await getEmployeeTargetPerformance(
      orgId,
      requestedEmployee,
      req.query.from as string | undefined,
      req.query.to as string | undefined,
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

export async function getTeamTargetPerformanceController(
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
      role !== 'ADMIN' &&
      role !== 'MANAGER'
    ) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view team performance.',
      })
    }

    const data = await getTeamTargetPerformance(
      orgId,
      req.query.from as string | undefined,
      req.query.to as string | undefined,
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

export async function getCompanyTargetSummaryController(
  req: Request,
  res: Response,
) {
  try {
    const role = req.profile?.role

    if (
      role !== 'SUPER_ADMIN' &&
      role !== 'ADMIN' &&
      role !== 'MANAGER'
    ) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view company target analytics.',
      })
    }

    const orgId = organizationId(req)

    if (!orgId) {
      return res.status(401).json({
        success: false,
        message: 'Organization context is missing.',
      })
    }

    const data = await getCompanyTargetSummary(
      orgId,
      req.query.from as string | undefined,
      req.query.to as string | undefined,
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

export async function getEmployeeTargetHistoryController(
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
    const requestedEmployee = req.params.employeeId as string
    const currentUser = userId(req)

    if (
      role !== 'SUPER_ADMIN' &&
      role !== 'ADMIN' &&
      role !== 'MANAGER' &&
      currentUser !== requestedEmployee
    ) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view target history.',
      })
    }

    const data = await getEmployeeTargetHistory(
      orgId,
      requestedEmployee,
      req.query.from as string | undefined,
      req.query.to as string | undefined,
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

export async function createDailyTargetWithWorkItemController(
  req: Request,
  res: Response,
) {
  try {
    const role = req.profile?.role

    if (
      role !== 'SUPER_ADMIN' &&
      role !== 'ADMIN' &&
      role !== 'MANAGER'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Only managers and administrators can create work targets.',
      })
    }

    const orgId = organizationId(req)
    const userIdValue = userId(req)

    if (!orgId || !userIdValue) {
      return res.status(401).json({
        success: false,
        message: 'Authentication context is missing.',
      })
    }

    const data = await createDailyTargetWithWorkItem(
      orgId,
      userIdValue,
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

export async function getProjectDailyTargetsController(
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

    const data = await getProjectDailyTargets(
      orgId,
      req.params.projectId as string,
      req.query.date as string | undefined,
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

export async function getDailyResultsReportController(
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

    const data = await getDailyResultsReport(orgId, {
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      employeeId: req.query.employeeId as string | undefined,
      projectId: req.query.projectId as string | undefined,
      status: req.query.status as string | undefined,
      reason: req.query.reason as string | undefined,
    })

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

export async function getCompanyTodayTargetsController(
  req: Request,
  res: Response,
) {
  try {
    const role = req.profile?.role

    if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can view company targets.',
      })
    }

    const orgId = organizationId(req)

    if (!orgId) {
      return res.status(401).json({
        success: false,
        message: 'Organization context is missing.',
      })
    }

    const data = await getCompanyTodayTargets(
      orgId,
      req.query.date as string | undefined,
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
