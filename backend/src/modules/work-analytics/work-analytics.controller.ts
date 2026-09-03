import type { Request, Response } from 'express'
import {
  getCompanyAnalytics,
  getEmployeeAnalytics,
  getProjectAnalytics,
  getWorkTypeAnalytics,
  getActivityTimeline,
  getBottlenecks,
  getReassignmentRecommendations,
  getRootBlockers,
} from './work-analytics.service.js'

function organizationId(req: Request) {
  return req.profile?.organization_id || null
}

export async function getCompanyAnalyticsController(
  req: Request,
  res: Response,
) {
  try {
    const orgId = organizationId(req)
    if (!orgId) {
      return res.status(401).json({
        success: false,
        message: 'Organization context missing.',
      })
    }

    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string }
    const data = await getCompanyAnalytics(orgId, startDate, endDate)

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

export async function getEmployeeAnalyticsController(
  req: Request,
  res: Response,
) {
  try {
    const orgId = organizationId(req)
    if (!orgId) {
      return res.status(401).json({
        success: false,
        message: 'Organization context missing.',
      })
    }

    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string }
    const data = await getEmployeeAnalytics(orgId, startDate, endDate)

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

export async function getProjectAnalyticsController(
  req: Request,
  res: Response,
) {
  try {
    const orgId = organizationId(req)
    if (!orgId) {
      return res.status(401).json({
        success: false,
        message: 'Organization context missing.',
      })
    }

    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string }
    const data = await getProjectAnalytics(orgId, startDate, endDate)

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

export async function getWorkTypeAnalyticsController(
  req: Request,
  res: Response,
) {
  try {
    const orgId = organizationId(req)
    if (!orgId) {
      return res.status(401).json({
        success: false,
        message: 'Organization context missing.',
      })
    }

    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string }
    const data = await getWorkTypeAnalytics(orgId, startDate, endDate)

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

export async function getActivityTimelineController(
  req: Request,
  res: Response,
) {
  try {
    const orgId = organizationId(req)
    if (!orgId) {
      return res.status(401).json({
        success: false,
        message: 'Organization context missing.',
      })
    }

    const limit = req.query.limit ? Number(req.query.limit) : 20
    const data = await getActivityTimeline(orgId, limit)

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

export async function getBottlenecksController(
  req: Request,
  res: Response,
) {
  try {
    const orgId = organizationId(req)
    if (!orgId) {
      return res.status(401).json({
        success: false,
        message: 'Organization context missing.',
      })
    }

    const data = await getBottlenecks(orgId)

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

export async function getReassignmentRecommendationsController(
  req: Request,
  res: Response,
) {
  try {
    const orgId = organizationId(req)
    if (!orgId) {
      return res.status(401).json({
        success: false,
        message: 'Organization context missing.',
      })
    }

    const data = await getReassignmentRecommendations(orgId)

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

export async function getRootBlockersController(
  req: Request,
  res: Response,
) {
  try {
    const orgId = organizationId(req)
    if (!orgId) {
      return res.status(401).json({
        success: false,
        message: 'Organization context missing.',
      })
    }

    const data = await getRootBlockers(orgId)

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
