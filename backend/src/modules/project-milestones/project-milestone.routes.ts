import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import {
  createProjectMilestoneController,
  deleteProjectMilestoneController,
  getProjectMilestonesController,
  updateProjectMilestoneController,
} from './project-milestone.controller.js'

const router = Router()

router.get(
  '/projects/:projectId/milestones',
  requireAuth,
  getProjectMilestonesController,
)

router.post(
  '/projects/:projectId/milestones',
  requireAuth,
  createProjectMilestoneController,
)

router.patch(
  '/projects/milestones/:milestoneId',
  requireAuth,
  updateProjectMilestoneController,
)

router.delete(
  '/projects/milestones/:milestoneId',
  requireAuth,
  deleteProjectMilestoneController,
)

export default router
