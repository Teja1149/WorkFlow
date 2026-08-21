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
export async function createEmployee(organizationId, input) {
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
        manager_id: input.manager_id || null,
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
