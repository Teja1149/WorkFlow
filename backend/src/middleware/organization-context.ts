import type { Request, Response, NextFunction } from 'express'

export function requireOrganizationContext(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.profile?.organization_id) {
    return res.status(401).json({
      success: false,
      message: 'Organization context is missing.',
    })
  }

  next()
}
