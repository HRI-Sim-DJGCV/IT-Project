import { walkScores } from '../../../shared/scoring'
import type { ConditionSetting, Participant, WalkRecord as WalkRecordDto } from '../../../shared/types'
import type { AccountDoc } from '../models/Account'
import type { ConditionDoc } from '../models/Condition'
import type { WalkRecordDoc } from '../models/WalkRecord'

export function toParticipant(a: AccountDoc): Participant {
  return {
    id: a._id,
    displayName: a.displayName,
    condition: a.condition ?? '',
    joinedAt: a.joinedAt.toISOString(),
  }
}

export function toWalkRecord(w: WalkRecordDoc): WalkRecordDto & { condition: string } {
  return {
    id: w._id.toString(),
    participantId: w.participantId,
    condition: w.condition,
    date: w.date.toISOString(),
    plan: w.plan,
    route: w.route,
    preSurvey: w.preSurvey,
    postSurvey: w.postSurvey ?? null,
    actualMinutes: w.actualMinutes,
    completed: w.completed,
    scriptVersion: w.scriptVersion,
    scores: walkScores(w.preSurvey, w.postSurvey ?? null),
  }
}

export function toConditionSetting(c: ConditionDoc): ConditionSetting {
  return { id: c._id, name: c.name, voice: c.voice, age: c.age }
}
