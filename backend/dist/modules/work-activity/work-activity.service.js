import { supabaseAdmin } from '../../lib/supabase.js';
export async function getActivity(workItemId) {
    const { data, error } = await supabaseAdmin
        .from('work_activity')
        .select(`
      id,
      work_item_id,
      user_id,
      activity_type,
      description,
      created_at,
      user:profiles!work_activity_user_id_fkey(
        id,
        first_name,
        last_name,
        role
      )
    `)
        .eq('work_item_id', workItemId)
        .order('created_at', { ascending: false });
    if (error) {
        throw new Error(error.message);
    }
    return data;
}
export async function logActivity(workItemId, userId, activityType, description) {
    try {
        await supabaseAdmin.from('work_activity').insert({
            work_item_id: workItemId,
            user_id: userId,
            activity_type: activityType,
            description: description,
        });
    }
    catch (err) {
        console.error('Failed to log activity:', err);
    }
}
