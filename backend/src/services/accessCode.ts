import { createHash, randomBytes } from 'node:crypto'

/** Unambiguous alphabet (no 0/O, 1/I). Format "K7P2-QX9M". */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateAccessCode(): string {
  const bytes = randomBytes(8)
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length])
  return `${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`
}

/** Codes are stored hashed so a database read cannot be used to log in. */
export function hashAccessCode(code: string): string {
  return createHash('sha256').update(code.trim().toUpperCase()).digest('hex')
}
