import type { Request, Response } from 'express'
import {
  getWorkItems,
  getWorkItemById,
  createWorkItem,
  updateWorkItem,
  deleteWorkItem,
  getWorkUpdates,
  createWorkUpdate,
  getWorkComments,
  createWorkComment,
  getWorkConcerns,
  createWorkConcern,
  resolveConcern,
  getWorkAssignmentHistory,
} from './work-item.service.js'
import { transitionWorkItemStatus } from './work-item-status.service.js'
import { getActivity } from '../work-activity/work-activity.service.js'

export async function listWorkItems(req: Request, res: Response) {
  try {
    const organizationId = req.profile?.organization_id
    const userId = req.userId
    const role = req.profile?.role

    if (!organizationId || !userId || !role) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      })
    }

    const assigned_to = req.query.assigned_to ? String(req.query.assigned_to) : undefined
    const project_id = req.query.project_id ? String(req.query.project_id) : undefined
    const status = req.query.status ? String(req.query.status) : undefined

    const workItems = await getWorkItems(organizationId, userId, role, {
      assigned_to: role === 'EMPLOYEE' ? userId : assigned_to,
      project_id,
      status,
    })

    return res.json({
      success: true,
      data: workItems,
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Unable to load work items.',
    })
  }
}

export async function getWorkItem(req: Request, res: Response) {
  try {
    const organizationId = req.profile?.organization_id
    const userId = req.userId
    const role = req.profile?.role

    if (!organizationId || !userId || !role) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      })
    }

    const workItem = await getWorkItemById(
      organizationId,
      userId,
      role,
      req.params.id as string,
    )

    return res.json({
      success: true,
      data: workItem,
    })
  } catch (error) {
    return res.status(404).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Work item not found.',
    })
  }
}

export async function addWorkItem(req: Request, res: Response) {
  try {
    const organizationId = req.profile?.organization_id
    const userId = req.userId

    if (!organizationId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      })
    }

    const role = req.profile?.role

    const workItem = await createWorkItem(
      organizationId,
      userId,
      role,
      req.body,
    )

    return res.status(201).json({
      success: true,
      data: workItem,
    })
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Unable to create work item.',
    })
  }
}

export async function editWorkItem(req: Request, res: Response) {
  try {
    const organizationId = req.profile?.organization_id
    const userId = req.userId
    const role = req.profile?.role

    if (!organizationId || !userId || !role) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      })
    }

    const workItem = await updateWorkItem(
      organizationId,
      userId,
      role,
      req.params.id as string,
      req.body,
    )

    return res.json({
      success: true,
      data: workItem,
    })
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Unable to update work item.',
    })
  }
}

export async function updateWorkItemStatus(req: Request, res: Response) {
  try {
    const organizationId = req.profile?.organization_id
    const userId = req.userId

    if (!organizationId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      })
    }

    const { status, notes, action } = req.body
    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required.',
      })
    }

    const updated = await transitionWorkItemStatus(
      organizationId,
      userId,
      req.profile?.role || 'EMPLOYEE',
      req.params.id as string,
      status,
      notes,
      action,
    )

    return res.json({
      success: true,
      data: updated,
    })
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Unable to transition work item status.',
    })
  }
}

export async function removeWorkItem(req: Request, res: Response) {
  try {
    const organizationId = req.profile?.organization_id

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      })
    }

    await deleteWorkItem(organizationId, req.params.id as string)

    return res.json({
      success: true,
      message: 'Work item deleted successfully.',
    })
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Unable to delete work item.',
    })
  }
}

export async function listWorkUpdates(
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

    const data = await getWorkUpdates(
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
          : 'Unable to load updates.',
    })
  }
}

export async function addWorkUpdate(
  req: Request,
  res: Response,
) {
  try {
    const organizationId = req.profile?.organization_id
    const userId = req.userId

    if (!organizationId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      })
    }

    const data = await createWorkUpdate(
      organizationId,
      userId,
      req.params.id as string,
      req.body,
      req.profile?.role,
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
          : 'Unable to add update.',
    })
  }
}

export async function listWorkComments(
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

    const data = await getWorkComments(
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
          : 'Unable to load comments.',
    })
  }
}

export async function addWorkComment(
  req: Request,
  res: Response,
) {
  try {
    const organizationId = req.profile?.organization_id
    const userId = req.userId

    if (!organizationId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      })
    }

    const data = await createWorkComment(
      organizationId,
      userId,
      req.params.id as string,
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
          : 'Unable to add comment.',
    })
  }
}

export async function listWorkConcerns(
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

    const data = await getWorkConcerns(
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
          : 'Unable to load concerns.',
    })
  }
}

export async function addWorkConcern(
  req: Request,
  res: Response,
) {
  try {
    const organizationId = req.profile?.organization_id
    const userId = req.userId

    if (!organizationId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      })
    }

    const data = await createWorkConcern(
      organizationId,
      userId,
      req.params.id as string,
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
          : 'Unable to report concern.',
    })
  }
}

export async function resolveWorkConcern(
  req: Request,
  res: Response,
) {
  try {
    const organizationId = req.profile?.organization_id
    const userId = req.userId

    if (!organizationId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      })
    }

    const data = await resolveConcern(
      organizationId,
      userId,
      req.params.id as string,
      req.params.concernId as string,
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
          : 'Unable to resolve concern.',
    })
  }
}

export async function listWorkAssignmentHistoryController(
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

    const data = await getWorkAssignmentHistory(
      organizationId,
      (req.params.workItemId || req.params.id) as string,
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
          : 'Unable to load assignment history.',
    })
  }
}

export async function listWorkActivity(req: Request, res: Response) {
  try {
    const workItemId = req.params.id as string

    const activity = await getActivity(workItemId)

    return res.json({
      success: true,
      data: activity,
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Unable to load activity.',
    })
  }
}
