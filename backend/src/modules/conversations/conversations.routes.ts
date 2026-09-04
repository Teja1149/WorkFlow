import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { requireRoles } from '../../middleware/roles.js'
import {
  listConversations,
  newConversation,
  listMessages,
  postMessage,
  listConversationPeople,
  markConversationRead,
} from './conversations.controller.js'

const router = Router()

router.get(
  '/',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE'),
  listConversations,
)

router.get(
  '/people',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE'),
  listConversationPeople,
)

router.post(
  '/',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE'),
  newConversation,
)

router.get(
  '/:id/messages',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE'),
  listMessages,
)

router.post(
  '/:id/messages',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE'),
  postMessage,
)

router.patch(
  '/:id/read',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE'),
  markConversationRead,
)

export default router
