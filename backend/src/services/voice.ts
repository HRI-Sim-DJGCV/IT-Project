import type { ConditionDoc } from '../models/Condition'

/**
 * Maps a condition's voice setting onto a Qwen3-TTS CustomVoice speaker and a
 * delivery instruction. The instruction is what makes the reading soothing:
 * the model follows it for pace, softness and warmth.
 */
const SPEAKERS = ['Ryan', 'Aiden', 'Vivian', 'Serena', 'Dylan', 'Eric', 'Uncle_Fu', 'Ono_Anna', 'Sohee'] as const

const BY_LABEL: Record<string, string> = {
  male: 'Ryan',
  man: 'Ryan',
  female: 'Serena',
  woman: 'Serena',
  neutral: 'Aiden',
}

export function resolveVoice(condition: Pick<ConditionDoc, 'voice' | 'age'>): { speaker: string; instruct: string } {
  const raw = condition.voice.trim()
  const direct = SPEAKERS.find((s) => s.toLowerCase() === raw.toLowerCase().replace(/\s+/g, '_'))
  const speaker = direct ?? BY_LABEL[raw.toLowerCase()] ?? 'Ryan'
  const ageWord = condition.age >= 55 ? 'an older' : condition.age >= 35 ? 'a middle-aged' : 'a young'
  const instruct =
    `Speak as ${ageWord} meditation guide. Very slow, soft and calm. Warm, gentle and reassuring tone, ` +
    'low energy, long natural pauses between sentences, no excitement. Soothing throughout.'
  return { speaker, instruct }
}
