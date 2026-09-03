import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import {
  createProjectTargetHandler,
  deleteProjectTargetHandler,
  generateDailyTargetsHandler,
  getEmployeeWorkloadHandler,
  getProjectTargetByIdHandler,
  getProjectTargetsByProjectHandler,
  getProjectTargetSummaryHandler,
  getTeamCapacityPreviewHandler,
  setProjectTargetHandler,
  updateProjectTargetHandler,
} from './project-target.controller.js'

const router = Router()

router.use(requireAuth)

// Team Capacity preview
router.get('/team-capacity-preview', getTeamCapacityPreviewHandler)

// Employee workload
router.get('/workload', getEmployeeWorkloadHandler)
router.get('/workload/:employeeId', getEmployeeWorkloadHandler)

// Project Targets CRUD
router.post('/', createProjectTargetHandler)
router.get('/project/:projectId', getProjectTargetsByProjectHandler)
router.get('/details/:targetId', getProjectTargetByIdHandler)
router.put('/:targetId', updateProjectTargetHandler)
router.patch('/:targetId', updateProjectTargetHandler)
router.delete('/:targetId', deleteProjectTargetHandler)

// Project summary & backward compatible routes
router.get('/:projectId', getProjectTargetSummaryHandler)
router.post('/:projectId', setProjectTargetHandler)
router.post('/:projectId/generate-daily', generateDailyTargetsHandler)

export default router
