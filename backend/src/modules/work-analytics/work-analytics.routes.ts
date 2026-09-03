import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { requireRoles } from '../../middleware/roles.js'
import {
  getCompanyAnalyticsController,
  getEmployeeAnalyticsController,
  getProjectAnalyticsController,
  getWorkTypeAnalyticsController,
  getActivityTimelineController,
  getBottlenecksController,
  getReassignmentRecommendationsController,
  getRootBlockersController,
} from './work-analytics.controller.js'

const router = Router()

router.get(
  '/company',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  getCompanyAnalyticsController,
)

router.get(
  '/employees',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  getEmployeeAnalyticsController,
)

router.get(
  '/projects',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  getProjectAnalyticsController,
)

router.get(
  '/work-types',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  getWorkTypeAnalyticsController,
)

router.get(
  '/bottlenecks',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  getBottlenecksController,
)

router.get(
  '/reassignment-recommendations',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  getReassignmentRecommendationsController,
)

router.get(
  '/root-blockers',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  getRootBlockersController,
)

router.get(
  '/activity-timeline',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE'),
  getActivityTimelineController,
)

export default router
