import cron from 'node-cron'
import type { ScheduledTask } from 'node-cron'
import { generateWeeklyAnalytics } from './analyticsService'

let weeklyAnalyticsTask: ScheduledTask | null = null

/**
 * Initialize cron jobs for analytics generation.
 * Runs weekly report generation every Monday at 00:00 UTC.
 */
export function initializeCronJobs(): void {
  // Schedule weekly analytics generation
  // Cron format: minute hour dayOfMonth month dayOfWeek
  // 0 0 * * 1 = Every Monday at 00:00 UTC
  weeklyAnalyticsTask = cron.schedule('0 0 * * 1', async () => {
    try {
      console.log('[Cron] Starting weekly analytics generation...')
      const result = await generateWeeklyAnalytics()
      console.log(
        `[Cron] Weekly analytics generated: ${result.participantCount} participants, ` +
          `${result.report.totalWalks} total walks`,
      )
    } catch (error) {
      console.error('[Cron] Weekly analytics generation failed:', error)
    }
  })

  console.log('[Cron] Initialized weekly analytics task (every Monday 00:00 UTC)')
}

/**
 * Stop all cron jobs (useful for graceful shutdown)
 */
export function stopCronJobs(): void {
  if (weeklyAnalyticsTask) {
    weeklyAnalyticsTask.stop()
    console.log('[Cron] Stopped weekly analytics task')
  }
}

/**
 * Manually trigger weekly analytics generation (for testing/admin)
 */
export async function triggerWeeklyAnalytics(): Promise<{
  report: any
  participantCount: number
}> {
  console.log('[Cron] Manually triggering weekly analytics generation...')
  const result = await generateWeeklyAnalytics()
  console.log(
    `[Cron] Weekly analytics generated: ${result.participantCount} participants, ` +
      `${result.report.totalWalks} total walks`,
  )
  return result
}
