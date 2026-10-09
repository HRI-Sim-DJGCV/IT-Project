import { describe, expect, it } from 'vitest'
import { buildSegments, chunkText, estimateSpeechSeconds, splitSections } from '../src/services/scriptSegments'

const script = `[Focused Attention]
Notice your feet on the ground.

(pause)

Let your breath settle.

[Compassion]
Bring to mind someone you care about.

[Closing]
Carry this calm with you.`

describe('splitSections', () => {
  it('splits the script at its three headings', () => {
    const s = splitSections(script)
    expect(s.focused_attention).toContain('Notice your feet')
    expect(s.compassion).toBe('Bring to mind someone you care about.')
    expect(s.closing).toBe('Carry this calm with you.')
  })

  it('puts a script without headings entirely in focused attention', () => {
    expect(splitSections('Just walk.')).toEqual({ focused_attention: 'Just walk.', compassion: '', closing: '' })
  })
})

describe('chunkText', () => {
  it('breaks on paragraphs and (pause) markers', () => {
    expect(chunkText('One.\n\nTwo. (pause) Three.')).toEqual(['One.', 'Two.', 'Three.'])
  })

  it('splits an over-long paragraph on sentence boundaries', () => {
    const sentence = 'This is a sentence that keeps going for a while. '
    const chunks = chunkText(sentence.repeat(30))
    expect(chunks.length).toBeGreaterThan(1)
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(700)
  })

  it('returns nothing for blank input', () => {
    expect(chunkText('  \n ')).toEqual([])
  })
})

describe('estimateSpeechSeconds', () => {
  it('never goes below three seconds and scales with word count', () => {
    expect(estimateSpeechSeconds('hi')).toBe(3)
    expect(estimateSpeechSeconds('word '.repeat(130))).toBe(60)
  })
})

describe('buildSegments', () => {
  it('schedules sections at 0%, 20% and 60% of the walk with sequential audio indexes', () => {
    const segments = buildSegments(script, 30)
    expect(segments.map((s) => s.audioIndex)).toEqual([0, 1, 2, 3])
    expect(segments[0]).toMatchObject({ atSecond: 0, section: 'focused_attention', title: 'Focused attention 1/2' })
    expect(segments.find((s) => s.section === 'compassion')).toMatchObject({ atSecond: 360, title: 'Compassion' })
    expect(segments.find((s) => s.section === 'closing')).toMatchObject({ atSecond: 1080, title: 'Closing' })
  })

  it('keeps segments in playback order within the walk', () => {
    const at = buildSegments(script, 15).map((s) => s.atSecond)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(at.at(-1)).toBeLessThan(15 * 60)
  })
})
