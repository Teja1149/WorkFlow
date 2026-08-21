import { supabaseAdmin } from '../../lib/supabase.js';
import { createNotification } from '../notifications/notification.service.js';
export async function getUserConversations(userId, organizationId) {
    // Get conversation IDs user is member of
    const { data: memberships, error: memErr } = await supabaseAdmin
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', userId);
    if (memErr) {
        throw new Error(memErr.message);
    }
    const conversationIds = memberships?.map((m) => m.conversation_id) || [];
    if (conversationIds.length === 0) {
        return [];
    }
    const { data: convs, error: convErr } = await supabaseAdmin
        .from('conversations')
        .select(`
      *,
      members:conversation_members(
        user_id,
        user:profiles!conversation_members_user_id_fkey(
          id,
          first_name,
          last_name,
          role,
          designation
        )
      )
    `)
        .in('id', conversationIds)
        .eq('organization_id', organizationId)
        .order('updated_at', { ascending: false });
    if (convErr) {
        throw new Error(convErr.message);
    }
    return convs;
}
export async function createConversation(userId, organizationId, type, name, memberIds) {
    const allMembers = Array.from(new Set([userId, ...memberIds]));
    const { data: conv, error: convErr } = await supabaseAdmin
        .from('conversations')
        .insert({
        organization_id: organizationId,
        type: type,
        name: name || null,
        created_by: userId,
    })
        .select()
        .single();
    if (convErr) {
        throw new Error(convErr.message);
    }
    const memberRows = allMembers.map((mId) => ({
        conversation_id: conv.id,
        user_id: mId,
    }));
    const { error: memErr } = await supabaseAdmin
        .from('conversation_members')
        .insert(memberRows);
    if (memErr) {
        throw new Error(memErr.message);
    }
    return conv;
}
export async function getConversationMessages(conversationId) {
    const { data, error } = await supabaseAdmin
        .from('conversation_messages')
        .select(`
      *,
      sender:profiles!conversation_messages_sender_id_fkey(
        id,
        first_name,
        last_name,
        role
      )
    `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
    if (error) {
        throw new Error(error.message);
    }
    return data;
}
export async function sendConversationMessage(conversationId, senderId, messageText) {
    if (!messageText.trim()) {
        throw new Error('Message cannot be empty.');
    }
    const { data, error } = await supabaseAdmin
        .from('conversation_messages')
        .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        message: messageText.trim(),
    })
        .select(`
      *,
      sender:profiles!conversation_messages_sender_id_fkey(
        id,
        first_name,
        last_name,
        role
      )
    `)
        .single();
    if (error) {
        throw new Error(error.message);
    }
    // Update conversation timestamp
    await supabaseAdmin
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);
    // Notify other conversation members
    try {
        const { data: members } = await supabaseAdmin
            .from('conversation_members')
            .select('user_id, conversation:conversations(organization_id, name, type)')
            .eq('conversation_id', conversationId);
        if (members && members.length > 0) {
            const senderName = data.sender?.first_name || 'Someone';
            for (const m of members) {
                if (m.user_id !== senderId) {
                    const convInfo = m.conversation;
                    await createNotification({
                        userId: m.user_id,
                        organizationId: convInfo?.organization_id,
                        type: 'MESSAGE_RECEIVED',
                        title: convInfo?.type === 'TEAM' ? `New message in ${convInfo.name || 'Team'}` : 'New Direct Message',
                        message: `${senderName}: ${messageText.trim().substring(0, 80)}`,
                    });
                }
            }
        }
    }
    catch {
        // Ignore notification error
    }
    return data;
}
