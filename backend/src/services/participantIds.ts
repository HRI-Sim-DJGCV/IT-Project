import { Account } from '../models/Account'

const ID_PATTERN = /^AAA(\d{3})$/

/** Next free id in the AAA### series. A duplicate-key error on insert means a race; the caller retries. */
export async function nextParticipantId(): Promise<string> {
  const docs = await Account.find({ _id: { $regex: /^AAA\d{3}$/ } }, { _id: 1 }).lean()
  const max = docs.reduce((acc, d) => {
    const m = ID_PATTERN.exec(d._id)
    return m ? Math.max(acc, Number(m[1])) : acc
  }, 0)
  return `AAA${String(max + 1).padStart(3, '0')}`
}
