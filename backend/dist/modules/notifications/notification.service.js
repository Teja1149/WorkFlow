import { supabaseAdmin } from '../../lib/supabase.js';
export async function createNotification(input) {
    const { data, error } = await supabaseAdmin
        .from('notifications')
        .insert({
        user_id: input.userId,
        organization_id: input.organizationId,
        type: input.type,
        title: input.title,
        message: input.message,
        work_item_id: input.workItemId || null,
        project_id: input.projectId || null,
        is_read: false,
    })
        .select()
        .single();
    if (error) {
        console.error('Failed to create notification:', error);
        throw new Error(error.message);
    }
    return data;
}
export async function getAdminAndManagerIds(organizationId, excludeUserId) {
    const { data } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('organization_id', organizationId)
        .in('role', ['SUPER_ADMIN', 'MANAGER', 'ADMIN']);
    const ids = (data || []).map((p) => p.id);
    return ids.filter((id) => Boolean(id) && id !== excludeUserId);
}
export async function notifyStakeholders(input) {
    const adminManagerIds = await getAdminAndManagerIds(input.organizationId, input.authorUserId);
    const extraRecipients = (input.recipients || []).filter((id) => Boolean(id) && id !== input.authorUserId);
    const allRecipients = [...new Set([...adminManagerIds, ...extraRecipients])];
    for (const recipientId of allRecipients) {
        try {
            await createNotification({
                userId: recipientId,
                organizationId: input.organizationId,
                type: input.type,
                title: input.title,
                message: input.message,
                workItemId: input.workItemId,
                projectId: input.projectId,
            });
        }
        catch (err) {
            console.error(`Failed to send notification to ${recipientId}:`, err);
        }
    }
}
export async function getNotifications(userId) {
    const { data, error } = await supabaseAdmin
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
    if (error) {
        throw new Error(error.message);
    }
    return data;
}
export async function getUnreadCount(userId) {
    const { count, error } = await supabaseAdmin
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);
    if (error) {
        throw new Error(error.message);
    }
    return count || 0;
}
export async function markNotificationRead(userId, notificationId) {
    const { data, error } = await supabaseAdmin
        .from('notifications')
        .update({
        is_read: true,
    })
        .eq('id', notificationId)
        .eq('user_id', userId)
        .select()
        .single();
    if (error) {
        throw new Error(error.message);
    }
    return data;
}
export async function markAllNotificationsRead(userId) {
    const { error } = await supabaseAdmin
        .from('notifications')
        .update({
        is_read: true,
    })
        .eq('user_id', userId)
        .eq('is_read', false);
    if (error) {
        throw new Error(error.message);
    }
}
