import type { ConditionDoc } from '../models/Condition'

/**
 * Maps a condition's voice setting onto a Google Cloud Text-to-Speech Neural2
 * voice and delivery parameters. Google's API takes no freeform style
 * instruction, so the soothing, unhurried meditation delivery is approximated
 * with a slower speaking rate and a touch of lower pitch for an older guide.
 */
const LANGUAGE_CODE = 'en-US'
const DEFAULT_VOICE_NAME = 'en-US-Neural2-D'

const BY_LABEL: Record<string, string> = {
  male: 'en-US-Neural2-D',
  man: 'en-US-Neural2-D',
  female: 'en-US-Neural2-F',
  woman: 'en-US-Neural2-F',
  neutral: 'en-US-Neural2-C',
}

// Admins may type a Google voice name directly, e.g. "en-US-Neural2-J".
const VOICE_NAME_RE = /^[a-z]{2}-[A-Z]{2}-/

export interface TtsVoice {
  voiceName: string
  languageCode: string
  speakingRate: number
  pitch: number
}

export function resolveVoice(condition: Pick<ConditionDoc, 'voice' | 'age'>): TtsVoice {
  const raw = condition.voice.trim()
  const voiceName = VOICE_NAME_RE.test(raw) ? raw : (BY_LABEL[raw.toLowerCase()] ?? DEFAULT_VOICE_NAME)
  // Slower and a little lower for an older guide; both stay within Google's supported range.
  const speakingRate = condition.age >= 55 ? 0.8 : condition.age >= 35 ? 0.85 : 0.9
  const pitch = condition.age >= 55 ? -4 : condition.age >= 35 ? -2 : 0
  return { voiceName, languageCode: LANGUAGE_CODE, speakingRate, pitch }
}
