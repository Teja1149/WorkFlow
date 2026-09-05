import cron from 'node-cron'
import { runWorkExecutionJob } from './work-execution.job.js'
import { generateDailyRecurringWork } from '../modules/recurring-work/recurring-work.service.js'
import { runDailyReportReminderJob } from '../modules/project-daily-reports/project-daily-report.service.js'

let schedulerStarted = false

export function startScheduler() {
  if (schedulerStarted) {
    return
  }

  schedulerStarted = true

  // Run initial daily recurring generation and work execution on server boot
  setTimeout(async () => {
    try {
      console.log('[Scheduler] Running initial recurring work generation...')
      const genResult = await generateDailyRecurringWork()
      console.log(`[Scheduler] Initial recurring generation finished: ${genResult.generatedCount} items generated.`)
    } catch (err) {
      console.error('[Scheduler] Initial recurring generation error:', err)
    }
  }, 3000)

  // Every minute: Run work execution health checks, carry-forward checks & live state updates
  cron.schedule(
    '* * * * *',
    async () => {
      await runWorkExecutionJob()
      await runDailyReportReminderJob()
    },
  )

  // Every hour: Check and generate any missing daily recurring work items
  cron.schedule(
    '0 * * * *',
    async () => {
      try {
        console.log('[Scheduler] Running hourly recurring work generation check...')
        const res = await generateDailyRecurringWork()
        if (res.generatedCount > 0) {
          console.log(`[Scheduler] Generated ${res.generatedCount} recurring work items for date ${res.date}.`)
        }
      } catch (err) {
        console.error('[Scheduler] Hourly recurring work generation error:', err)
      }
    },
  )

  console.log(
    '[Scheduler] Automated Work execution and Recurring generation scheduler started.',
  )
}

