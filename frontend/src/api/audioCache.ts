import type { ScriptSegment } from '../types'
import { getSegmentAudio } from './index'

/**
 * Downloaded audio for a prepared walk, kept in memory as object URLs so the
 * walk does not depend on the network once it has started. Lost on reload;
 * the Progress screen re-downloads if needed.
 */
const cache = new Map<string, Map<number, string>>()

export function getCachedAudio(preparationId: string): Map<number, string> | null {
  return cache.get(preparationId) ?? null
}

export async function loadPreparationAudio(
  preparationId: string,
  segments: ScriptSegment[],
  onProgress?: (done: number, total: number) => void,
): Promise<Map<number, string>> {
  const existing = cache.get(preparationId)
  const indexes = segments.map((s) => s.audioIndex).filter((i): i is number => i !== null)
  if (existing && indexes.every((i) => existing.has(i))) return existing

  const urls = existing ?? new Map<number, string>()
  let done = 0
  onProgress?.(0, indexes.length)
  // A few at a time keeps the download quick without hammering the API.
  const queue = [...indexes]
  const worker = async () => {
    for (let i = queue.shift(); i !== undefined; i = queue.shift()) {
      if (!urls.has(i)) {
        const blob = await getSegmentAudio(preparationId, i)
        urls.set(i, URL.createObjectURL(blob))
      }
      done += 1
      onProgress?.(done, indexes.length)
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, indexes.length) }, worker))
  cache.set(preparationId, urls)
  return urls
}

export function releasePreparationAudio(preparationId: string) {
  const urls = cache.get(preparationId)
  if (!urls) return
  urls.forEach((u) => URL.revokeObjectURL(u))
  cache.delete(preparationId)
}
