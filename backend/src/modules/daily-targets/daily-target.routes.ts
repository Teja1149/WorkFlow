import { Router } from 'express'

import { requireAuth } from '../../middleware/auth.js'

import {
  createDailyTargetController,
  getEmployeeDailyTargetsController,
  getTeamDailyTargetsController,
  updateDailyTargetResultController,
  updateDailyTargetController,
  cancelDailyTargetController,
  processDailyTargetCarryForwardController,
  getEmployeeTargetPerformanceController,
  getTeamTargetPerformanceController,
  getCompanyTargetSummaryController,
  getEmployeeTargetHistoryController,
  createDailyTargetWithWorkItemController,
  getProjectDailyTargetsController,
  getDailyResultsReportController,
  getCompanyTodayTargetsController,
} from './daily-target.controller.js'

const router = Router()

router.get(
  '/company-today',
  requireAuth,
  getCompanyTodayTargetsController,
)

router.get(
  '/results',
  requireAuth,
  getDailyResultsReportController,
)

router.get(
  '/projects/:projectId',
  requireAuth,
  getProjectDailyTargetsController,
)

router.post(
  '/with-work-item',
  requireAuth,
  createDailyTargetWithWorkItemController,
)

router.get(
  '/history/employees/:employeeId',
  requireAuth,
  getEmployeeTargetHistoryController,
)

router.get(
  '/performance/company',
  requireAuth,
  getCompanyTargetSummaryController,
)

router.get(
  '/performance/employees/:employeeId',
  requireAuth,
  getEmployeeTargetPerformanceController,
)

router.get(
  '/performance/team',
  requireAuth,
  getTeamTargetPerformanceController,
)

router.post(
  '/',
  requireAuth,
  createDailyTargetController,
)

router.get(
  '/team',
  requireAuth,
  getTeamDailyTargetsController,
)

router.get(
  '/employees/:employeeId',
  requireAuth,
  getEmployeeDailyTargetsController,
)

router.patch(
  '/:targetId',
  requireAuth,
  updateDailyTargetController,
)

router.patch(
  '/:targetId/result',
  requireAuth,
  updateDailyTargetResultController,
)

router.post(
  '/:targetId/cancel',
  requireAuth,
  cancelDailyTargetController,
)

router.post(
  '/process-carry-forward',
  requireAuth,
  processDailyTargetCarryForwardController,
)

export default router
