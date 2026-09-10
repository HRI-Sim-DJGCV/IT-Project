import { z } from 'zod'
import { DURATIONS, ROUTE_TYPES, SURVEY_ITEMS } from '../../shared/survey'
import type { RouteType, WalkDuration } from '../../shared/types'

export const roleSchema = z.enum(['participant', 'medical_professional', 'researcher'])

export const durationSchema = z.coerce
  .number()
  .refine((d): d is WalkDuration => (DURATIONS as number[]).includes(d), { message: 'duration must be 15, 30 or 45' })

export const routeTypeSchema = z
  .string()
  .refine((t): t is RouteType => (ROUTE_TYPES as string[]).includes(t), { message: 'unknown routeType' })

const surveyKeys = SURVEY_ITEMS.map((i) => i.key)

/** Exactly the active survey items, each 1-4. */
export const surveySchema = z
  .record(z.string(), z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]))
  .refine((s) => surveyKeys.every((k) => k in s), { message: `must contain ${surveyKeys.join(', ')}` })
  .refine((s) => Object.keys(s).every((k) => surveyKeys.includes(k)), { message: 'contains unknown survey items' })

export const planSchema = z.object({
  startLocation: z.string().trim().min(1).max(200),
  endLocation: z.string().trim().min(1).max(200),
  duration: durationSchema,
  routeType: routeTypeSchema,
})

export const routeSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  description: z.string().max(1000),
  distanceKm: z.number().nonnegative(),
  estimatedMinutes: z.number().nonnegative(),
  path: z.array(z.tuple([z.number(), z.number()])).max(10_000),
})

export const loginSchema = z.object({
  role: roleSchema,
  userId: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(200),
})

export const accessCodeSchema = z.object({
  userId: z.string().trim().min(1).max(64),
  accessCode: z.string().trim().min(4).max(20),
  password: z.string().min(8, 'password must be at least 8 characters').max(200),
})

/**
 * POST /me/walks. Accepts the spec body (`clientId`) and, for compatibility
 * with the current frontend, the full WalkRecord it posts today (`id`,
 * `participantId`, `completed` are ignored; identity comes from the token).
 */
export const saveWalkSchema = z
  .object({
    clientId: z.string().min(1).max(100).optional(),
    id: z.string().min(1).max(100).optional(),
    date: z.string().datetime({ offset: true }),
    plan: planSchema,
    route: routeSchema,
    preSurvey: surveySchema,
    postSurvey: surveySchema,
    actualMinutes: z.number().int().min(1).max(600),
    scriptVersion: z.number().int().positive().optional(),
  })
  .refine((b) => b.clientId || b.id, { message: 'clientId is required', path: ['clientId'] })

export const walkHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  before: z.string().datetime({ offset: true }).optional(),
})

/** POST /routes/generate. Only `duration` is required until routing is real. */
export const generateRoutesSchema = z.object({
  duration: durationSchema,
  startLocation: z.string().trim().max(200).optional(),
  endLocation: z.string().trim().max(200).optional(),
  routeType: routeTypeSchema.optional(),
})

export const scriptQuerySchema = z.object({ duration: durationSchema })

export const conditionSettingSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .regex(/^[A-Za-z0-9_-]+$/, 'id may contain letters, digits, _ and -'),
  name: z.string().trim().min(1).max(100),
  voice: z.string().trim().min(1).max(100),
  age: z.number().int().positive().max(120),
})

export const conditionListSchema = z.array(conditionSettingSchema).min(1)

export const conditionUpdateSchema = conditionSettingSchema
  .omit({ id: true })
  .partial()
  .extend({
    script: z
      .array(z.object({ atFraction: z.number().min(0).max(1), title: z.string().min(1), text: z.string().min(1) }))
      .min(1)
      .optional(),
  })

export const createParticipantSchema = z.object({ condition: z.string().trim().min(1).max(20) })

export const patchParticipantSchema = z
  .object({ condition: z.string().trim().min(1).max(20).optional(), active: z.boolean().optional() })
  .refine((b) => b.condition !== undefined || b.active !== undefined, { message: 'nothing to update' })
