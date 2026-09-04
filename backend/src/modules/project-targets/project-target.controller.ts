import type { Request, Response } from 'express'
import {
  createProjectTarget,
  deleteProjectTarget,
  generateDailyTargetsFromProject,
  getEmployeeWorkload,
  getProjectTargetById,
  getProjectTargetsByProject,
  getProjectTargetSummary,
  getTeamCapacityPreview,
  setProjectTarget,
  updateProjectTarget,
} from './project-target.service.js'

/**
 * Create a new Project Target
 */
export async function createProjectTargetHandler(
  req: Request,
  res: Response,
) {
  try {
    const orgId = req.profile?.organization_id
    const userId = req.userId
    if (!orgId || !userId) {
      return res.status(401).json({ error: 'Authentication required.' })
    }

    const created = await createProjectTarget(orgId, userId, req.body)
    return res.status(201).json({ data: created })
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to create project target.',
    })
  }
}

/**
 * List all Project Targets for a specific Project
 */
export async function getProjectTargetsByProjectHandler(
  req: Request,
  res: Response,
) {
  try {
    const orgId = req.profile?.organization_id
    if (!orgId) {
      return res.status(401).json({ error: 'Organization ID required.' })
    }

    const projectId = String(req.params.projectId)
    const targets = await getProjectTargetsByProject(orgId, projectId)
    return res.json({ data: targets })
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to fetch project targets.',
    })
  }
}

/**
 * Get a single Project Target by target ID
 */
export async function getProjectTargetByIdHandler(
  req: Request,
  res: Response,
) {
  try {
    const orgId = req.profile?.organization_id
    if (!orgId) {
      return res.status(401).json({ error: 'Organization ID required.' })
    }

    const targetId = String(req.params.targetId)
    const target = await getProjectTargetById(orgId, targetId)
    if (!target) {
      return res.status(404).json({ error: 'Project target not found.' })
    }
    return res.json({ data: target })
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to fetch project target.',
    })
  }
}

/**
 * Update a Project Target
 */
export async function updateProjectTargetHandler(
  req: Request,
  res: Response,
) {
  try {
    const orgId = req.profile?.organization_id
    const userId = req.userId

    if (!orgId || !userId) {
      return res.status(401).json({ error: 'Authentication required.' })
    }

    const targetId = String(req.params.targetId)
    const updated = await updateProjectTarget(
      orgId,
      targetId,
      req.body,
      userId,
    )
    return res.json({ data: updated })
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to update project target.',
    })
  }
}

/**
 * Delete a Project Target
 */
export async function deleteProjectTargetHandler(
  req: Request,
  res: Response,
) {
  try {
    const orgId = req.profile?.organization_id
    if (!orgId) {
      return res.status(401).json({ error: 'Organization ID required.' })
    }

    const targetId = String(req.params.targetId)
    const result = await deleteProjectTarget(orgId, targetId)
    return res.json({ data: result })
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to delete project target.',
    })
  }
}

/**
 * Get Project Target Summary (for project overview and details)
 */
export async function getProjectTargetSummaryHandler(
  req: Request,
  res: Response,
) {
  try {
    const orgId = req.profile?.organization_id
    if (!orgId) {
      return res.status(401).json({ error: 'Organization ID required.' })
    }

    const projectId = String(req.params.projectId)
    const summary = await getProjectTargetSummary(orgId, projectId)
    return res.json({ data: summary })
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to fetch project target summary.',
    })
  }
}

/**
 * Set Project Target (legacy & shortcut save)
 */
export async function setProjectTargetHandler(
  req: Request,
  res: Response,
) {
  try {
    const orgId = req.profile?.organization_id
    if (!orgId) {
      return res.status(401).json({ error: 'Organization ID required.' })
    }

    const projectId = String(req.params.projectId)
    const summary = await setProjectTarget(orgId, projectId, req.body)
    return res.json({ data: summary })
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to update project target.',
    })
  }
}

/**
 * Generate daily targets from project pace
 */
export async function generateDailyTargetsHandler(
  req: Request,
  res: Response,
) {
  try {
    const orgId = req.profile?.organization_id
    const userId = req.userId
    if (!orgId || !userId) {
      return res.status(401).json({ error: 'Authentication required.' })
    }

    const projectId = String(req.params.projectId)
    const generated = await generateDailyTargetsFromProject(orgId, projectId, userId)
    return res.json({ data: generated })
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to generate daily targets.',
    })
  }
}

/**
 * Get Employee Workload across project targets and daily targets
 */
export async function getEmployeeWorkloadHandler(
  req: Request,
  res: Response,
) {
  try {
    const orgId = req.profile?.organization_id
    if (!orgId) {
      return res.status(401).json({ error: 'Organization ID required.' })
    }

    const employeeId = req.params.employeeId ? String(req.params.employeeId) : req.userId
    if (!employeeId) {
      return res.status(400).json({ error: 'Employee ID required.' })
    }

    const workload = await getEmployeeWorkload(orgId, employeeId)
    return res.json({ data: workload })
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to get workload.',
    })
  }
}

/**
 * Get Team Capacity Preview for Work Planner
 */
export async function getTeamCapacityPreviewHandler(
  req: Request,
  res: Response,
) {
  try {
    const orgId = req.profile?.organization_id
    if (!orgId) {
      return res.status(401).json({ error: 'Organization ID required.' })
    }

    const preview = await getTeamCapacityPreview(orgId)
    return res.json({ data: preview })
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to get capacity preview.',
    })
  }
}
