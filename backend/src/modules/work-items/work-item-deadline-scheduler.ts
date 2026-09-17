import {
  runDeadlineMonitor,
} from './work-item-deadline-monitor.service.js'

let deadlineMonitorTimer:
  | NodeJS.Timeout
  | null = null

let running = false

export function startDeadlineMonitor() {
  if (deadlineMonitorTimer) {
    return
  }

  async function execute() {
    if (running) {
      return
    }

    running = true

    try {
      const result =
        await runDeadlineMonitor()

      console.log(
        '[Deadline Monitor]',
        result,
      )
    } catch (error) {
      console.error(
        '[Deadline Monitor] Failed:',
        error,
      )
    } finally {
      running = false
    }
  }

  /*
   * Run once immediately after
   * the server starts.
   */
  void execute()

  /*
   * Check every 1 minute so 1h, 30m, and 5m
   * deadline notifications trigger accurately.
   *
   * The notification windows
   * themselves remain protected
   * against duplicates by the
   * database.
   */
  deadlineMonitorTimer =
    setInterval(
      () => {
        void execute()
      },
      1 * 60 * 1000,
    )

  console.log(
    '[Deadline Monitor] Started (1 min interval)',
  )
}

export function stopDeadlineMonitor() {
  if (!deadlineMonitorTimer) {
    return
  }

  clearInterval(
    deadlineMonitorTimer,
  )

  deadlineMonitorTimer = null
}
