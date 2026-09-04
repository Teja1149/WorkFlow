import { DateTime } from 'luxon'

export type DeadlineState =
  | 'NORMAL'
  | 'WARNING'
  | 'CRITICAL'
  | 'URGENT'
  | 'FINAL_WARNING'
  | 'OVERDUE'

/**
 * Parses and combines deadline date and deadline time into a unified Date instance.
 * Defaults to 23:59:59.999 if time is omitted.
 * Preserves organizational calendar date avoiding timezone shifting issues.
 */
export function createDeadlineDateTime(
  deadlineDate: string | Date | null | undefined,
  deadlineTime?: string | null,
): Date | null {
  if (!deadlineDate) {
    return null
  }

  if (deadlineDate instanceof Date) {
    if (Number.isNaN(deadlineDate.getTime())) return null
    const cloned = new Date(deadlineDate.getTime())
    if (deadlineTime && typeof deadlineTime === 'string') {
      const parts = deadlineTime.split(':').map(Number)
      if (parts.length >= 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
        cloned.setHours(parts[0], parts[1], parts[2] || 0, 0)
        return cloned
      }
    }
    return cloned
  }

  const rawDateStr = String(deadlineDate).trim()
  if (!rawDateStr) return null

  // If contains 'T', parse full ISO
  if (rawDateStr.includes('T')) {
    const dt = DateTime.fromISO(rawDateStr)
    if (!dt.isValid) return null
    if (deadlineTime) {
      const parts = deadlineTime.split(':').map(Number)
      if (parts.length >= 2) {
        return dt.set({ hour: parts[0], minute: parts[1], second: parts[2] || 0, millisecond: 0 }).toJSDate()
      }
    }
    return dt.toJSDate()
  }

  // Date only format: YYYY-MM-DD
  const dateOnly = rawDateStr.slice(0, 10)
  const [year, month, day] = dateOnly.split('-').map(Number)

  if (!year || !month || !day || Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    const fallback = new Date(rawDateStr)
    return Number.isNaN(fallback.getTime()) ? null : fallback
  }

  let hour = 23
  let minute = 59
  let second = 59
  let millisecond = 999

  if (deadlineTime && typeof deadlineTime === 'string') {
    const parts = deadlineTime.split(':').map(Number)
    if (parts.length >= 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
      hour = parts[0]
      minute = parts[1]
      second = parts[2] || 0
      millisecond = 0
    }
  }

  const dt = DateTime.fromObject(
    { year, month, day, hour, minute, second, millisecond },
    { zone: 'local' },
  )

  return dt.isValid ? dt.toJSDate() : new Date(year, month - 1, day, hour, minute, second, millisecond)
}

/**
 * Calculates the deadline urgency state based on remaining time.
 * - OVERDUE: deadline has passed (< 0 ms)
 * - FINAL_WARNING: < 1 hour remaining
 * - URGENT: 1 to 6 hours remaining
 * - CRITICAL: 6 to 24 hours remaining
 * - WARNING: 24 to 48 hours remaining
 * - NORMAL: > 48 hours remaining
 */
export function getDeadlineState(
  deadline: Date | string | null | undefined,
  now: Date = new Date(),
): DeadlineState {
  if (!deadline) {
    return 'NORMAL'
  }

  const deadlineDate = deadline instanceof Date ? deadline : new Date(deadline)
  if (Number.isNaN(deadlineDate.getTime())) {
    return 'NORMAL'
  }

  const remainingMs = deadlineDate.getTime() - now.getTime()

  if (remainingMs < 0) {
    return 'OVERDUE'
  }

  const remainingHours = remainingMs / (1000 * 60 * 60)

  if (remainingHours < 1) {
    return 'FINAL_WARNING'
  }

  if (remainingHours < 6) {
    return 'URGENT'
  }

  if (remainingHours < 24) {
    return 'CRITICAL'
  }

  if (remainingHours < 48) {
    return 'WARNING'
  }

  return 'NORMAL'
}

/**
 * Helper to check if deadline has passed.
 */
export function isDeadlineOverdue(
  deadline: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!deadline) return false
  const deadlineDate = deadline instanceof Date ? deadline : new Date(deadline)
  if (Number.isNaN(deadlineDate.getTime())) return false
  return deadlineDate.getTime() < now.getTime()
}

/**
 * Returns hours remaining until deadline (negative if overdue).
 */
export function getRemainingHours(
  deadline: Date | string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!deadline) return null
  const deadlineDate = deadline instanceof Date ? deadline : new Date(deadline)
  if (Number.isNaN(deadlineDate.getTime())) return null
  return (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60)
}
