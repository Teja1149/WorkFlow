import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import {
  getTemplate,
  saveTemplate,
  submitReport,
  getSummary,
  getHistory,
  getMyPendingReports,
} from './project-daily-report.controller.js'

const router = Router({ mergeParams: true })

router.get('/my-pending', requireAuth, getMyPendingReports)
router.get('/template', requireAuth, getTemplate)
router.post('/template', requireAuth, saveTemplate)
router.post('/submit', requireAuth, submitReport)
router.get('/summary', requireAuth, getSummary)
router.get('/history', requireAuth, getHistory)

export default router
