import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { requireRoles } from '../../middleware/roles.js'
import { adminDashboard, managerDashboard, getEmployeeCapacityController } from './dashboard.controller.js'
import { employeeDashboard } from './employee-dashboard.controller.js'

const router = Router()

router.get(
  '/employee-capacity',
  requireAuth,
  requireRoles(
    'SUPER_ADMIN',
    'ADMIN',
    'MANAGER',
  ),
  getEmployeeCapacityController,
)

router.get(
  '/admin',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'ADMIN'),
  adminDashboard,
)

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
