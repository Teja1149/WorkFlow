import { supabaseAdmin } from '../../lib/supabase.js';
export async function getEmployees(organizationId) {
    const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });
    if (error) {
        throw new Error(error.message);
    }
    return data;
}
export async function createEmployee(organizationId, requesterRole, requesterId, input) {
    if (requesterRole === 'MANAGER' && input.role !== 'EMPLOYEE') {
        throw new Error('Managers are only permitted to create employees.');
    }
    // Default manager_id to creator if manager creates employee and manager_id is not specified
    const assignedManagerId = requesterRole === 'MANAGER' && !input.manager_id
        ? requesterId
        : input.manager_id || null;
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: true,
    });
    if (authError || !authData.user) {
        throw new Error(authError?.message || 'Unable to create account.');
    }
    const employeeId = `${input.role === 'MANAGER' ? 'MGR' : 'EMP'}-${Date.now()}`;
    const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
        id: authData.user.id,
        organization_id: organizationId,
        employee_id: employeeId,
        first_name: input.first_name,
        last_name: input.last_name || null,
        email: input.email,
        phone: input.phone || null,
        designation: input.designation || null,
        role: input.role,
        status: 'ACTIVE',
        manager_id: assignedManagerId,
        joining_date: input.joining_date || null,
        timezone: 'Asia/Kolkata',
    })
        .select()
        .single();
    if (profileError) {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        throw new Error(profileError.message);
    }
    return profile;
}
export async function deleteEmployee(organizationId, requesterRole, employeeId) {
    const { data: target, error: targetError } = await supabaseAdmin
        .from('profiles')
        .select('id, organization_id, role, first_name, last_name')
        .eq('id', employeeId)
        .single();
    if (targetError || !target || target.organization_id !== organizationId) {
        throw new Error('Employee account not found.');
    }
    if (target.role === 'SUPER_ADMIN') {
        throw new Error('Super Admin accounts cannot be deleted.');
    }
    if (requesterRole === 'MANAGER' && target.role !== 'EMPLOYEE') {
        throw new Error('Managers are only permitted to delete employees.');
    }
    // 1. Delete values associated with daily updates of this employee
    const { data: userUpdates } = await supabaseAdmin
        .from('project_daily_updates')
        .select('id')
        .eq('employee_id', employeeId);
    if (userUpdates && userUpdates.length > 0) {
        const updateIds = userUpdates.map((u) => u.id);
        await supabaseAdmin
            .from('project_daily_update_values')
            .delete()
            .in('update_id', updateIds);
        await supabaseAdmin
            .from('project_daily_updates')
            .delete()
            .eq('employee_id', employeeId);
    }
    // 2. Remove employee from project_members
    await supabaseAdmin
        .from('project_members')
        .delete()
        .eq('user_id', employeeId);
    // 3. Remove employee from conversation_members
    await supabaseAdmin
        .from('conversation_members')
        .delete()
        .eq('user_id', employeeId);
    // 4. Delete notifications for this employee
    await supabaseAdmin
        .from('notifications')
        .delete()
        .eq('user_id', employeeId);
    // 5. Unassign work items assigned to this employee
    await supabaseAdmin
        .from('work_items')
        .update({ assignee_id: null })
        .eq('assignee_id', employeeId);
    // 6. Unassign manager_id from subordinate employees
    await supabaseAdmin
        .from('profiles')
        .update({ manager_id: null })
        .eq('manager_id', employeeId);
    // 7. Unassign project_manager_id from projects if manager
    await supabaseAdmin
        .from('projects')
        .update({ project_manager_id: null })
        .eq('project_manager_id', employeeId);
    // 8. Delete profile record
    const { error: profileDeleteError } = await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('id', employeeId);
    if (profileDeleteError) {
        throw new Error(profileDeleteError.message);
    }
    // 9. Delete Supabase Auth account
    try {
        await supabaseAdmin.auth.admin.deleteUser(employeeId);
    }
    catch (err) {
        console.error('Failed to delete Supabase auth user:', err);
    }
    return { id: employeeId, message: 'Account successfully deleted.' };
}
export async function updateEmployee(organizationId, employeeId, input) {
    const { data: employee, error: employeeError } = await supabaseAdmin
        .from('profiles')
        .select('id, organization_id, role')
        .eq('id', employeeId)
        .single();
    if (employeeError ||
        !employee ||
        employee.organization_id !== organizationId) {
        throw new Error('Employee not found.');
    }
    if (input.manager_id) {
        const { data: manager, error: managerError } = await supabaseAdmin
            .from('profiles')
            .select('id, role, organization_id')
            .eq('id', input.manager_id)
            .single();
        if (managerError ||
            !manager ||
            manager.role !== 'MANAGER' ||
            manager.organization_id !== organizationId) {
            throw new Error('Selected manager is invalid.');
        }
    }
    const { data, error } = await supabaseAdmin
        .from('profiles')
        .update(input)
        .eq('id', employeeId)
        .select()
        .single();
    if (error) {
        throw new Error(error.message);
    }
    return data;
}
