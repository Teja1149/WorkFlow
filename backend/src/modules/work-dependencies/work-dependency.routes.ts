import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import {
  addWorkDependencyController,
  getWorkDependenciesController,
  removeWorkDependencyController,
} from './work-dependency.controller.js'

const router = Router()

router.get(
  '/work-items/:workItemId/dependencies',
  requireAuth,
  getWorkDependenciesController,
)

router.post(
  '/work-items/:workItemId/dependencies',
  requireAuth,
  addWorkDependencyController,
)

router.delete(
  '/dependencies/:dependencyId',
  requireAuth,
  removeWorkDependencyController,
)

export default router
