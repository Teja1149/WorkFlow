import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { requireRoles } from '../../middleware/roles.js'
import {
  archiveWorkTypeController,
  createWorkTypeController,
  deleteWorkTypeController,
  getWorkTypesController,
  updateWorkTypeController,
} from './work-type.controller.js'

const router = Router()

router.get(
  '/',
  requireAuth,
  getWorkTypesController,
)

router.post(
  '/',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  createWorkTypeController,
)

router.patch(
  '/:workTypeId',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  updateWorkTypeController,
)

router.post(
  '/:workTypeId/archive',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  archiveWorkTypeController,
)

router.delete(
  '/:workTypeId',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  deleteWorkTypeController,
)

export default router
