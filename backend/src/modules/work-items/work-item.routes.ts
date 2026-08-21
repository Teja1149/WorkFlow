import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { requireRoles } from '../../middleware/roles.js'
import {
  listWorkItems,
  addWorkItem,
  editWorkItem,
  removeWorkItem,
  listWorkUpdates,
  addWorkUpdate,
  listWorkComments,
  addWorkComment,
  listWorkConcerns,
  addWorkConcern,
  resolveWorkConcern,
} from './work-item.controller.js'

const router = Router()

router.get(
  '/',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'MANAGER', 'EMPLOYEE'),
  listWorkItems,
)

router.post(
  '/',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'MANAGER'),
  addWorkItem,
)

router.patch(
  '/:id',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'MANAGER', 'EMPLOYEE'),
  editWorkItem,
)

router.delete(
  '/:id',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'MANAGER'),
  removeWorkItem,
)

router.get(
  '/:id/updates',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'MANAGER', 'EMPLOYEE'),
  listWorkUpdates,
)

router.post(
  '/:id/updates',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'MANAGER', 'EMPLOYEE'),
  addWorkUpdate,
)

router.get(
  '/:id/comments',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'MANAGER', 'EMPLOYEE'),
  listWorkComments,
)

router.post(
  '/:id/comments',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'MANAGER', 'EMPLOYEE'),
  addWorkComment,
)

router.get(
  '/:id/concerns',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'MANAGER', 'EMPLOYEE'),
  listWorkConcerns,
)

router.post(
  '/:id/concerns',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'MANAGER', 'EMPLOYEE'),
  addWorkConcern,
)

router.patch(
  '/:id/concerns/:concernId/resolve',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'MANAGER'),
  resolveWorkConcern,
)

export default router
