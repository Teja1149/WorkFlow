import type { Request, Response } from 'express'
import {
  getProjectReportTemplate,
  saveProjectReportTemplate,
  submitProjectDailyReport,
  getProjectDailyReportsSummary,
  getProjectDailyReportsHistory,
  getEmployeePendingReports,
} from './project-daily-report.service.js'

export async function getTemplate(req: Request, res: Response) {
  try {
    const { projectId } = req.params
    const template = await getProjectReportTemplate(projectId as string)
    return res.json({
      success: true,
      data: template,
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unable to load template.',
    })
  }
}

export async function saveTemplate(req: Request, res: Response) {
  try {
    const { projectId } = req.params
    const organizationId = req.profile?.organization_id
    const userId = req.userId

    if (!organizationId || !userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' })
    }

    const template = await saveProjectReportTemplate(
      organizationId,
      projectId as string,
      userId,
      req.body,
    )

    return res.json({
      success: true,
      data: template,
    })
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unable to save template.',
    })
  }
}

export async function submitReport(req: Request, res: Response) {
  try {
    const { projectId } = req.params
    const organizationId = req.profile?.organization_id
    const userId = req.userId

    if (!organizationId || !userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' })
    }

    const submission = await submitProjectDailyReport(
      organizationId,
      projectId as string,
      userId,
      req.body,
    )

    return res.json({
      success: true,
      data: submission,
    })
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unable to submit report.',
    })
  }
}

export async function getSummary(req: Request, res: Response) {
  try {
    const { projectId } = req.params
    const date = req.query.date as string | undefined

    const summary = await getProjectDailyReportsSummary(projectId as string, date)

    return res.json({
      success: true,
      data: summary,
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unable to load summary.',
    })
  }
}

export async function getHistory(req: Request, res: Response) {
  try {
    const { projectId } = req.params
    const from = req.query.from as string | undefined
    const to = req.query.to as string | undefined
    const employee_id = req.query.employee_id as string | undefined

    const history = await getProjectDailyReportsHistory(projectId as string, {
      from,
      to,
      employee_id,
    })

    return res.json({
      success: true,
      data: history,
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unable to load report history.',
    })
  }
}

export async function getMyPendingReports(req: Request, res: Response) {
  try {
    const organizationId = req.profile?.organization_id
    const userId = req.userId
    const date = req.query.date as string | undefined

    if (!organizationId || !userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' })
    }

    const pending = await getEmployeePendingReports(organizationId, userId, date)

    return res.json({
      success: true,
      data: pending,
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unable to load pending reports.',
    })
  }
}
