import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
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
  updateOrganizationWorkSettingsController,
)

router.put(
  '/work-settings',
  requireAuth,
  updateOrganizationWorkSettingsController,
)

export default router
