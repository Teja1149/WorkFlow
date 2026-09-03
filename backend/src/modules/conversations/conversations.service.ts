import { supabaseAdmin } from '../../lib/supabase.js'
import { createNotification } from '../notifications/notification.service.js'

export async function getUserConversations(userId: string, organizationId: string) {
  // Get conversation IDs user is member of
  const { data: memberships, error: memErr } = await supabaseAdmin
    .from('conversation_members')
    .select('conversation_id')
    .eq('user_id', userId)

  if (memErr) {
    throw new Error(memErr.message)
  }

  const conversationIds = memberships?.map((m) => m.conversation_id) || []
  if (conversationIds.length === 0) {
    return []
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
    .order('updated_at', { ascending: false })

  if (convErr) {
    throw new Error(convErr.message)
  }

  return convs
}

export async function createConversation(
  userId: string,
  organizationId: string,
  type: 'DIRECT' | 'TEAM',
  name: string | null,
  memberIds: string[],
) {
  const allMembers = Array.from(new Set([userId, ...memberIds]))

  const { data: conv, error: convErr } = await supabaseAdmin
    .from('conversations')
    .insert({
      organization_id: organizationId,
      type: type,
      name: name || null,
      created_by: userId,
    })
    .select()
    .single()

  if (convErr) {
    throw new Error(convErr.message)
  }

  const memberRows = allMembers.map((mId) => ({
    conversation_id: conv.id,
    user_id: mId,
  }))

  const { error: memErr } = await supabaseAdmin
    .from('conversation_members')
    .insert(memberRows)

  if (memErr) {
    throw new Error(memErr.message)
  }

  return conv
}

export async function getConversationMessages(
  conversationId: string,
  userId: string,
  organizationId: string,
) {
  // 1. Verify conversation belongs to organization
  const { data: conv, error: convErr } = await supabaseAdmin
    .from('conversations')
    .select('id, organization_id')
    .eq('id', conversationId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (convErr) {
    throw new Error(convErr.message)
  }

  if (!conv) {
    throw new Error('Conversation not found.')
  }

  // 2. Verify user is a member of this conversation
  const { data: member, error: memErr } = await supabaseAdmin
    .from('conversation_members')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .maybeSingle()

  if (memErr) {
    throw new Error(memErr.message)
  }

  if (!member) {
    throw new Error('You do not have permission to view this conversation.')
  }

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
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function sendConversationMessage(
  conversationId: string,
  senderId: string,
  organizationId: string,
  messageText: string,
) {
  if (!messageText.trim()) {
    throw new Error('Message cannot be empty.')
  }

  // 1. Verify conversation belongs to organization
  const { data: conv, error: convErr } = await supabaseAdmin
    .from('conversations')
    .select('id, organization_id, name, type')
    .eq('id', conversationId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (convErr) {
    throw new Error(convErr.message)
  }

  if (!conv) {
    throw new Error('Conversation not found.')
  }

  // 2. Verify sender is a member of this conversation
  const { data: member, error: memErr } = await supabaseAdmin
    .from('conversation_members')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('user_id', senderId)
    .maybeSingle()

  if (memErr) {
    throw new Error(memErr.message)
  }

  if (!member) {
    throw new Error('You do not have permission to post in this conversation.')
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
    .single()

  if (error) {
    throw new Error(error.message)
  }

  // Update conversation timestamp
  await supabaseAdmin
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId)

  // Notify other conversation members
  try {
    const [{ data: conv }, { data: members }] = await Promise.all([
      supabaseAdmin
        .from('conversations')
        .select('id, organization_id, name, type')
        .eq('id', conversationId)
        .single(),
      supabaseAdmin
        .from('conversation_members')
        .select('user_id')
        .eq('conversation_id', conversationId),
    ])

    if (conv?.organization_id && members && members.length > 0) {
      const senderFirstName = data.sender?.first_name || 'Someone'
      const senderFullName = data.sender
        ? `${data.sender.first_name} ${data.sender.last_name || ''}`.trim()
        : 'Someone'

      const notifTitle =
        conv.type === 'TEAM'
          ? `New message in ${conv.name || 'Team Chat'}`
          : `Message from ${senderFirstName}`

      const notifMessage = `${senderFullName}: ${messageText.trim().substring(0, 80)}`

      for (const m of members) {
        if (m.user_id !== senderId) {
          await createNotification({
            userId: m.user_id,
            organizationId: conv.organization_id,
            type: 'MESSAGE_RECEIVED',
            title: notifTitle,
            message: notifMessage,
          }).catch((err) => {
            console.error(`Error creating chat notification for ${m.user_id}:`, err)
          })
        }
      }
    }
  } catch (notifErr) {
    console.error('Failed to process conversation notifications:', notifErr)
  }

  return data
}
