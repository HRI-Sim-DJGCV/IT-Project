import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Types } from 'mongoose'
import type { GeneratedScript, RouteOption, WalkPlan } from '../../../shared/types'
import { config } from '../config'
import type { ConditionDoc } from '../models/Condition'
import { WalkPreparation, type WalkPreparationDoc } from '../models/WalkPreparation'
import { aiClient } from './aiClient'
import { buildSegments } from './scriptSegments'
import { resolveVoice } from './voice'

/** Anything still generating after this long is assumed to have died with the process. */
const STALE_AFTER_MS = 30 * 60_000
/** Parallel TTS calls per preparation; Google Cloud TTS is a hosted API, not a local model. */
const TTS_CONCURRENCY = 4

export function audioDirFor(preparationId: string | Types.ObjectId): string {
  return path.join(config.audioDir, String(preparationId))
}

export function audioPath(preparationId: string | Types.ObjectId, index: number): string {
  return path.join(audioDirFor(preparationId), `${index}.mp3`)
}

/** The purpose sentence the generator writes the closing section around. */
export function buildContext(plan: WalkPlan): string {
  const type = plan.routeType.replace(/_/g, ' ')
  return `A ${plan.duration}-minute walking meditation for stress regulation, on a ${type} walk from ${plan.startLocation} to ${plan.endLocation}. Help the walker slow down, settle and return calmer.`
}

async function setStatus(id: Types.ObjectId, patch: Partial<WalkPreparationDoc>): Promise<void> {
  await WalkPreparation.updateOne({ _id: id }, { $set: { ...patch, updatedAt: new Date() } })
}

/** Splits the route's time budget for the park prompt: walk there, stay, walk on. */
function parkTiming(route: RouteOption, totalSeconds: number) {
  if (!route.park) return null
  const atPark = Math.round(totalSeconds * 0.4)
  const rest = totalSeconds - atPark
  return { to_park: Math.round(rest / 2), at_park: atPark, park_to_destination: rest - Math.round(rest / 2) }
}

/**
 * Runs the whole generation for one preparation: LLM script, then one mp3 per
 * segment. Called without await from the route handler; all failures are
 * recorded on the document, never thrown.
 */
export async function runPreparation(id: Types.ObjectId, condition: ConditionDoc): Promise<void> {
  const prep = await WalkPreparation.findById(id).lean()
  if (!prep) return
  const totalSeconds = prep.plan.duration * 60
  try {
    await setStatus(id, { status: 'generating_script' })
    const generated = await aiClient.generateScript({
      source: prep.route.origin,
      destination: prep.route.destination,
      total_walking_time: totalSeconds,
      context: prep.context,
      park: prep.route.park ? { lat: prep.route.park.lat, lon: prep.route.park.lon } : null,
      park_timing: parkTiming(prep.route, totalSeconds),
    })
    const segments = buildSegments(generated.script, prep.plan.duration)
    if (segments.length === 0) throw new Error('The generated script was empty.')
    const voice = resolveVoice(condition)
    const script: GeneratedScript = {
      generator: 'ai',
      model: generated.model,
      promptVersion: generated.prompt_version,
      context: prep.context,
      voice,
      segments,
      rawText: generated.script,
    }
    await setStatus(id, { status: 'generating_audio', script, progress: { done: 0, total: segments.length } })

    await mkdir(audioDirFor(id), { recursive: true })
    let done = 0
    const queue = [...segments]
    const worker = async () => {
      for (let seg = queue.shift(); seg; seg = queue.shift()) {
        const mp3 = await aiClient.synthesize(seg.text, voice)
        await writeFile(audioPath(id, seg.audioIndex as number), mp3)
        done += 1
        await setStatus(id, { progress: { done, total: segments.length } })
      }
    }
    await Promise.all(Array.from({ length: Math.min(TTS_CONCURRENCY, segments.length) }, worker))
    await setStatus(id, { status: 'ready', progress: { done: segments.length, total: segments.length } })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[prep ${id}] failed: ${message}`)
    await setStatus(id, { status: 'failed', error: message })
  }
}

/** On startup: anything left mid-generation by a previous process is failed so the app can retry. */
export async function failStalePreparations(): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_AFTER_MS)
  const res = await WalkPreparation.updateMany(
    { status: { $in: ['pending', 'generating_script', 'generating_audio'] }, updatedAt: { $lt: cutoff } },
    { $set: { status: 'failed', error: 'Generation was interrupted. Please try again.', updatedAt: new Date() } },
  )
  return res.modifiedCount
}
