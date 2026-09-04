import type { DeadlineState } from './work-deadline.utils.js'

export type WorkHealthStatus = 'GREEN' | 'AMBER' | 'RED' | 'CRITICAL'

export interface WorkHealthInput {
  status: string
  deadlineState?: DeadlineState | string | null
  pacingStatus?: string | null
  priority?: string | null
  escalationLevel?: number | null
}

/**
 * Calculates work health dynamically based on status, deadline state, pacing, and escalation.
 * Rules:
 * - DONE -> GREEN
 * - BLOCKED -> RED
 * - OVERDUE / FINAL_WARNING / URGENT -> RED
 * - BEHIND_TARGET / BEHIND / CRITICAL / WARNING -> AMBER
 * - NORMAL -> GREEN
 */
export function calculateWorkHealth(input: WorkHealthInput): 'GREEN' | 'AMBER' | 'RED' {
  const status = (input.status || '').toUpperCase()
  const deadlineState = (input.deadlineState || '').toUpperCase()
  const pacingStatus = (input.pacingStatus || '').toUpperCase()

  // Completed work is always healthy
  if (status === 'DONE' || status === 'COMPLETED') {
    return 'GREEN'
  }

  // Blocked tasks require urgent intervention
  if (status === 'BLOCKED') {
    return 'RED'
  }

  // Overdue, final warning, or urgent deadline states are critical red
  if (
    deadlineState === 'OVERDUE' ||
    deadlineState === 'FINAL_WARNING' ||
    deadlineState === 'URGENT'
  ) {
    return 'RED'
  }

  // Escalated tasks (level 2+) are marked RED
  if (Number(input.escalationLevel || 0) >= 2) {
    return 'RED'
  }

  // Tasks behind target pacing or in critical/warning window
  if (
    pacingStatus === 'BEHIND' ||
    pacingStatus === 'BEHIND_TARGET' ||
    deadlineState === 'CRITICAL' ||
    deadlineState === 'WARNING'
  ) {
    return 'AMBER'
  }

  return 'GREEN'
}
