import type { Request, Response } from 'express'
import {
  getUserConversations,
  createConversation,
  getConversationMessages,
  sendConversationMessage,
} from './conversations.service.js'

export async function listConversations(req: Request, res: Response) {
  try {
    const userId = req.userId
    const organizationId = req.profile?.organization_id

    if (!userId || !organizationId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' })
    }

    const conversations = await getUserConversations(userId, organizationId)
    return res.json({ success: true, data: conversations })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unable to list conversations.',
    })
  }
}

export async function newConversation(req: Request, res: Response) {
  try {
    const userId = req.userId
    const organizationId = req.profile?.organization_id
    const { type, name, memberIds } = req.body

    if (!userId || !organizationId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' })
    }

    if (!type || !Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid conversation data.' })
    }

    const conversation = await createConversation(userId, organizationId, type, name, memberIds)
    return res.status(201).json({ success: true, data: conversation })
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unable to create conversation.',
    })
  }
}

export async function listMessages(req: Request, res: Response) {
  try {
    const userId = req.userId
    const organizationId = req.profile?.organization_id

    if (!userId || !organizationId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' })
    }

    const conversationId = req.params.id as string
    const messages = await getConversationMessages(conversationId, userId, organizationId)
    return res.json({ success: true, data: messages })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load messages.'
    const status = message.includes('permission') ? 403 : message.includes('not found') ? 404 : 500
    return res.status(status).json({
      success: false,
      message,
    })
  }
}

export async function postMessage(req: Request, res: Response) {
  try {
    const userId = req.userId
    const organizationId = req.profile?.organization_id
    const conversationId = req.params.id as string
    const { message } = req.body

    if (!userId || !organizationId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' })
    }

    const created = await sendConversationMessage(conversationId, userId, organizationId, message)
    return res.status(201).json({ success: true, data: created })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to send message.'
    const status = message.includes('permission') ? 403 : message.includes('not found') ? 404 : 400
    return res.status(status).json({
      success: false,
      message,
    })
  }
}
