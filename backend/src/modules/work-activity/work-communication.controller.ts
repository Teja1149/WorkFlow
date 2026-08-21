import type { Request, Response } from 'express'
import { getComments, addComment } from './work-comment.service.js'
import { getUpdates, addUpdate } from './work-update.service.js'
import { getConcerns, addConcern, resolveConcern } from './work-concern.service.js'
import { getActivity } from './work-activity.service.js'

export async function listComments(req: Request, res: Response) {
  try {
    const workItemId = req.params.id as string
    const comments = await getComments(workItemId)
    return res.json({ success: true, data: comments })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unable to load comments.',
    })
  }
}

export async function createComment(req: Request, res: Response) {
  try {
    const workItemId = req.params.id as string
    const userId = req.userId!
    const { comment, parent_comment_id } = req.body

    const data = await addComment(workItemId, userId, comment, parent_comment_id)
    return res.status(201).json({ success: true, data })
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unable to add comment.',
    })
  }
}

export async function listUpdates(req: Request, res: Response) {
  try {
    const workItemId = req.params.id as string
    const updates = await getUpdates(workItemId)
    return res.json({ success: true, data: updates })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unable to load updates.',
    })
  }
}

export async function createUpdate(req: Request, res: Response) {
  try {
    const workItemId = req.params.id as string
    const userId = req.userId!
    const { update_text, progress_percent } = req.body

    const data = await addUpdate(workItemId, userId, update_text, Number(progress_percent || 0))
    return res.status(201).json({ success: true, data })
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unable to add update.',
    })
  }
}

export async function listConcerns(req: Request, res: Response) {
  try {
    const workItemId = req.params.id as string
    const concerns = await getConcerns(workItemId)
    return res.json({ success: true, data: concerns })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unable to load concerns.',
    })
  }
}

export async function createConcern(req: Request, res: Response) {
  try {
    const workItemId = req.params.id as string
    const userId = req.userId!
    const { concern } = req.body

    const data = await addConcern(workItemId, userId, concern)
    return res.status(201).json({ success: true, data })
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unable to report concern.',
    })
  }
}

export async function resolveConcernHandler(req: Request, res: Response) {
  try {
    const concernId = req.params.concernId as string
    const userId = req.userId!

    const data = await resolveConcern(concernId, userId)
    return res.json({ success: true, data })
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unable to resolve concern.',
    })
  }
}

export async function listActivity(req: Request, res: Response) {
  try {
    const workItemId = req.params.id as string
    const activity = await getActivity(workItemId)
    return res.json({ success: true, data: activity })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unable to load activity.',
    })
  }
}
