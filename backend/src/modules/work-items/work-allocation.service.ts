import { DateTime } from 'luxon'

export interface SplitAllocationResult {
  employeeId: string
  quantity: number
}

export interface AllocationValidationResult {
  isValid: boolean
  allocatedTotal: number
  targetQuantity: number
  difference: number
  message: string
}

export interface InternalMilestone {
  index: number
  name: string
  targetQuantity: number
  expectedDate: string
  daysFromStart: number
}

/**
 * Splits a total quantity equally across employees, handling remainders gracefully.
 * Example: 10 units / 3 employees -> [4, 3, 3]
 * Example: 15 units / 3 employees -> [5, 5, 5]
 */
export function splitQuantity(
  totalQuantity: number,
  employeeIds: string[],
): SplitAllocationResult[] {
  if (!employeeIds.length) return []
  if (totalQuantity <= 0) {
    return employeeIds.map((employeeId) => ({ employeeId, quantity: 0 }))
  }

  const base = Math.floor(totalQuantity / employeeIds.length)
  const remainder = totalQuantity % employeeIds.length

  return employeeIds.map((employeeId, index) => ({
    employeeId,
    quantity: base + (index < remainder ? 1 : 0),
  }))
}

/**
 * Validates manual or automated allocations against the target quantity.
 */
export function validateAllocation(
  targetQuantity: number,
  allocations: Array<{ employeeId?: string; employee_id?: string; quantity?: number; allocated_value?: number }>,
): AllocationValidationResult {
  const target = Math.max(0, Math.floor(Number(targetQuantity) || 0))
  const allocatedTotal = allocations.reduce((sum, item) => {
    const qty = Number(item.quantity ?? item.allocated_value ?? 0)
    return sum + (Number.isNaN(qty) ? 0 : Math.max(0, Math.floor(qty)))
  }, 0)

  const difference = allocatedTotal - target

  if (difference === 0) {
    return {
      isValid: true,
      allocatedTotal,
      targetQuantity: target,
      difference: 0,
      message: 'Valid allocation.',
    }
  }

  if (difference < 0) {
    const unallocated = Math.abs(difference)
    return {
      isValid: false,
      allocatedTotal,
      targetQuantity: target,
      difference,
      message: `${unallocated} unit${unallocated === 1 ? '' : 's'} remain${unallocated === 1 ? 's' : ''} unallocated.`,
    }
  }

  return {
    isValid: false,
    allocatedTotal,
    targetQuantity: target,
    difference,
    message: `Allocated quantity exceeds the target by ${difference}.`,
  }
}

/**
 * Calculates internal milestones and milestone dates for a target quantity.
 * Formula:
 * Interval = Total Duration / Quantity
 * Milestone N = Start + (Interval * N)
 */
export function calculateMilestones(
  targetQuantity: number,
  startDate: string,
  endDate: string,
  unitLabel = 'Unit',
): InternalMilestone[] {
  const qty = Math.max(1, Math.floor(Number(targetQuantity) || 1))
  const start = DateTime.fromISO(startDate).startOf('day')
  const end = DateTime.fromISO(endDate).startOf('day')

  if (!start.isValid || !end.isValid || end <= start) {
    return [
      {
        index: 1,
        name: `${unitLabel} 1`,
        targetQuantity: qty,
        expectedDate: endDate,
        daysFromStart: 0,
      },
    ]
  }

  const totalDays = Math.max(1, Math.ceil(end.diff(start, 'days').days))
  const intervalDays = totalDays / qty
  const milestones: InternalMilestone[] = []

  for (let i = 1; i <= qty; i++) {
    const offsetDays = Math.round(intervalDays * i)
    const expectedDate = start.plus({ days: offsetDays }).toISODate() || endDate

    milestones.push({
      index: i,
      name: `${unitLabel} ${i}`,
      targetQuantity: i,
      expectedDate: expectedDate > endDate ? endDate : expectedDate,
      daysFromStart: offsetDays,
    })
  }

  return milestones
}

