import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import {
  getCompanyOperationsController,
} from './company-operations.controller.js'

const router = Router()

router.get(
  '/',
  requireAuth,
  getCompanyOperationsController,
)

export default router
