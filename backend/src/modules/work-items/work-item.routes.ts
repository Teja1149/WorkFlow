import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { requireRoles } from '../../middleware/roles.js'
import {
  listWorkItems,
  getWorkItem,
  addWorkItem,
  editWorkItem,
  updateWorkItemStatus,
  removeWorkItem,
  listWorkUpdates,
  addWorkUpdate,
  listWorkComments,
  addWorkComment,
  listWorkConcerns,
  addWorkConcern,
  resolveWorkConcern,
  listWorkAssignmentHistoryController,
  listWorkActivity,
} from './work-item.controller.js'

const router = Router()

router.get(
  '/:workItemId/assignment-history',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE'),
  listWorkAssignmentHistoryController,
)

router.get(
  '/',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE'),
  listWorkItems,
)

router.post(
  '/',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  addWorkItem,
)

router.get(
  '/:id',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE'),
  getWorkItem,
)

router.patch(
  '/:id/status',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE'),
  updateWorkItemStatus,
)

router.patch(
  '/:id',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE'),
  editWorkItem,
)

router.delete(
  '/:id',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  removeWorkItem,
)

router.get(
  '/:id/updates',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE'),
  listWorkUpdates,
)

router.post(
  '/:id/updates',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE'),
  addWorkUpdate,
)

router.get(
  '/:id/comments',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE'),
  listWorkComments,
)

router.post(
  '/:id/comments',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE'),
  addWorkComment,
)

router.get(
  '/:id/concerns',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE'),
  listWorkConcerns,
)

router.post(
  '/:id/concerns',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE'),
  addWorkConcern,
)

router.patch(
  '/:id/concerns/:concernId/resolve',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  resolveWorkConcern,
)

router.get(
  '/:id/activity',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE'),
  listWorkActivity,
)

export default router