/**
 * Computes elapsed timeline percentage and expected progress quantity.
 * Expected Quantity = Target Quantity * Elapsed Timeline Percentage
 */
export function calculateExpectedProgress(
  targetQuantity: number,
  startDate: string,
  endDate: string,
  completedQuantity = 0,
  asOfDate?: string,
): {
  elapsedPercent: number
  expectedQuantity: number
  completedQuantity: number
  pacingStatus: 'AHEAD' | 'ON_TRACK' | 'BEHIND_TARGET'
  health: 'GREEN' | 'AMBER' | 'RED'
} {
  const target = Math.max(0, Number(targetQuantity) || 0)
  const completed = Math.max(0, Number(completedQuantity) || 0)

  const start = DateTime.fromISO(startDate).startOf('day')
  const end = DateTime.fromISO(endDate).startOf('day')
  const current = asOfDate ? DateTime.fromISO(asOfDate).startOf('day') : DateTime.now().startOf('day')

  if (!start.isValid || !end.isValid || end <= start || target === 0) {
    return {
      elapsedPercent: 0,
      expectedQuantity: 0,
      completedQuantity: completed,
      pacingStatus: completed >= target ? 'ON_TRACK' : 'ON_TRACK',
      health: 'GREEN',
    }
  }

  const totalDays = Math.max(1, Math.ceil(end.diff(start, 'days').days))
  const elapsedDays = Math.max(0, Math.min(totalDays, Math.ceil(current.diff(start, 'days').days)))
  const elapsedPercent = Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100)))

  const expectedQuantity = Math.min(target, Math.round((target * (elapsedPercent / 100)) * 10) / 10)

  let pacingStatus: 'AHEAD' | 'ON_TRACK' | 'BEHIND_TARGET' = 'ON_TRACK'
  let health: 'GREEN' | 'AMBER' | 'RED' = 'GREEN'

  if (completed >= target) {
    pacingStatus = 'AHEAD'
    health = 'GREEN'
  } else if (completed >= expectedQuantity + 0.5) {
    pacingStatus = 'AHEAD'
    health = 'GREEN'
  } else if (completed < expectedQuantity - 0.5) {
    pacingStatus = 'BEHIND_TARGET'
    health = completed < expectedQuantity * 0.6 ? 'RED' : 'AMBER'
  } else {
    pacingStatus = 'ON_TRACK'
    health = 'GREEN'
  }

  return {
    elapsedPercent,
    expectedQuantity,
    completedQuantity: completed,
    pacingStatus,
    health,
  }
}

/**
 * Aggregates child work items to determine project-level total progress.
 */
export function calculateProjectTotalProgress(
  items: Array<{
    quantity_target?: number | null
    target_quantity?: number | null
    completed_quantity?: number | null
    quantity_completed?: number | null
    progress_percent?: number | null
    status?: string | null
  }>,
): {
  totalTarget: number
  totalCompleted: number
  progressPercent: number
  totalItems: number
  completedItems: number
} {
  let totalTarget = 0
  let totalCompleted = 0
  let completedItems = 0

  for (const item of items) {
    const target = Number(item.target_quantity ?? item.quantity_target ?? 1)
    const completed = Number(
      item.completed_quantity ??
        item.quantity_completed ??
        (item.status === 'DONE' ? target : Math.round((target * Number(item.progress_percent || 0)) / 100)),
    )

    totalTarget += Math.max(1, target)
    totalCompleted += Math.max(0, Math.min(target, completed))

    if (item.status === 'DONE' || completed >= target) {
      completedItems++
    }
  }

  const progressPercent = totalTarget > 0 ? Math.min(100, Math.round((totalCompleted / totalTarget) * 100)) : 0

  return {
    totalTarget,
    totalCompleted,
    progressPercent,
    totalItems: items.length,
    completedItems,
  }
}
