import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
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
  createWorkTypeController,
)

router.patch(
  '/:workTypeId',
  requireAuth,
  updateWorkTypeController,
)

router.post(
  '/:workTypeId/archive',
  requireAuth,
  archiveWorkTypeController,
)

router.delete(
  '/:workTypeId',
  requireAuth,
  deleteWorkTypeController,
)

export default router
