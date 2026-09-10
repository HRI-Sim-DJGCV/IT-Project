import jwt from 'jsonwebtoken'
import type { Role } from '../../../shared/types'
import { config } from '../config'

export interface AuthUser {
  id: string
  role: Role
  condition?: string
}

interface Claims {
  sub: string
  role: Role
  condition?: string
}

export function signToken(user: AuthUser): { token: string; expiresAt: string } {
  const claims: Claims = { sub: user.id, role: user.role }
  if (user.condition) claims.condition = user.condition
  const token = jwt.sign(claims, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  })
  const decoded = jwt.decode(token) as { exp: number }
  return { token, expiresAt: new Date(decoded.exp * 1000).toISOString() }
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const c = jwt.verify(token, config.JWT_SECRET) as Claims
    if (typeof c.sub !== 'string' || typeof c.role !== 'string') return null
    return { id: c.sub, role: c.role, condition: c.condition }
  } catch {
    return null
  }
}
