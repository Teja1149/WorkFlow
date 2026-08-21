import type { UserProfile } from '../auth/auth.types'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export interface ConversationMember {
  user_id: string
  user?: UserProfile
}

export interface Conversation {
  id: string
  organization_id: string
  type: 'DIRECT' | 'TEAM'
  name: string | null
  created_by: string
  created_at: string
  updated_at: string
  members?: ConversationMember[]
}

export interface ConversationMessage {
  id: string
  conversation_id: string
  sender_id: string
  message: string
  created_at: string
  sender?: UserProfile
}

async function request(token: string, path: string, options?: RequestInit) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options?.headers || {}),
    },
  })

  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.message || 'Request failed.')
  }

  return result.data
}

export async function getConversations(token: string) {
  return request(token, '/conversations') as Promise<Conversation[]>
}

export async function createConversation(
  token: string,
  data: {
    type: 'DIRECT' | 'TEAM'
    name?: string | null
    memberIds: string[]
  },
) {
  return request(token, '/conversations', {
    method: 'POST',
    body: JSON.stringify(data),
  }) as Promise<Conversation>
}

export async function getMessages(token: string, conversationId: string) {
  return request(token, `/conversations/${conversationId}/messages`) as Promise<ConversationMessage[]>
}

export async function sendMessage(token: string, conversationId: string, message: string) {
  return request(token, `/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  }) as Promise<ConversationMessage>
}
