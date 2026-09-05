import type { Request, Response } from 'express'
import {
  archiveRecurringWorkTemplate,
  createRecurringWorkTemplate,
  generateDailyRecurringWork,
  listRecurringWorkTemplates,
  syncMyDailyRecurringWork,
} from './recurring-work.service.js'

export async function createRecurringWork(req: Request, res: Response) {
  try {
    const organizationId = req.profile?.organization_id
    const userId = req.userId

    if (!organizationId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      })
    }

    const data = await createRecurringWorkTemplate(
      organizationId,
      userId,
      req.body,
    )

    return res.status(201).json({
      success: true,
      data,
    })
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Unable to create recurring work.',
    })
  }
}

export async function listRecurringWork(req: Request, res: Response) {
  try {
    const organizationId = req.profile?.organization_id

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      })
    }

    const data = await listRecurringWorkTemplates(organizationId)

    return res.json({
      success: true,
      data,
    })
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Unable to load recurring work.',
    })
  }
}

export async function archiveRecurringWork(req: Request, res: Response) {
  try {
    const organizationId = req.profile?.organization_id

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      })
    }

    const data = await archiveRecurringWorkTemplate(
      organizationId,
      req.params.id as string,
    )

    return res.json({
      success: true,
      data,
    })
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Unable to archive recurring work.',
    })
  }
}

export async function generateRecurringWork(req: Request, res: Response) {
  try {
    const organizationId = req.profile?.organization_id

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      })
    }

    const data = await generateDailyRecurringWork(organizationId)

    return res.json({
      success: true,
      data,
    })
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Unable to generate recurring work.',
    })
  }
}

export async function syncMyTodayRecurringWork(req: Request, res: Response) {
  try {
    const organizationId = req.profile?.organization_id
    const userId = req.userId

    if (!organizationId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      })
    }

    const data = await syncMyDailyRecurringWork(organizationId, userId)

    return res.json({
      success: true,
      data,
    })
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Unable to sync daily recurring work.',
    })
  }
}
