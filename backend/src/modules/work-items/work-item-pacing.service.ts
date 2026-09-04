export type WorkItemPacingStatus =
  | 'NOT_TRACKED'
  | 'SCHEDULED'
  | 'AHEAD'
  | 'ON_TRACK'
  | 'AT_RISK'
  | 'BEHIND'
  | 'WORKLOAD_INCREASING'
  | 'OVERDUE'
  | 'COMPLETED'

export type PacingInput = {
  status?: string | null
  target_quantity?: number | null
  completed_quantity?: number | null
  quantity_unit?: string | null

  pacing_start_date?: string | null
  start_date?: string | null

  deadline?: string | null
  deadline_time?: string | null

  pacing_enabled?: boolean | null
}

export type WorkItemPacingResult = {
  enabled: boolean
  status: WorkItemPacingStatus
  targetQuantity: number
  completedQuantity: number
  expectedQuantity: number
  todayTarget: number
  backlog: number
  isBacklog: boolean
  remainingQuantity: number
  progressPercent: number
  totalDays: number
  elapsedDays: number
  remainingDays: number
  initialPerDay: number
  requiredPerDay: number
  workloadIncreased: boolean
  recommendedIntervalDays: number | null
  recommendedPaceText: string
}

/**
 * Accurately distributes indivisible whole integer units across scheduled days
 * such that the sum of all daily allocations across totalDays exactly equals target.
 */
export function calculateWholeUnitDistribution(
  target: number,
  totalDays: number,
): { dailyTargets: number[]; cumulativeExpected: number[] } {
  if (totalDays <= 0 || target <= 0) {
    return { dailyTargets: [], cumulativeExpected: [] }
  }

  const base = Math.floor(target / totalDays)
  const remainder = target % totalDays

  const dailyTargets: number[] = []
  const cumulativeExpected: number[] = []
  let runningSum = 0

  for (let day = 1; day <= totalDays; day++) {
    // Distribute remainder units evenly across the first 'remainder' days
    const dayTarget = day <= remainder ? base + 1 : base
    runningSum += dayTarget
    dailyTargets.push(dayTarget)
    cumulativeExpected.push(runningSum)
  }

  return { dailyTargets, cumulativeExpected }
}

