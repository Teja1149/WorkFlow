import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import {
  listNotifications,
  unreadCount,
  readNotification,
  unreadNotification,
  readAllNotifications,
} from './notification.controller.js'

const router = Router()

router.get('/', requireAuth, listNotifications)
router.get('/unread-count', requireAuth, unreadCount)
router.patch('/read-all', requireAuth, readAllNotifications)
router.patch('/:id/read', requireAuth, readNotification)
router.patch('/:id/unread', requireAuth, unreadNotification)

export default router

