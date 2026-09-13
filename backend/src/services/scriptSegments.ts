import type { ScriptSegment } from '../../../shared/types'

type Section = ScriptSegment['section']

/**
 * How the walk is divided between the three parts of the meditation. Matches
 * the word-count split the generator prompt uses (20 / 40 / 40).
 */
const SECTION_LAYOUT: Array<{ section: Section; title: string; startFraction: number; endFraction: number }> = [
  { section: 'focused_attention', title: 'Focused attention', startFraction: 0, endFraction: 0.2 },
  { section: 'compassion', title: 'Compassion', startFraction: 0.2, endFraction: 0.6 },
  { section: 'closing', title: 'Closing', startFraction: 0.6, endFraction: 1 },
]

const HEADINGS: Array<{ section: Section; pattern: RegExp }> = [
  { section: 'focused_attention', pattern: /\[\s*focused[\s_]*attention\s*\]/i },
  { section: 'compassion', pattern: /\[\s*compassion(?:[\s_]*meditation)?\s*\]/i },
  { section: 'closing', pattern: /\[\s*closing(?:[\s_]*meditation)?\s*\]/i },
]

const WORDS_PER_MINUTE = 130 // slow, guided pace
/** Upper bound per TTS request; keeps each clip short enough to stream and to pause between. */
const MAX_CHUNK_CHARS = 700

/** Splits the raw LLM output into its three sections. Text before the first heading goes to focused attention. */
export function splitSections(raw: string): Record<Section, string> {
  const out: Record<Section, string> = { focused_attention: '', compassion: '', closing: '' }
  const marks: Array<{ section: Section; index: number; length: number }> = []
  for (const h of HEADINGS) {
    const m = h.pattern.exec(raw)
    if (m) marks.push({ section: h.section, index: m.index, length: m[0].length })
  }
  marks.sort((a, b) => a.index - b.index)
  if (marks.length === 0) {
    out.focused_attention = raw.trim()
    return out
  }
  const first = marks[0]!
  if (first.index > 0) out.focused_attention = raw.slice(0, first.index).trim()
  marks.forEach((m, i) => {
    const end = marks[i + 1]?.index ?? raw.length
    const body = raw.slice(m.index + m.length, end).trim()
    out[m.section] = out[m.section] ? `${out[m.section]}\n\n${body}` : body
  })
  return out
}

const SENTENCE_RE = /[^.!?]+[.!?]+[”"']?\s*|[^.!?]+$/g

/** Breaks a section into speakable chunks at paragraph / "(pause)" / sentence boundaries. */
export function chunkText(text: string): string[] {
  const cleaned = text.replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim()
  if (!cleaned) return []
  // Paragraphs and explicit pauses are natural breaks.
  const units = cleaned
    .split(/\n\s*\n|\(\s*pause[^)]*\)/i)
    .map((s) => s.replace(/\n/g, ' ').trim())
    .filter(Boolean)
  const chunks: string[] = []
  for (const unit of units) {
    if (unit.length <= MAX_CHUNK_CHARS) {
      chunks.push(unit)
      continue
    }
    // Too long: split on sentence ends and re-pack.
    const sentences = unit.match(SENTENCE_RE) ?? [unit]
    let buf = ''
    for (const s of sentences) {
      if ((buf + s).length > MAX_CHUNK_CHARS && buf) {
        chunks.push(buf.trim())
        buf = ''
      }
      buf += s
    }
    if (buf.trim()) chunks.push(buf.trim())
  }
  return chunks
}

function wordCount(s: string): number {
  return s.split(/\s+/).filter(Boolean).length
}

export function estimateSpeechSeconds(text: string): number {
  return Math.max(3, Math.round((wordCount(text) / WORDS_PER_MINUTE) * 60))
}

/**
 * Turns the raw script into timed segments for a walk of `durationMinutes`.
 * Each section starts at its fraction of the walk; within a section, chunks
 * are spread evenly so the speech is spaced out with silence in between
 * rather than read back to back. Audio indexes are assigned in order.
 */
export function buildSegments(raw: string, durationMinutes: number): ScriptSegment[] {
  const total = durationMinutes * 60
  const sections = splitSections(raw)
  const segments: ScriptSegment[] = []
  let audioIndex = 0
  for (const layout of SECTION_LAYOUT) {
    const chunks = chunkText(sections[layout.section])
    if (chunks.length === 0) continue
    const start = Math.round(layout.startFraction * total)
    const end = Math.round(layout.endFraction * total)
    const window = end - start
    const speech = chunks.reduce((s, c) => s + estimateSpeechSeconds(c), 0)
    // Silence to distribute between chunks (never negative: if speech overruns, chunks simply queue).
    const gap = Math.max(0, (window - speech) / chunks.length)
    let cursor = start
    chunks.forEach((text, i) => {
      segments.push({
        atSecond: Math.round(cursor),
        section: layout.section,
        title: chunks.length > 1 ? `${layout.title} ${i + 1}/${chunks.length}` : layout.title,
        text,
        audioIndex: audioIndex++,
      })
      cursor += estimateSpeechSeconds(text) + gap
    })
  }
  return segments
}
