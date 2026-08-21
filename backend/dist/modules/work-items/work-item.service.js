import { supabaseAdmin } from '../../lib/supabase.js';
import { logActivity } from '../work-activity/work-activity.service.js';
import { createNotification, notifyStakeholders, } from '../notifications/notification.service.js';
export async function getWorkItems(organizationId, userId, role) {
    let query = supabaseAdmin
        .from('work_items')
        .select(`
      *,
      projects:project_id (
        id,
        name,
        project_key
      ),
      assignee:assigned_to (
        id,
        first_name,
        last_name,
        email,
        employee_id,
        role
      ),
      creator:created_by (
        id,
        first_name,
        last_name,
        email
      )
    `)
        .eq('organization_id', organizationId);
    if (role === 'EMPLOYEE') {
        query = query.eq('assigned_to', userId);
    }
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) {
        throw new Error(error.message);
    }
    return data;
}
export async function createWorkItem(organizationId, createdBy, input) {
    const { data, error } = await supabaseAdmin
        .from('work_items')
        .insert({
        organization_id: organizationId,
        project_id: input.project_id,
        assigned_to: input.assigned_to || null,
        created_by: createdBy,
        title: input.title,
        description: input.description || null,
        priority: input.priority || 'MEDIUM',
        status: 'TODO',
        start_date: input.start_date || null,
        deadline: input.deadline || null,
    })
        .select()
        .single();
    if (error) {
        throw new Error(error.message);
    }
    // Log activity
    await logActivity(data.id, createdBy, 'WORK_ASSIGNED', `Created work item: ${input.title}`);
    // Automatic Notifications to Manager, Admins, and Assigned Employee
    try {
        await notifyStakeholders({
            organizationId,
            title: 'New Work Item Created',
            message: `Work item "${data.title}" was created.`,
            type: 'WORK_ASSIGNED',
            workItemId: data.id,
            projectId: data.project_id,
            authorUserId: createdBy,
            recipients: [data.assigned_to],
        });
    }
    catch (notifErr) {
        console.error('Failed to notify work creation:', notifErr);
    }
    return data;
}
export async function updateWorkItem(organizationId, userId, role, workItemId, input) {
    const { data: existing, error: existingError } = await supabaseAdmin
        .from('work_items')
        .select('id, organization_id, assigned_to, status, title, project_id, created_by')
        .eq('id', workItemId)
        .single();
    if (existingError || !existing || existing.organization_id !== organizationId) {
        throw new Error('Work item not found.');
    }
    if (role === 'EMPLOYEE' && existing.assigned_to !== userId) {
        throw new Error('You cannot update this work item.');
    }
    const updateData = {
        ...input,
        updated_at: new Date().toISOString(),
    };
    if (input.status === 'DONE') {
        updateData.completed_at = new Date().toISOString();
    }
    const { data, error } = await supabaseAdmin
        .from('work_items')
        .update(updateData)
        .eq('id', workItemId)
        .select()
        .single();
    if (error) {
        throw new Error(error.message);
    }
    if (input.status && input.status !== existing.status) {
        await logActivity(workItemId, userId, 'STATUS_CHANGED', `Status changed from ${existing.status} to ${input.status}.`);
        try {
            await notifyStakeholders({
                organizationId,
                title: 'Work Status Updated',
                message: `"${existing.title}" is now ${input.status}.`,
                type: 'WORK_STATUS_CHANGED',
                workItemId,
                projectId: existing.project_id,
                authorUserId: userId,
                recipients: [existing.assigned_to, existing.created_by],
            });
        }
        catch {
            // Ignore notification failure
        }
    }
    return data;
}
export async function deleteWorkItem(organizationId, workItemId) {
    const { error } = await supabaseAdmin
        .from('work_items')
        .delete()
        .eq('id', workItemId)
        .eq('organization_id', organizationId);
    if (error) {
        throw new Error(error.message);
    }
}
// Work Updates
export async function getWorkUpdates(organizationId, workItemId) {
    const { data: work } = await supabaseAdmin
        .from('work_items')
        .select('id')
        .eq('id', workItemId)
        .eq('organization_id', organizationId)
        .single();
    if (!work) {
        throw new Error('Work item not found.');
    }
    const { data, error } = await supabaseAdmin
        .from('work_updates')
        .select(`
      *,
      employee:employee_id (
        id,
        first_name,
        last_name,
        employee_id
      )
    `)
        .eq('work_item_id', workItemId)
        .order('created_at', { ascending: false });
    if (error) {
        throw new Error(error.message);
    }
    return data;
}
export async function createWorkUpdate(organizationId, employeeId, workItemId, input) {
    const { data: work } = await supabaseAdmin
        .from('work_items')
        .select('id, assigned_to, title, project_id')
        .eq('id', workItemId)
        .eq('organization_id', organizationId)
        .single();
    if (!work) {
        throw new Error('Work item not found.');
    }
    if (work.assigned_to !== employeeId) {
        throw new Error('Only the assigned employee can submit this update.');
    }
    const progress = Math.max(0, Math.min(100, input.progress_percent ?? 0));
    const { data, error } = await supabaseAdmin
        .from('work_updates')
        .insert({
        work_item_id: workItemId,
        employee_id: employeeId,
        update_text: input.update_text,
        progress_percent: progress,
    })
        .select()
        .single();
    if (error) {
        throw new Error(error.message);
    }
    await supabaseAdmin
        .from('work_items')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', workItemId);
    await logActivity(workItemId, employeeId, 'DAILY_UPDATE', `Progress updated to ${progress}%.`);
    // Notify the work creator/manager
    // and any other relevant recipient, but never the person
    // who generated the update.
    const { data: workRecipients } = await supabaseAdmin
        .from('work_items')
        .select('created_by, assigned_to')
        .eq('id', workItemId)
        .single();
    try {
        await notifyStakeholders({
            organizationId,
            type: 'WORK_UPDATED',
            title: 'Work Update Received',
            message: `"${work.title}" was updated to ${progress}% progress.`,
            workItemId,
            projectId: work.project_id,
            authorUserId: employeeId,
            recipients: [workRecipients?.created_by, workRecipients?.assigned_to],
        });
    }
    catch (notificationError) {
        console.error('Failed to notify work update recipients:', notificationError);
    }
    return data;
}
// Work Comments
export async function getWorkComments(organizationId, workItemId) {
    const { data: work } = await supabaseAdmin
        .from('work_items')
        .select('id')
        .eq('id', workItemId)
        .eq('organization_id', organizationId)
        .single();
    if (!work) {
        throw new Error('Work item not found.');
    }
    const { data, error } = await supabaseAdmin
        .from('work_comments')
        .select(`
      *,
      user:user_id (
        id,
        first_name,
        last_name,
        role
      )
    `)
        .eq('work_item_id', workItemId)
        .order('created_at', { ascending: true });
    if (error) {
        throw new Error(error.message);
    }
    return data;
}
export async function createWorkComment(organizationId, userId, workItemId, input) {
    if (!input.comment?.trim()) {
        throw new Error('Comment cannot be empty.');
    }
    const { data: work } = await supabaseAdmin
        .from('work_items')
        .select('id, assigned_to, created_by, title, project_id')
        .eq('id', workItemId)
        .eq('organization_id', organizationId)
        .single();
    if (!work) {
        throw new Error('Work item not found.');
    }
    const { data, error } = await supabaseAdmin
        .from('work_comments')
        .insert({
        work_item_id: workItemId,
        user_id: userId,
        parent_comment_id: input.parent_comment_id || null,
        comment: input.comment.trim(),
    })
        .select()
        .single();
    if (error) {
        throw new Error(error.message);
    }
    await logActivity(workItemId, userId, 'COMMENT_ADDED', 'A comment was added.');
    // Notify everyone directly involved with the work item,
    // except the person who posted the comment.
    const recipients = [
        work.assigned_to,
        work.created_by,
    ].filter((id) => Boolean(id) && id !== userId);
    for (const recipientId of [
        ...new Set(recipients),
    ]) {
        try {
            await createNotification({
                userId: recipientId,
                organizationId,
                type: 'COMMENT_ADDED',
                title: 'New work comment',
                message: `A new comment was added to "${work.title}".`,
                workItemId,
                projectId: work.project_id,
            });
        }
        catch (notificationError) {
            console.error('Failed to notify comment recipient:', notificationError);
        }
    }
    return data;
}
// Work Concerns
export async function getWorkConcerns(organizationId, workItemId) {
    const { data: work } = await supabaseAdmin
        .from('work_items')
        .select('id')
        .eq('id', workItemId)
        .eq('organization_id', organizationId)
        .single();
    if (!work) {
        throw new Error('Work item not found.');
    }
    const { data, error } = await supabaseAdmin
        .from('work_concerns')
        .select(`
      *,
      reporter:reported_by (
        id,
        first_name,
        last_name,
        employee_id
      ),
      resolver:resolved_by (
        id,
        first_name,
        last_name
      )
    `)
        .eq('work_item_id', workItemId)
        .order('created_at', { ascending: false });
    if (error) {
        throw new Error(error.message);
    }
    return data;
}
export async function createWorkConcern(organizationId, userId, workItemId, input) {
    if (!input.concern?.trim()) {
        throw new Error('Concern cannot be empty.');
    }
    const { data: work } = await supabaseAdmin
        .from('work_items')
        .select('id, created_by, assigned_to, title, project_id')
        .eq('id', workItemId)
        .eq('organization_id', organizationId)
        .single();
    if (!work) {
        throw new Error('Work item not found.');
    }
    const { data, error } = await supabaseAdmin
        .from('work_concerns')
        .insert({
        work_item_id: workItemId,
        reported_by: userId,
        concern: input.concern.trim(),
        status: 'OPEN',
    })
        .select()
        .single();
    if (error) {
        throw new Error(error.message);
    }
    await logActivity(workItemId, userId, 'CONCERN_REPORTED', 'A work concern was reported.');
    const notifyUser = userId === work.assigned_to ? work.created_by : work.assigned_to;
    if (notifyUser) {
        await createNotification({
            userId: notifyUser,
            organizationId,
            type: 'CONCERN_REPORTED',
            title: 'Work concern reported',
            message: `A concern was reported on "${work.title}".`,
            workItemId,
            projectId: work.project_id,
        });
    }
    return data;
}
export async function resolveConcern(organizationId, userId, workItemId, concernId) {
    const { data: concern } = await supabaseAdmin
        .from('work_concerns')
        .select('id, work_item_id, reported_by, concern')
        .eq('id', concernId)
        .eq('work_item_id', workItemId)
        .single();
    if (!concern) {
        throw new Error('Concern not found.');
    }
    const { data: work } = await supabaseAdmin
        .from('work_items')
        .select('id')
        .eq('id', workItemId)
        .eq('organization_id', organizationId)
        .single();
    if (!work) {
        throw new Error('Work item not found.');
    }
    const { data, error } = await supabaseAdmin
        .from('work_concerns')
        .update({
        status: 'RESOLVED',
        resolved_by: userId,
        resolved_at: new Date().toISOString(),
    })
        .eq('id', concernId)
        .select()
        .single();
    if (error) {
        throw new Error(error.message);
    }
    await logActivity(workItemId, userId, 'CONCERN_RESOLVED', 'A work concern was resolved.');
    // Notify the person who originally reported
    // the concern.
    if (concern.reported_by &&
        concern.reported_by !== userId) {
        try {
            await createNotification({
                userId: concern.reported_by,
                organizationId,
                type: 'CONCERN_RESOLVED',
                title: 'Work concern resolved',
                message: `Your concern on "${workItemId}" has been resolved.`,
                workItemId,
            });
        }
        catch (notificationError) {
            console.error('Failed to notify concern reporter:', notificationError);
        }
    }
    return data;
}
