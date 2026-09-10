import type { NextFunction, Request, Response } from 'express'
import type { Role } from '../../../shared/types'
import { forbidden, unauthenticated } from '../errors'
import { verifyToken, type AuthUser } from './jwt'

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

/** Identity always comes from the token, never from the request body. */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  const user = token ? verifyToken(token) : null
  if (!user) return next(unauthenticated())
  req.user = user
  next()
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthenticated())
    if (!roles.includes(req.user.role)) return next(forbidden())
    next()
  }
}

export const requireParticipant = requireRole('participant')
export const requireAdmin = requireRole('medical_professional', 'researcher')

/** Non-null `req.user` for handlers that run after `requireAuth`. */
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw unauthenticated()
  return req.user
}
