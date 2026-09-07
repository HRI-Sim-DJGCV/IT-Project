import type { NextFunction, Request, Response } from 'express'
import { ZodError, type ZodTypeAny, type z } from 'zod'
import type { ApiErrorBody } from '../../shared/types'

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'INVALID_CREDENTIALS'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL'

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: ApiErrorBody['error']['details'],
  ) {
    super(message)
  }
}

export const unauthenticated = () => new ApiError(401, 'UNAUTHENTICATED', 'Please log in.')
export const invalidCredentials = () => new ApiError(401, 'INVALID_CREDENTIALS', 'Incorrect user ID or password.')
export const forbidden = () => new ApiError(403, 'FORBIDDEN', 'You do not have access to this.')
export const notFound = (what = 'Resource') => new ApiError(404, 'NOT_FOUND', `${what} not found.`)
export const conflict = (message: string) => new ApiError(409, 'CONFLICT', message)

/** Parses `input` with `schema`, throwing a 400 VALIDATION_ERROR on failure. */
export function parse<S extends ZodTypeAny>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input)
  if (result.success) return result.data
  throw new ApiError(
    400,
    'VALIDATION_ERROR',
    'Request is invalid.',
    result.error.issues.map((i) => ({ field: i.path.join('.') || '(root)', message: i.message })),
  )
}

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  next(notFound('Endpoint'))
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    const body: ApiErrorBody = { error: { code: err.code, message: err.message } }
    if (err.details) body.error.details = err.details
    res.status(err.status).json(body)
    return
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Request is invalid.' } })
    return
  }
  // Malformed JSON body from the body parser
  if (typeof err === 'object' && err !== null && (err as { type?: string }).type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Body is not valid JSON.' } })
    return
  }
  console.error('[api] unhandled error', err)
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong.' } })
}
