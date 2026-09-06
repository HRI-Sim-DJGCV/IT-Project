import type {
  ConditionSetting,
  Participant,
  Role,
  RouteOption,
  RouteType,
  ScriptSegment,
  SurveyItem,
  WalkDuration,
  WalkRecord,
} from '../types'

// ---------------------------------------------------------------------------
// Single mock dataset. Replace with real API calls in src/api when the
// Python/Mongo backend exists.
// ---------------------------------------------------------------------------

/** Admin / researcher demo logins. Listed in the README and on the login screen. */
export const MOCK_ADMIN_CREDENTIALS: Array<{ userId: string; password: string; role: Role }> = [
  { userId: 'admin', password: 'admin', role: 'researcher' },
  { userId: 'doctor', password: 'doctor', role: 'medical_professional' },
]

/** Any of these credentials log in as the mock participant. */
export const MOCK_CREDENTIALS = [
  { userId: 'AAA001', password: 'password' },
  { userId: 'demo', password: 'demo' },
]

/** Experimental arms. Editable by admins on the Settings screen. */
export const MOCK_CONDITIONS: ConditionSetting[] = [
  { id: 'A', name: 'Condition A', voice: 'Male', age: 30 },
  { id: 'B', name: 'Condition B', voice: 'Female', age: 30 },
]

export const MOCK_PARTICIPANT: Participant = {
  id: 'AAA001',
  displayName: 'Participant AAA001',
  condition: 'A',
  joinedAt: '2026-08-12T09:00:00.000Z',
}

export const SURVEY_ITEMS: SurveyItem[] = [
  { key: 'calm', statement: 'I feel calm' },
  { key: 'tense', statement: 'I feel tense' },
  { key: 'at_ease', statement: 'I feel at ease' },
  { key: 'worried', statement: 'I feel worried' },
]

export const SURVEY_SCALE: Array<{ value: 1 | 2 | 3 | 4; label: string }> = [
  { value: 1, label: 'Not at all' },
  { value: 2, label: 'Somewhat' },
  { value: 3, label: 'Moderately' },
  { value: 4, label: 'Very much' },
]

export const DURATIONS: WalkDuration[] = [15, 30, 45]

export const ROUTE_TYPES: Array<{ value: RouteType; label: string }> = [
  { value: 'loop', label: 'Loop' },
  { value: 'out_and_back', label: 'Out and back' },
  { value: 'quiet_streets', label: 'Quiet streets' },
  { value: 'green_space', label: 'Park / green space' },
]

const ROUTE_TEMPLATES: Array<Omit<RouteOption, 'distanceKm' | 'estimatedMinutes'>> = [
  {
    id: 'r1',
    name: 'Route Option 1',
    description: 'Gentle, mostly flat streets with wide footpaths.',
    path: [
      [10, 80],
      [25, 60],
      [45, 65],
      [60, 40],
      [80, 30],
      [90, 15],
    ],
  },
  {
    id: 'r2',
    name: 'Route Option 2',
    description: 'Passes a small park with benches to pause at.',
    path: [
      [10, 80],
      [20, 45],
      [40, 35],
      [55, 55],
      [75, 45],
      [90, 15],
    ],
  },
  {
    id: 'r3',
    name: 'Route Option 3',
    description: 'Quietest option, fewer road crossings.',
    path: [
      [10, 80],
      [30, 85],
      [50, 70],
      [65, 75],
      [85, 40],
      [90, 15],
    ],
  },
]

/** Builds three route options scaled to the requested duration. */
export function buildRouteOptions(duration: WalkDuration): RouteOption[] {
  const paceKmPerMin = 0.08 // ~4.8 km/h, a relaxed pace
  return ROUTE_TEMPLATES.map((t, i) => {
    const minutes = duration + (i - 1) * 2 // 13/15/17 for a 15-min walk etc.
    return {
      ...t,
      estimatedMinutes: minutes,
      distanceKm: Math.round(minutes * paceKmPerMin * 10) / 10,
    }
  })
}

/**
 * Mock meditation script. `atSecond` is expressed as a fraction of the
 * walk so it scales with duration; see `buildScript`.
 */
const SCRIPT_TEMPLATE: Array<{ at: number; title: string; text: string }> = [
  {
    at: 0,
    title: 'Welcome',
    text: 'Welcome to your walking meditation. Begin walking at a comfortable, easy pace. There is nowhere to rush to. For the next little while, your only job is to walk and to notice.',
  },
  {
    at: 0.06,
    title: 'Arriving',
    text: 'Feel your feet meeting the ground with each step. Notice the heel landing, the weight rolling forward, and the toes pushing off. Let your arms swing naturally.',
  },
  {
    at: 0.15,
    title: 'Breathing in',
    text: 'Now bring your attention to your breath. Breathe in slowly through your nose for four steps. And breathe out gently through your mouth for four steps. In for four. Out for four.',
  },
  {
    at: 0.28,
    title: 'Noticing',
    text: 'As you walk, notice three things you can see. Notice two things you can hear. Notice one thing you can feel, perhaps the air on your skin. There is no need to judge any of it.',
  },
  {
    at: 0.42,
    title: 'Letting go',
    text: 'If a thought arrives, that is perfectly fine. Acknowledge it, and then let it pass like a cloud moving across the sky. Return your attention to the rhythm of your steps.',
  },
  {
    at: 0.56,
    title: 'Body scan',
    text: 'Bring awareness to your shoulders. If they are raised, let them drop. Soften your jaw. Relax your hands. Let each step shake loose a little more tension.',
  },
  {
    at: 0.7,
    title: 'Gratitude',
    text: 'Think of one small thing you are grateful for today. Hold it in mind for a few steps. Notice how it feels in your body.',
  },
  {
    at: 0.84,
    title: 'Slowing down',
    text: 'You are nearing the end of your walk. Take one more slow breath in. And out. Notice how you feel now compared to when you started.',
  },
  {
    at: 0.95,
    title: 'Closing',
    text: 'Well done. Your walk is almost complete. Carry this sense of calm with you into the rest of your day.',
  },
]

export function buildScript(durationMinutes: number): ScriptSegment[] {
  const total = durationMinutes * 60
  return SCRIPT_TEMPLATE.map((s) => ({
    atSecond: Math.round(s.at * total),
    title: s.title,
    text: s.text,
  }))
}

export const MOCK_WALK_HISTORY: WalkRecord[] = [
  {
    id: 'w1',
    participantId: 'AAA001',
    date: '2026-08-30T08:15:00.000Z',
    plan: {
      startLocation: 'Home',
      endLocation: 'Home',
      duration: 15,
      routeType: 'loop',
    },
    route: buildRouteOptions(15)[0],
    preSurvey: { calm: 2, tense: 3, at_ease: 2, worried: 3 },
    postSurvey: { calm: 3, tense: 2, at_ease: 3, worried: 2 },
    actualMinutes: 16,
    completed: true,
  },
  {
    id: 'w2',
    participantId: 'AAA001',
    date: '2026-09-02T17:40:00.000Z',
    plan: {
      startLocation: 'Home',
      endLocation: 'Home',
      duration: 30,
      routeType: 'green_space',
    },
    route: buildRouteOptions(30)[1],
    preSurvey: { calm: 1, tense: 4, at_ease: 2, worried: 4 },
    postSurvey: { calm: 3, tense: 2, at_ease: 3, worried: 2 },
    actualMinutes: 31,
    completed: true,
  },
]
