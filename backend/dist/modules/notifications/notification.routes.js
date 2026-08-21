import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { listNotifications, unreadCount, readNotification, readAllNotifications, } from './notification.controller.js';
const router = Router();
router.get('/', requireAuth, listNotifications);
router.get('/unread-count', requireAuth, unreadCount);
router.patch('/read-all', requireAuth, readAllNotifications);
router.patch('/:id/read', requireAuth, readNotification);
// Step 8: Temporary notification test endpoint
router.post('/test', requireAuth, async (req, res) => {
    try {
        const { createNotification } = await import('./notification.service.js');
        const notification = await createNotification({
            userId: req.userId,
            organizationId: req.profile.organization_id,
            type: 'WORK_UPDATED',
            title: 'Test notification',
            message: 'Your notification system is working.',
        });
        return res.json({
            success: true,
            data: notification,
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : 'Test failed.',
        });
    }
});
export default router;
