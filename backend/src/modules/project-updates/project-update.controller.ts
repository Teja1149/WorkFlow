import type { Request, Response } from 'express'
import {
  createProjectUpdateTemplate,
  addFieldsToTemplate,
  getProjectUpdateTemplate,
  submitProjectDailyUpdate,
  getProjectDailyUpdates,
  submitProjectTeamUpdate,
  getProjectTeamUpdates,
} from './project-update.service.js'

function getCurrentUserId(req: Request): string | undefined {
  return req.userId || req.profile?.id || (req as any).user?.id
}

function getCurrentUserRole(req: Request): string | undefined {
  return req.profile?.role
}

export async function createTemplateController(
  req: Request,
  res: Response,
) {
  try {
    const projectId = req.params.projectId as string
    const createdBy = getCurrentUserId(req)

    if (!createdBy) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      })
    }

    const data = await createProjectUpdateTemplate(
      projectId,
      {
        ...req.body,
        createdBy,
      },
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

export async function addFieldsController(req: Request, res: Response) {
  try {
    const templateId = req.params.templateId as string
    const fields = Array.isArray(req.body.fields) ? req.body.fields : [req.body]
    const data = await addFieldsToTemplate(templateId, fields)
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

export async function getTemplateController(req: Request, res: Response) {
  try {
    const projectId = req.params.projectId as string
    const data = await getProjectUpdateTemplate(projectId)
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

export async function submitDailyUpdateController(req: Request, res: Response) {
  try {
    const projectId = req.params.projectId as string
    const employeeId = getCurrentUserId(req)

    if (!employeeId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      })
    }

    const data = await submitProjectDailyUpdate(projectId, employeeId, {
      paragraphUpdate: req.body.paragraphUpdate,
      progressPercent: req.body.progressPercent,
      values: req.body.values || {},
    })

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

export async function getDailyUpdatesController(
  req: Request,
  res: Response,
) {
  try {
    const projectId = req.params.projectId as string
    const userId = getCurrentUserId(req)
    const role = getCurrentUserRole(req)

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      })
    }

    const data = await getProjectDailyUpdates(
      projectId,
      {
        employeeId:
          req.query.employeeId as string | undefined,
        fromDate:
          req.query.fromDate as string | undefined,
        toDate:
          req.query.toDate as string | undefined,
      },
      {
        userId,
        role,
      },
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

export async function submitTeamUpdateController(
  req: Request,
  res: Response,
) {
  try {
    const projectId = req.params.projectId as string

    const userId =
      req.userId ||
      req.profile?.id

    const organizationId =
      req.profile?.organization_id

    if (!userId || !organizationId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      })
    }

    const role = String(
      req.profile?.role || '',
    ).toUpperCase()

    if (
      role !== 'SUPER_ADMIN' &&
      role !== 'ADMIN' &&
      role !== 'MANAGER'
    ) {
      return res.status(403).json({
        success: false,
        message:
          'Only Admins and Managers can submit team updates.',
      })
    }

    const data = await submitProjectTeamUpdate(
      projectId,
      organizationId,
      userId,
      {
        updateDate: req.body.updateDate,
        paragraphUpdate: req.body.paragraphUpdate,
        progressPercent: req.body.progressPercent,
        values: req.body.values || {},
      },
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

export async function getTeamUpdatesController(
  req: Request,
  res: Response,
) {
  try {
    const projectId = req.params.projectId as string

    const role = String(
      req.profile?.role || '',
    ).toUpperCase()

    const userId =
      req.userId ||
      req.profile?.id

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      })
    }

    const data = await getProjectTeamUpdates(
      projectId,
      {
        fromDate:
          req.query.fromDate as string | undefined,

        toDate:
          req.query.toDate as string | undefined,
      },
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

