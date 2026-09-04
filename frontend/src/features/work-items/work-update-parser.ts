export interface ParsedWorkUpdate {
  workedToday: string
  completedWork: string
  blocker: string
  completedQuantity?: number | null
  cleanSummary: string
  hasStructuredData: boolean
}

/**
 * Strips raw template question strings and extracts structured fields
 * from either update_text or report_data.
 */
export function parseWorkUpdate(
  updateText?: string | null,
  reportData?: any,
): ParsedWorkUpdate {
  let workedToday = ''
  let completedWork = ''
  let blocker = ''
  let completedQuantity: number | null = null

  // 1. Check reportData if structured JSON was supplied
  if (reportData && typeof reportData === 'object') {
    workedToday = String(
      reportData.worked_today ||
        reportData.completed_today ||
        reportData.working_on_now ||
        reportData.notes ||
        reportData.what_did_you_work_on_today ||
        '',
    ).trim()

    completedWork = String(
      reportData.completed_work ||
        reportData.what_is_completed ||
        reportData.completed ||
        '',
    ).trim()

    blocker = String(
      reportData.blocker ||
        reportData.blockers ||
        reportData.blockers_next_steps ||
        reportData.any_blocker_next_step ||
        '',
    ).trim()

    if (reportData.actual_value !== undefined && reportData.actual_value !== null) {
      completedQuantity = Number(reportData.actual_value)
    } else if (reportData.videos_completed !== undefined && reportData.videos_completed !== null) {
      completedQuantity = Number(reportData.videos_completed)
    }
  }

  // 2. Parse text content if fields are still empty or if legacy template prompt strings were concatenated
  const raw = String(updateText || '').trim()

  if (raw) {
    // Check for "What did you work on today?", "What is completed?", "Any blocker / next step?"
    const pattern =
      /What did you work on today\?\s*([\s\S]*?)(?=What is completed\?|Any blocker \/ next step\?|$)/i
    const compPattern =
      /What is completed\?\s*([\s\S]*?)(?=Any blocker \/ next step\?|$)/i
    const blockPattern = /Any blocker \/ next step\?\s*([\s\S]*?)$/i

    const workedMatch = raw.match(pattern)
    const compMatch = raw.match(compPattern)
    const blockMatch = raw.match(blockPattern)

    if (workedMatch || compMatch || blockMatch) {
      if (workedMatch && !workedToday) workedToday = workedMatch[1].trim()
      if (compMatch && !completedWork) completedWork = compMatch[1].trim()
      if (blockMatch && !blocker) blocker = blockMatch[1].trim()
    } else {
      // Check for "Completed X / Y. Notes: ... Blocker: ..." format
      const summaryMatch = raw.match(
        /Completed\s+(\d+)\s*\/\s*(\d+)[^.]*\.\s*(?:Notes:\s*([\s\S]*?))?(?:Blocker:\s*([\s\S]*?))?$/i,
      )
      if (summaryMatch) {
        if (summaryMatch[1]) completedQuantity = Number(summaryMatch[1])
        if (summaryMatch[3] && !workedToday) workedToday = summaryMatch[3].trim()
        if (summaryMatch[4] && !blocker) blocker = summaryMatch[4].trim()
      } else if (!workedToday && !completedWork && !blocker) {
        // Plain text fallback (clean up any lone question prompts)
        workedToday = raw
          .replace(/What did you work on today\?/gi, '')
          .replace(/What is completed\?/gi, '')
          .replace(/Any blocker \/ next step\?/gi, '')
          .trim()
      }
    }
  }

  // Clean empty defaults
  if (workedToday.toLowerCase() === 'none' || workedToday.toLowerCase() === 'n/a') workedToday = ''
  if (completedWork.toLowerCase() === 'none' || completedWork.toLowerCase() === 'n/a') completedWork = ''
  if (
    blocker.toLowerCase() === 'none' ||
    blocker.toLowerCase() === 'n/a' ||
    blocker.toLowerCase() === 'no' ||
    blocker.toLowerCase() === 'nil'
  )
    blocker = ''

  const hasStructuredData = Boolean(
    workedToday || completedWork || blocker || completedQuantity !== null,
  )

  const parts = [
    workedToday,
    completedWork ? `Completed: ${completedWork}` : '',
    blocker ? `Blocker: ${blocker}` : '',
  ].filter(Boolean)

  const cleanSummary = parts.length > 0 ? parts.join('\n') : raw || 'Work progress update logged.'

  return {
    workedToday,
    completedWork,
    blocker,
    completedQuantity,
    cleanSummary,
    hasStructuredData,
  }
}

export { StructuredWorkUpdateCard } from './StructuredWorkUpdateCard'
