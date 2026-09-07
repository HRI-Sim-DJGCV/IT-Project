import type { ScriptSegment } from '../../../shared/types'
import type { ScriptTemplateSegment } from '../models/Condition'

/** Default script given to new conditions and used by the seed. */
export const DEFAULT_SCRIPT: ScriptTemplateSegment[] = [
  {
    atFraction: 0,
    title: 'Welcome',
    text: 'Welcome to your walking meditation. Begin walking at a comfortable, easy pace. There is nowhere to rush to. For the next little while, your only job is to walk and to notice.',
  },
  {
    atFraction: 0.06,
    title: 'Arriving',
    text: 'Feel your feet meeting the ground with each step. Notice the heel landing, the weight rolling forward, and the toes pushing off. Let your arms swing naturally.',
  },
  {
    atFraction: 0.15,
    title: 'Breathing in',
    text: 'Now bring your attention to your breath. Breathe in slowly through your nose for four steps. And breathe out gently through your mouth for four steps. In for four. Out for four.',
  },
  {
    atFraction: 0.28,
    title: 'Noticing',
    text: 'As you walk, notice three things you can see. Notice two things you can hear. Notice one thing you can feel, perhaps the air on your skin. There is no need to judge any of it.',
  },
  {
    atFraction: 0.42,
    title: 'Letting go',
    text: 'If a thought arrives, that is perfectly fine. Acknowledge it, and then let it pass like a cloud moving across the sky. Return your attention to the rhythm of your steps.',
  },
  {
    atFraction: 0.56,
    title: 'Body scan',
    text: 'Bring awareness to your shoulders. If they are raised, let them drop. Soften your jaw. Relax your hands. Let each step shake loose a little more tension.',
  },
  {
    atFraction: 0.7,
    title: 'Gratitude',
    text: 'Think of one small thing you are grateful for today. Hold it in mind for a few steps. Notice how it feels in your body.',
  },
  {
    atFraction: 0.84,
    title: 'Slowing down',
    text: 'You are nearing the end of your walk. Take one more slow breath in. And out. Notice how you feel now compared to when you started.',
  },
  {
    atFraction: 0.95,
    title: 'Closing',
    text: 'Well done. Your walk is almost complete. Carry this sense of calm with you into the rest of your day.',
  },
]

/** Scales a fraction-based template to absolute seconds for the requested duration. */
export function scaleScript(template: ScriptTemplateSegment[], durationMinutes: number): ScriptSegment[] {
  const total = durationMinutes * 60
  return template.map((s) => ({ atSecond: Math.round(s.atFraction * total), title: s.title, text: s.text }))
}
