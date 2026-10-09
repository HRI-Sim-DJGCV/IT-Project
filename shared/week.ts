/** Calendar week in UTC: Monday inclusive through the following Monday exclusive. */
export function getUtcWeekRange(now = new Date()): { start: Date; end: Date } {
  const start = new Date(now)
  start.setUTCHours(0, 0, 0, 0)
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7))
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 7)
  return { start, end }
}
