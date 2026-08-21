import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { requireRoles } from '../../middleware/roles.js'
import { managerDashboard } from './dashboard.controller.js'
import { employeeDashboard } from './employee-dashboard.controller.js'

const router = Router()

router.get(
  '/manager',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'MANAGER'),
  managerDashboard,
)

router.get(
  '/employee',
  requireAuth,
  requireRoles('EMPLOYEE'),
  employeeDashboard,
)

export default router
