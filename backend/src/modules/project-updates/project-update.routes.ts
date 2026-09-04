import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import {
  createTemplateController,
  addFieldsController,
  getTemplateController,
  submitDailyUpdateController,
  getDailyUpdatesController,
  submitTeamUpdateController,
  getTeamUpdatesController,
  getCompanyDailyUpdatesController,
} from './project-update.controller.js'

const router = Router()

router.get(
  '/company/daily-updates',
  requireAuth,
  getCompanyDailyUpdatesController,
)

router.post(
  '/projects/:projectId/update-template',
  requireAuth,
  createTemplateController,
)

router.post(
  '/projects/update-template/:templateId/fields',
  requireAuth,
  addFieldsController,
)

router.get(
  '/projects/:projectId/update-template',
  requireAuth,
  getTemplateController,
)

router.post(
  '/projects/:projectId/daily-updates',
  requireAuth,
  submitDailyUpdateController,
)

router.get(
  '/projects/:projectId/daily-updates',
  requireAuth,
  getDailyUpdatesController,
)

router.post(
  '/projects/:projectId/team-updates',
  requireAuth,
  submitTeamUpdateController,
)

router.get(
  '/projects/:projectId/team-updates',
  requireAuth,
  getTeamUpdatesController,
)

export default router

