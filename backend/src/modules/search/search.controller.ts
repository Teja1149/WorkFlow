import type { Request, Response } from 'express'
import { globalSearch } from './search.service.js'

export async function searchController(req: Request, res: Response) {
  try {
    const orgId = req.profile?.organization_id
    if (!orgId) {
      return res.status(401).json({
        success: false,
        message: 'Organization context missing.',
      })
    }

    const query = String(req.query.q || '')
    const role = req.profile?.role
    const userId = req.profile?.id
    const data = await globalSearch(orgId, query, role, userId)

    return res.json({
      success: true,
      data,
    })
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message,
    })
  }
}
