import type {
  Request,
  Response,
  NextFunction,
} from 'express'

export function errorHandler(
  error: any,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  console.error(error)

  const status =
    Number(error?.statusCode) || 500

  return res.status(status).json({
    success: false,
    message:
      error?.message ||
      'Internal server error.',
  })
}
