import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import {
  getCompanyExecutionSummaryController,
  getEmployeePerformanceController,
  getEmployeeWorkDetailController,
  getProjectExecutionController,
  getTeamTodayWorkController,
  getTodayWorkController,
  processCarryForwardController,
  refreshWorkHealthController,
  getEmployeeCapacityController,
  getAttentionCountsController,
  getLiveOverviewController,
} from './work-execution.controller.js'

const router = Router()

router.get(
  '/live-overview',
  requireAuth,
  getLiveOverviewController,
)

router.get(
  '/attention',
  requireAuth,
  getAttentionCountsController,
)

router.get(
  '/today',
  requireAuth,
  getTodayWorkController,
)

router.get(
  '/team-today',
  requireAuth,
  getTeamTodayWorkController,
)

router.get(
  '/company',
  requireAuth,
  getCompanyExecutionSummaryController,
)

router.get(
  '/employee-performance',
  requireAuth,
  getEmployeePerformanceController,
)

router.get(
  '/employee-capacity',
  requireAuth,
  getEmployeeCapacityController,
)

router.get(
  '/employees/:employeeId',
  requireAuth,
  getEmployeeWorkDetailController,
)

router.get(
  '/projects/:projectId/execution',
  requireAuth,
  getProjectExecutionController,
)

router.post(
  '/refresh-health',
  requireAuth,
  refreshWorkHealthController,
)

router.post(
  '/process-carry-forward',
  requireAuth,
  processCarryForwardController,
)

export default router
