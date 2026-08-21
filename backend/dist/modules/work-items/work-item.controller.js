import { getWorkItems, createWorkItem, updateWorkItem, deleteWorkItem, getWorkUpdates, createWorkUpdate, getWorkComments, createWorkComment, getWorkConcerns, createWorkConcern, resolveConcern, } from './work-item.service.js';
export async function listWorkItems(req, res) {
    try {
        const organizationId = req.profile?.organization_id;
        const userId = req.userId;
        const role = req.profile?.role;
        if (!organizationId || !userId || !role) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required.',
            });
        }
        const workItems = await getWorkItems(organizationId, userId, role);
        return res.json({
            success: true,
            data: workItems,
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            message: error instanceof Error
                ? error.message
                : 'Unable to load work items.',
        });
    }
}
export async function addWorkItem(req, res) {
    try {
        const organizationId = req.profile?.organization_id;
        const userId = req.userId;
        if (!organizationId || !userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required.',
            });
        }
        const workItem = await createWorkItem(organizationId, userId, req.body);
        return res.status(201).json({
            success: true,
            data: workItem,
        });
    }
    catch (error) {
        return res.status(400).json({
            success: false,
            message: error instanceof Error
                ? error.message
                : 'Unable to create work item.',
        });
    }
}
export async function editWorkItem(req, res) {
    try {
        const organizationId = req.profile?.organization_id;
        const userId = req.userId;
        const role = req.profile?.role;
        if (!organizationId || !userId || !role) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required.',
            });
        }
        const workItem = await updateWorkItem(organizationId, userId, role, req.params.id, req.body);
        return res.json({
            success: true,
            data: workItem,
        });
    }
    catch (error) {
        return res.status(400).json({
            success: false,
            message: error instanceof Error
                ? error.message
                : 'Unable to update work item.',
        });
    }
}
export async function removeWorkItem(req, res) {
    try {
        const organizationId = req.profile?.organization_id;
        if (!organizationId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required.',
            });
        }
        await deleteWorkItem(organizationId, req.params.id);
        return res.json({
            success: true,
            message: 'Work item deleted successfully.',
        });
    }
    catch (error) {
        return res.status(400).json({
            success: false,
            message: error instanceof Error
                ? error.message
                : 'Unable to delete work item.',
        });
    }
}
export async function listWorkUpdates(req, res) {
    try {
        const organizationId = req.profile?.organization_id;
        if (!organizationId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required.',
            });
        }
        const data = await getWorkUpdates(organizationId, req.params.id);
        return res.json({
            success: true,
            data,
        });
    }
    catch (error) {
        return res.status(400).json({
            success: false,
            message: error instanceof Error
                ? error.message
                : 'Unable to load updates.',
        });
    }
}
export async function addWorkUpdate(req, res) {
    try {
        const organizationId = req.profile?.organization_id;
        const userId = req.userId;
        if (!organizationId || !userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required.',
            });
        }
        const data = await createWorkUpdate(organizationId, userId, req.params.id, req.body);
        return res.status(201).json({
            success: true,
            data,
        });
    }
    catch (error) {
        return res.status(400).json({
            success: false,
            message: error instanceof Error
                ? error.message
                : 'Unable to add update.',
        });
    }
}
export async function listWorkComments(req, res) {
    try {
        const organizationId = req.profile?.organization_id;
        if (!organizationId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required.',
            });
        }
        const data = await getWorkComments(organizationId, req.params.id);
        return res.json({
            success: true,
            data,
        });
    }
    catch (error) {
        return res.status(400).json({
            success: false,
            message: error instanceof Error
                ? error.message
                : 'Unable to load comments.',
        });
    }
}
export async function addWorkComment(req, res) {
    try {
        const organizationId = req.profile?.organization_id;
        const userId = req.userId;
        if (!organizationId || !userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required.',
            });
        }
        const data = await createWorkComment(organizationId, userId, req.params.id, req.body);
        return res.status(201).json({
            success: true,
            data,
        });
    }
    catch (error) {
        return res.status(400).json({
            success: false,
            message: error instanceof Error
                ? error.message
                : 'Unable to add comment.',
        });
    }
}
export async function listWorkConcerns(req, res) {
    try {
        const organizationId = req.profile?.organization_id;
        if (!organizationId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required.',
            });
        }
        const data = await getWorkConcerns(organizationId, req.params.id);
        return res.json({
            success: true,
            data,
        });
    }
    catch (error) {
        return res.status(400).json({
            success: false,
            message: error instanceof Error
                ? error.message
                : 'Unable to load concerns.',
        });
    }
}
export async function addWorkConcern(req, res) {
    try {
        const organizationId = req.profile?.organization_id;
        const userId = req.userId;
        if (!organizationId || !userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required.',
            });
        }
        const data = await createWorkConcern(organizationId, userId, req.params.id, req.body);
        return res.status(201).json({
            success: true,
            data,
        });
    }
    catch (error) {
        return res.status(400).json({
            success: false,
            message: error instanceof Error
                ? error.message
                : 'Unable to report concern.',
        });
    }
}
export async function resolveWorkConcern(req, res) {
    try {
        const organizationId = req.profile?.organization_id;
        const userId = req.userId;
        if (!organizationId || !userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required.',
            });
        }
        const data = await resolveConcern(organizationId, userId, req.params.id, req.params.concernId);
        return res.json({
            success: true,
            data,
        });
    }
    catch (error) {
        return res.status(400).json({
            success: false,
            message: error instanceof Error
                ? error.message
                : 'Unable to resolve concern.',
        });
    }
}
