import {
  Router,
} from 'express'

import {
  loginController,
  meController,
} from './auth.controller.js'

import {
  requireAuth,
} from '../../middleware/auth.js'

const router =
  Router()

router.post(
  '/login',
  loginController,
)

router.get(
  '/me',
  requireAuth,
  meController,
)

export default router
