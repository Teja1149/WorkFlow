import type { Request, Response } from 'express'
import {
  getTodayWork,
  processCarryForward,
  refreshWorkHealth,
  getCompanyExecutionSummary,
  getEmployeePerformance,
  getTeamTodayWork,
  getEmployeeWorkDetail,
  getProjectExecution,
  getEmployeeCapacity,
  getAttentionCounts,
  getLiveOverview,
} from './work-execution.service.js'

function organizationId(req: Request) {
  return req.profile?.organization_id || null
}

function userId(req: Request) {
  return req.userId || null
}

export async function getTodayWorkController(
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

    const data = await getTodayWork(
      orgId,
      currentUserId,
      req.profile?.role || 'EMPLOYEE',
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

export async function refreshWorkHealthController(
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
        message:
          'You do not have permission to refresh work health.',
      })
    }

    const data = await refreshWorkHealth(orgId)

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

export async function processCarryForwardController(
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
        message:
          'You do not have permission to process carry-forward work.',
      })
    }

    const data = await processCarryForward(orgId)

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

export async function getCompanyExecutionSummaryController(
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
          'Only administrators can view company execution data.',
      })
    }

    const data =
      await getCompanyExecutionSummary(orgId)

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

export async function getEmployeePerformanceController(
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
        message:
          'You do not have permission to view employee performance.',
      })
    }

    const data =
      await getEmployeePerformance(orgId)

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

export async function getTeamTodayWorkController(
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
        message:
          'You do not have permission to view team work.',
      })
    }

    const data = await getTeamTodayWork(orgId)

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

export async function getEmployeeWorkDetailController(
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
        message:
          'You do not have permission to view employee work.',
      })
    }

    const data = await getEmployeeWorkDetail(
      orgId,
      req.params.employeeId as string,
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

export async function getProjectExecutionController(
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
        message:
          'You do not have permission to view project execution.',
      })
    }

    const data = await getProjectExecution(
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

export async function getEmployeeCapacityController(
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
        message:
          'You do not have permission to view employee capacity.',
      })
    }

    const data =
      await getEmployeeCapacity(orgId)

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

export async function getAttentionCountsController(
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

    const data = await getAttentionCounts(orgId)
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

export async function getLiveOverviewController(
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

    const data = await getLiveOverview(orgId)
    return res.json({
      success: true,
      data,
    })
  } catch (error: any) {
    console.error('[getLiveOverviewController Error]:', error)
    return res.status(400).json({
      success: false,
      message: error.message,
    })
  }
}

