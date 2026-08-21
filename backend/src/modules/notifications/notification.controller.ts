import type { Request, Response } from 'express'
import {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from './notification.service.js'

export async function listNotifications(req: Request, res: Response) {
  try {
    const userId = req.userId
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      })
    }

    const notifications = await getNotifications(userId)
    return res.json({
      success: true,
      data: notifications,
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Unable to load notifications.',
    })
  }
}

export async function unreadCount(req: Request, res: Response) {
  try {
    const userId = req.userId
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      })
    }

    const count = await getUnreadCount(userId)
    return res.json({
      success: true,
      data: { count },
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Unable to load unread count.',
    })
  }
}

export async function readNotification(req: Request, res: Response) {
  try {
    const userId = req.userId
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      })
    }

    const notification = await markNotificationRead(
      userId,
      req.params.id as string,
    )

    return res.json({
      success: true,
      data: notification,
    })
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Unable to update notification.',
    })
  }
}

export async function readAllNotifications(req: Request, res: Response) {
  try {
    const userId = req.userId
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      })
    }

    await markAllNotificationsRead(userId)

    return res.json({
      success: true,
      message: 'All notifications marked as read.',
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Unable to update notifications.',
    })
  }
}
