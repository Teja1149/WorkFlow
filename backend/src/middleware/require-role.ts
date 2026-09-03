import type {
  Request,
  Response,
  NextFunction,
} from 'express'

export function requireRole(
  ...roles: string[]
) {
  return (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const role = req.profile?.role

    if (!role || !roles.includes(role)) {
      return res.status(403).json({
        success: false,
        message:
          'You do not have permission to perform this action.',
      })
    }

    next()
  }
}
