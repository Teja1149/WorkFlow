import { getManagerDashboard } from './dashboard.service.js';
export async function managerDashboard(req, res) {
    try {
        const organizationId = req.profile?.organization_id;
        const managerId = req.userId;
        if (!organizationId || !managerId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required.',
            });
        }
        const dashboard = await getManagerDashboard(organizationId, managerId);
        return res.json({
            success: true,
            data: dashboard,
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            message: error instanceof Error
                ? error.message
                : 'Unable to load dashboard.',
        });
    }
}
