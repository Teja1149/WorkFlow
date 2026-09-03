import {
  runOrganizationExecutionCycle,
} from '../modules/work-execution/work-execution.service.js'

let running = false

export async function runWorkExecutionJob() {
  if (running) {
    console.log(
      '[WorkExecution] Previous cycle still running. Skipping.',
    )
    return
  }

  running = true

  try {
    console.log(
      `[WorkExecution] Starting cycle at ${new Date().toISOString()}`,
    )

    const result =
      await runOrganizationExecutionCycle()

    console.log(
      `[WorkExecution] Finished cycle at ${new Date().toISOString()}:`,
      JSON.stringify(result),
    )
  } catch (error) {
    console.error(
      '[WorkExecution] Cycle failed:',
      error,
    )
  } finally {
    running = false
  }
}
