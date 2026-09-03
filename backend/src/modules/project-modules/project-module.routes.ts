import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import {
  createProjectModuleController,
  deleteProjectModuleController,
  getProjectModulesController,
  updateProjectModuleController,
} from './project-module.controller.js'

const router = Router()

router.get(
  '/projects/:projectId/modules',
  requireAuth,
  getProjectModulesController,
)

router.post(
  '/projects/:projectId/modules',
  requireAuth,
  createProjectModuleController,
)

router.patch(
  '/projects/modules/:moduleId',
  requireAuth,
  updateProjectModuleController,
)

router.delete(
  '/projects/modules/:moduleId',
  requireAuth,
  deleteProjectModuleController,
)

export default router
