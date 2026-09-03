import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { requireRoles } from '../../middleware/roles.js'
import {
  archiveRecurringWork,
  createRecurringWork,
  generateRecurringWork,
  listRecurringWork,
} from './recurring-work.controller.js'

const router = Router()

router.get(
  '/',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  listRecurringWork,
)

router.post(
  '/',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'ADMIN'),
  createRecurringWork,
)

router.post(
  '/generate',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'ADMIN'),
  generateRecurringWork,
)

router.patch(
  '/:id/archive',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'ADMIN'),
  archiveRecurringWork,
)

export default router
