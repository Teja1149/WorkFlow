import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { requireRoles } from '../../middleware/roles.js'
import {
  getCompanyOperationsController,
} from './company-operations.controller.js'

const router = Router()

router.get(
  '/',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  getCompanyOperationsController,
)

export default router
