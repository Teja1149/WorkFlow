import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'

import {
  createSprintController,
  getProjectSprintsController,
  getSprintController,
  updateSprintController,
  deleteSprintController,
  startSprintController,
  completeSprintController,
  cancelSprintController,
  addWorkItemController,
  removeWorkItemController,
  getSprintProgressController,
  getSprintExecutionSummaryController,
  getSprintCapacityController,
  saveSprintRetrospectiveController,
  getSprintRetrospectiveController,
} from './sprint.controller.js'

const router = Router()

router.post(
  '/projects/:projectId/sprints',
  requireAuth,
  createSprintController,
)

router.get(
  '/projects/:projectId/sprints',
  requireAuth,
  getProjectSprintsController,
)

router.get(
  '/sprints/:sprintId',
  requireAuth,
  getSprintController,
)

router.patch(
  '/sprints/:sprintId',
  requireAuth,
  updateSprintController,
)

router.delete(
  '/sprints/:sprintId',
  requireAuth,
  deleteSprintController,
)

router.post(
  '/sprints/:sprintId/start',
  requireAuth,
  startSprintController,
)

router.post(
  '/sprints/:sprintId/complete',
  requireAuth,
  completeSprintController,
)

router.post(
  '/sprints/:sprintId/cancel',
  requireAuth,
  cancelSprintController,
)

router.post(
  '/sprints/:sprintId/work-items',
  requireAuth,
  addWorkItemController,
)

router.delete(
  '/sprints/:sprintId/work-items/:workItemId',
  requireAuth,
  removeWorkItemController,
)

router.get(
  '/sprints/:sprintId/progress',
  requireAuth,
  getSprintProgressController,
)

router.get(
  '/sprints/:sprintId/execution',
  requireAuth,
  getSprintExecutionSummaryController,
)

router.get(
  '/sprints/:sprintId/capacity',
  requireAuth,
  getSprintCapacityController,
)

router.get(
  '/sprints/:sprintId/retrospective',
  requireAuth,
  getSprintRetrospectiveController,
)

router.post(
  '/sprints/:sprintId/retrospective',
  requireAuth,
  saveSprintRetrospectiveController,
)

export default router
