import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { requireRoles } from '../../middleware/roles.js'
import {
  listComments,
  createComment,
  listUpdates,
  createUpdate,
  listConcerns,
  createConcern,
  resolveConcernHandler,
  listActivity,
} from './work-communication.controller.js'

const router = Router()

// Comments
router.get(
  '/:id/comments',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'MANAGER', 'EMPLOYEE'),
  listComments,
)

router.post(
  '/:id/comments',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'MANAGER', 'EMPLOYEE'),
  createComment,
)

// Updates
router.get(
  '/:id/updates',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'MANAGER', 'EMPLOYEE'),
  listUpdates,
)

router.post(
  '/:id/updates',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'MANAGER', 'EMPLOYEE'),
  createUpdate,
)

// Concerns
router.get(
  '/:id/concerns',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'MANAGER', 'EMPLOYEE'),
  listConcerns,
)

router.post(
  '/:id/concerns',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'MANAGER', 'EMPLOYEE'),
  createConcern,
)

router.patch(
  '/concerns/:concernId/resolve',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'MANAGER'),
  resolveConcernHandler,
)

// Activity
router.get(
  '/:id/activity',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'MANAGER', 'EMPLOYEE'),
  listActivity,
)

export default router
