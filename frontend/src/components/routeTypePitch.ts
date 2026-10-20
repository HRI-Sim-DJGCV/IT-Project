import type { RouteType } from '../types'

/** The short, inviting pitch shown for each route type on the home screen. Kept honest: routes are suggestions, not guarantees. */
export const ROUTE_TYPE_PITCH: Record<RouteType, { title: string; blurb: string }> = {
  loop: {
    title: 'A loop that brings you home',
    blurb: 'Wander out, circle round, and end where you started. Nothing to plan.',
  },
  out_and_back: {
    title: 'Out to a spot and back',
    blurb: 'Choose a place to turn around, then retrace your steps. Simple and familiar.',
  },
  quiet_streets: {
    title: 'Take the quiet way',
    blurb: 'Side streets and calm corners, choosing small roads over busy ones where it can.',
  },
  green_space: {
    title: 'Find some green',
    blurb: 'A route that passes through nearby parks and gardens where it can.',
  },
}
