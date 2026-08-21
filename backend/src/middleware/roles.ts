import type {
  Request,
  Response,
  NextFunction,
} from 'express'

import type { AppRole } from '../modules/auth/auth.types.js'

export function requireRoles(
  ...allowedRoles: AppRole[]
) {
  return (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.profile) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      })
    }

    if (
      !allowedRoles.includes(
        req.profile.role as AppRole,
      )
    ) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied.',
      })
    }

    next()
  }
}
