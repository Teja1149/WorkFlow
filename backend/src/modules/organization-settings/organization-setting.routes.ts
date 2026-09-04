import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { requireRoles } from '../../middleware/roles.js'
import {
  getOrganizationWorkSettingsController,
  updateOrganizationWorkSettingsController,
} from './organization-setting.controller.js'

const router = Router()

router.get(
  '/work-settings',
  requireAuth,
  getOrganizationWorkSettingsController,
)

router.patch(
  '/work-settings',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'ADMIN'),
  updateOrganizationWorkSettingsController,
)

router.put(
  '/work-settings',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'ADMIN'),
  updateOrganizationWorkSettingsController,
)

export default router