export function calculateWorkItemPacing(
  item: PacingInput,
  now = new Date(),
): WorkItemPacingResult {
  const target = Math.max(0, Math.floor(Number(item.target_quantity || 0)))
  const completed = Math.max(0, Math.floor(Number(item.completed_quantity || 0)))
  const unit = item.quantity_unit?.trim() || 'items'

  if (
    !item.pacing_enabled ||
    target <= 0 ||
    !item.deadline
  ) {
    return {
      enabled: false,
      status: 'NOT_TRACKED',
      targetQuantity: target,
      completedQuantity: completed,
      expectedQuantity: 0,
      todayTarget: 0,
      backlog: 0,
      isBacklog: false,
      remainingQuantity: Math.max(0, target - completed),
      progressPercent:
        target > 0
          ? Math.min(100, Math.round((completed / target) * 100))
          : 0,
      totalDays: 0,
      elapsedDays: 0,
      remainingDays: 0,
      initialPerDay: 0,
      requiredPerDay: 0,
      workloadIncreased: false,
      recommendedIntervalDays: null,
      recommendedPaceText: 'No scheduled pace',
    }
  }

  const startDateString =
    item.pacing_start_date ||
    item.start_date ||
    item.deadline

  const start = new Date(`${startDateString}T00:00:00`)
  const deadline = new Date(`${item.deadline}T23:59:59`)

  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  )

  const startDay = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  )

  const deadlineDay = new Date(
    deadline.getFullYear(),
    deadline.getMonth(),
    deadline.getDate(),
  )

  const millisecondsPerDay = 1000 * 60 * 60 * 24

  const totalDays = Math.max(
    1,
    Math.floor(
      (deadlineDay.getTime() - startDay.getTime()) / millisecondsPerDay,
    ) + 1,
  )

  const rawElapsedDays =
    Math.floor(
      (today.getTime() - startDay.getTime()) / millisecondsPerDay,
    ) + 1

  const elapsedDays = Math.max(
    0,
    Math.min(totalDays, rawElapsedDays),
  )

  const remainingDays =
    now.getTime() > deadline.getTime()
      ? 0
      : Math.max(
          0,
          Math.floor(
            (deadlineDay.getTime() - today.getTime()) / millisecondsPerDay,
          ) + 1,
        )

  // Whole-unit daily distribution
  const { dailyTargets, cumulativeExpected } = calculateWholeUnitDistribution(
    target,
    totalDays,
  )

  // Expected cumulative target by current elapsed day
  const expectedQuantity =
    elapsedDays > 0
      ? cumulativeExpected[Math.min(elapsedDays - 1, cumulativeExpected.length - 1)] || 0
      : 0

  // Today's scheduled daily target
  const todayTarget =
    elapsedDays > 0 && elapsedDays <= totalDays
      ? dailyTargets[elapsedDays - 1] || 0
      : 0

  const remainingQuantity = Math.max(0, target - completed)
  const backlog = Math.max(0, expectedQuantity - completed)
  const isBacklog = backlog > 0

  // Initial planned pace (units/day)
  const initialPerDay =
    totalDays > 0 ? Number((target / totalDays).toFixed(2)) : target

  // Recalculated required daily pace for remaining days
  const rawRequiredPerDay =
    remainingDays > 0
      ? remainingQuantity / remainingDays
      : remainingQuantity

  const requiredPerDay = Number(rawRequiredPerDay.toFixed(2))

  // Workload increase check (backlog pushes daily requirement significantly higher than initial plan)
  const workloadIncreased =
    remainingDays > 0 &&
    rawRequiredPerDay > (target / totalDays) + 0.05 &&
    backlog > 0 &&
    completed < target

  const progressPercent =
    target > 0
      ? Math.min(100, Math.round((completed / target) * 100))
      : 0

  // Human-readable recommendation text
  let recommendedIntervalDays: number | null = null
  let recommendedPaceText = ''

  if (target === 1 && totalDays === 1) {
    recommendedPaceText = `1 ${unit} today`
    recommendedIntervalDays = 1
  } else if (target === totalDays) {
    recommendedPaceText = `1 ${unit} per day over ${totalDays} scheduled days`
    recommendedIntervalDays = 1
  } else if (target > totalDays) {
    const rate = (target / totalDays).toFixed(1).replace(/\.0$/, '')
    recommendedPaceText = `${rate} ${unit} per day over ${totalDays} scheduled days`
    recommendedIntervalDays = Number((1 / (target / totalDays)).toFixed(2))
  } else {
    // target < totalDays (e.g., 2 videos over 10 days = 1 video every 5 days)
    const interval = Number((totalDays / target).toFixed(1).replace(/\.0$/, ''))
    recommendedIntervalDays = interval
    recommendedPaceText = `1 ${unit} every ${interval} days over ${totalDays} scheduled days`
  }

  // Logical Health & Pacing Status Determination
  let status: WorkItemPacingStatus

  if (now.getTime() > deadline.getTime() && completed < target) {
    status = 'OVERDUE'
  } else if (completed >= target) {
    status = 'COMPLETED'
  } else if (rawElapsedDays <= 0 || (elapsedDays === 0 && expectedQuantity === 0 && completed === 0)) {
    // Before start date or before work is scheduled to start
    status = 'SCHEDULED'
  } else if (completed > expectedQuantity) {
    status = 'AHEAD'
  } else if (completed === expectedQuantity) {
    status = 'ON_TRACK'
  } else {
    // completed < expectedQuantity
    if (workloadIncreased) {
      status = 'WORKLOAD_INCREASING'
    } else {
      const shortfall = expectedQuantity - completed
      const percentageBehind =
        expectedQuantity > 0 ? (shortfall / expectedQuantity) * 100 : 0

      if (percentageBehind >= 25 || shortfall >= 3) {
        status = 'BEHIND'
      } else {
        status = 'AT_RISK'
      }
    }
  }

  return {
    enabled: true,
    status,
    targetQuantity: target,
    completedQuantity: completed,
    expectedQuantity,
    todayTarget,
    backlog,
    isBacklog,
    remainingQuantity,
    progressPercent,
    totalDays,
    elapsedDays,
    remainingDays,
    initialPerDay,
    requiredPerDay,
    workloadIncreased,
    recommendedIntervalDays,
    recommendedPaceText,
  }
}

export function getPacingHealth(pacingStatus: WorkItemPacingStatus) {
  switch (pacingStatus) {
    case 'OVERDUE':
      return 'RED'
    case 'BEHIND':
      return 'CRITICAL'
    case 'WORKLOAD_INCREASING':
    case 'AT_RISK':
      return 'AMBER'
    case 'ON_TRACK':
    case 'AHEAD':
    case 'COMPLETED':
    case 'SCHEDULED':
      return 'GREEN'
    default:
      return null
  }
}

export function calculateQuantityProgress(
  completed: number,
  target: number,
) {
  if (target <= 0) return 0
  return Math.min(100, Math.round((completed / target) * 100))
}
