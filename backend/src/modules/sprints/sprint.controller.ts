import type { Request, Response } from 'express'
import {
  createSprint,
  getProjectSprints,
  getSprintById,
  updateSprint,
  deleteSprint,
  startSprint,
  completeSprint,
  cancelSprint,
  addWorkItemToSprint,
  removeWorkItemFromSprint,
  getSprintProgress,
  getSprintExecutionSummary,
  getSprintCapacity,
  saveSprintRetrospective,
  getSprintRetrospective,
} from './sprint.service.js'

function currentOrganizationId(req: Request): string | null {
  return (
    (req as any).profile?.organization_id ||
    (req as any).user?.organization_id ||
    null
  )
}

function currentUserId(req: Request) {
  return (
    (req as any).user?.id ||
    (req as any).userId ||
    (req as any).profile?.id
  )
}

function currentUserRole(req: Request) {
  return (
    (req as any).user?.role ||
    (req as any).profile?.role
  )
}

function canManageSprints(req: Request) {
  const role = currentUserRole(req)

  return (
    role === 'SUPER_ADMIN' ||
    role === 'ADMIN' ||
    role === 'MANAGER'
  )
}

export async function createSprintController(
  req: Request,
  res: Response,
) {
  try {
    if (!canManageSprints(req)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to manage sprints.',
      })
    }

    const userId = currentUserId(req)
    const orgId = currentOrganizationId(req)

    if (!userId || !orgId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      })
    }

    const data = await createSprint(
      orgId,
      req.params.projectId as string,
      userId,
      {
        name: req.body.name,
        goal: req.body.goal,
        startDate: req.body.startDate,
        endDate: req.body.endDate,
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

export async function getProjectSprintsController(
  req: Request,
  res: Response,
) {
  try {
    const orgId = currentOrganizationId(req)
    if (!orgId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' })
    }

    const data = await getProjectSprints(
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

export async function getSprintController(
  req: Request,
  res: Response,
) {
  try {
    const orgId = currentOrganizationId(req)
    if (!orgId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' })
    }

    const data = await getSprintById(
      orgId,
      req.params.sprintId as string,
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

export async function updateSprintController(
  req: Request,
  res: Response,
) {
  try {
    if (!canManageSprints(req)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to manage sprints.',
      })
    }

    const orgId = currentOrganizationId(req)
    if (!orgId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' })
    }

    const data = await updateSprint(
      orgId,
      req.params.sprintId as string,
      {
        name: req.body.name,
        goal: req.body.goal,
        startDate: req.body.startDate,
        endDate: req.body.endDate,
        status: req.body.status,
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

export async function deleteSprintController(
  req: Request,
  res: Response,
) {
  try {
    if (!canManageSprints(req)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to manage sprints.',
      })
    }

    const orgId = currentOrganizationId(req)
    if (!orgId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' })
    }

    const data = await deleteSprint(
      orgId,
      req.params.sprintId as string,
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

export async function startSprintController(
  req: Request,
  res: Response,
) {
  try {
    if (!canManageSprints(req)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to manage sprints.',
      })
    }

    const orgId = currentOrganizationId(req)
    if (!orgId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' })
    }

    const data = await startSprint(
      orgId,
      req.params.sprintId as string,
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

export async function completeSprintController(
  req: Request,
  res: Response,
) {
  try {
    if (!canManageSprints(req)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to manage sprints.',
      })
    }

    const userId = currentUserId(req) || 'system'
    const orgId = currentOrganizationId(req)
    if (!orgId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' })
    }

    const data = await completeSprint(
      orgId,
      req.params.sprintId as string,
      userId,
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

export async function cancelSprintController(
  req: Request,
  res: Response,
) {
  try {
    if (!canManageSprints(req)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to manage sprints.',
      })
    }

    const orgId = currentOrganizationId(req)
    if (!orgId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' })
    }

    const data = await cancelSprint(
      orgId,
      req.params.sprintId as string,
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

export async function addWorkItemController(
  req: Request,
  res: Response,
) {
  try {
    if (!canManageSprints(req)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to manage sprints.',
      })
    }

    const orgId = currentOrganizationId(req)
    if (!orgId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' })
    }

    const data = await addWorkItemToSprint(
      orgId,
      req.params.sprintId as string,
      req.body.workItemId,
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

export async function removeWorkItemController(
  req: Request,
  res: Response,
) {
  try {
    if (!canManageSprints(req)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to manage sprints.',
      })
    }

    const orgId = currentOrganizationId(req)
    if (!orgId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' })
    }

    const data = await removeWorkItemFromSprint(
      orgId,
      req.params.sprintId as string,
      req.params.workItemId as string,
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

export async function getSprintProgressController(
  req: Request,
  res: Response,
) {
  try {
    const orgId = currentOrganizationId(req)
    if (!orgId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' })
    }

    const data = await getSprintProgress(
      orgId,
      req.params.sprintId as string,
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

export async function getSprintExecutionSummaryController(
  req: Request,
  res: Response,
) {
  try {
    const orgId = currentOrganizationId(req)
    if (!orgId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' })
    }

    const data = await getSprintExecutionSummary(
      orgId,
      req.params.sprintId as string,
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

export async function getSprintCapacityController(
  req: Request,
  res: Response,
) {
  try {
    const orgId = currentOrganizationId(req)
    if (!orgId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' })
    }

    const data = await getSprintCapacity(
      orgId,
      req.params.sprintId as string,
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

export async function saveSprintRetrospectiveController(
  req: Request,
  res: Response,
) {
  try {
    const userId = currentUserId(req)
    const orgId = currentOrganizationId(req)

    if (!userId || !orgId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      })
    }

    const data = await saveSprintRetrospective(
      req.params.sprintId as string,
      orgId,
      userId,
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

export async function getSprintRetrospectiveController(
  req: Request,
  res: Response,
) {
  try {
    const orgId = currentOrganizationId(req)
    if (!orgId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' })
    }

    const data = await getSprintRetrospective(
      orgId,
      req.params.sprintId as string,
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
