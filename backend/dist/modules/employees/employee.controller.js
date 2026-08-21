import { getEmployees, createEmployee, updateEmployee, } from './employee.service.js';
export async function listEmployees(req, res) {
    try {
        const organizationId = req.profile?.organization_id;
        if (!organizationId) {
            return res.status(400).json({
                success: false,
                message: 'Organization not found.',
            });
        }
        const employees = await getEmployees(organizationId);
        return res.json({
            success: true,
            data: employees,
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            message: error instanceof Error
                ? error.message
                : 'Unable to load employees.',
        });
    }
}
export async function addEmployee(req, res) {
    try {
        const organizationId = req.profile?.organization_id;
        if (!organizationId) {
            return res.status(400).json({
                success: false,
                message: 'Organization not found.',
            });
        }
        const employee = await createEmployee(organizationId, req.body);
        return res.status(201).json({
            success: true,
            data: employee,
        });
    }
    catch (error) {
        return res.status(400).json({
            success: false,
            message: error instanceof Error
                ? error.message
                : 'Unable to create employee.',
        });
    }
}
export async function editEmployee(req, res) {
    try {
        const organizationId = req.profile?.organization_id;
        if (!organizationId) {
            return res.status(400).json({
                success: false,
                message: 'Organization not found.',
            });
        }
        const employee = await updateEmployee(organizationId, req.params.id, req.body);
        return res.json({
            success: true,
            data: employee,
        });
    }
    catch (error) {
        return res.status(400).json({
            success: false,
            message: error instanceof Error
                ? error.message
                : 'Unable to update employee.',
        });
    }
}
