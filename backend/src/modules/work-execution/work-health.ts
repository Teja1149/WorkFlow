import { DateTime } from 'luxon'

export type WorkHealth =
  | 'GREEN'
  | 'AMBER'
  | 'ORANGE'
  | 'RED'
  | 'CRITICAL'

export function healthRank(health: WorkHealth | string) {
  switch (health) {
    case 'CRITICAL':
      return 5
    case 'RED':
      return 4
    case 'ORANGE':
      return 3
    case 'AMBER':
      return 2
    default:
      return 1
  }
}

export interface WorkHealthResult {
  health: WorkHealth
  escalationLevel: number
  minutesRemaining: number | null
}

export function calculateWorkHealth(
  deadline: string | null,
  deadlineTime: string | null,
  progressPercent: number,
  status: string,
  warningMinutes: number,
  atRiskMinutes: number,
  timezone: string,
  workdayEnd: string,
  completedAt?: string | null,
): WorkHealthResult {
  if (status === 'DONE') {
    if (!deadline) {
      return {
        health: 'GREEN',
        escalationLevel: 0,
        minutesRemaining: 0,
      }
    }
    const effectiveTime = deadlineTime || workdayEnd
    const deadlineDate = DateTime.fromISO(`${deadline}T${effectiveTime}`, {
      zone: timezone,
    })
    if (completedAt) {
      const completed = DateTime.fromISO(completedAt, { zone: timezone })
      return {
        health: completed <= deadlineDate ? 'GREEN' : 'RED',
        escalationLevel: 0,
        minutesRemaining: 0,
      }
    }
    return {
      health: 'GREEN',
      escalationLevel: 0,
      minutesRemaining: 0,
    }
  }

  if (!deadline) {
    return {
      health: 'GREEN',
      escalationLevel: 0,
      minutesRemaining: null,
    }
  }

  const effectiveTime = deadlineTime || workdayEnd

  const deadlineDate = DateTime.fromISO(
    `${deadline}T${effectiveTime}`,
    {
      zone: timezone,
    },
  )

  const now = DateTime.now().setZone(timezone)

  const minutesRemaining = Math.floor(
    deadlineDate.diff(now, 'minutes').minutes,
  )

  if (minutesRemaining < 0) {
    return {
      health: 'RED',
      escalationLevel: 3,
      minutesRemaining,
    }
  }

  if (
    progressPercent <= 25 &&
    minutesRemaining <= atRiskMinutes
  ) {
    return {
      health: 'ORANGE',
      escalationLevel: 2,
      minutesRemaining,
    }
  }

  if (minutesRemaining <= warningMinutes) {
    return {
      health: 'AMBER',
      escalationLevel: 1,
      minutesRemaining,
    }
  }

  return {
    health: 'GREEN',
    escalationLevel: 0,
    minutesRemaining,
  }
}

export type RootCause =
  | 'DELAYED'
  | 'BLOCKED'
  | 'CAPACITY'
  | 'DEPENDENCY'
  | 'APPROVAL'
  | 'DEADLINE'
  | null

export function calculateRootCause(item: {
  status?: string | null
  health?: WorkHealth | string | null
  has_dependency_block?: boolean | null
  has_active_concern?: boolean | null
  carry_forward_count?: number | null
}): RootCause {
  if (item.status === 'BLOCKED' || item.has_dependency_block) {
    return 'DEPENDENCY'
  }

  if (item.has_active_concern) {
    return 'BLOCKED'
  }

  if (Number(item.carry_forward_count || 0) > 1) {
    return 'CAPACITY'
  }

  if (item.health === 'RED' || item.health === 'CRITICAL') {
    return 'DEADLINE'
  }

  if (item.health === 'AMBER' || item.health === 'ORANGE') {
    return 'DELAYED'
  }

  return null
}
