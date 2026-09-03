import {
  DateTime,
  Duration,
} from 'luxon'

export type DeadlineState =
  | 'NO_DEADLINE'
  | 'GREEN'
  | 'AMBER'
  | 'ORANGE'
  | 'RED'
  | 'CRITICAL'

export interface DeadlineInfo {
  state: DeadlineState
  minutesRemaining: number | null
  label: string
}

export function getDeadlineInfo(
  deadline: string | null,
  deadlineTime: string | null,
  timezone: string,
  workdayEnd = '18:00',
): DeadlineInfo {
  if (!deadline) {
    return {
      state: 'NO_DEADLINE',
      minutesRemaining: null,
      label: 'No deadline',
    }
  }

  const effectiveTime =
    deadlineTime || workdayEnd

  const deadlineAt = DateTime.fromISO(
    `${deadline}T${effectiveTime}`,
    {
      zone: timezone,
    },
  )

  if (!deadlineAt.isValid) {
    return {
      state: 'NO_DEADLINE',
      minutesRemaining: null,
      label: 'Invalid deadline',
    }
  }

  const now =
    DateTime.now().setZone(timezone)

  const minutesRemaining = Math.floor(
    deadlineAt.diff(
      now,
      'minutes',
    ).minutes,
  )

  if (minutesRemaining < 0) {
    const overdueMinutes =
      Math.abs(minutesRemaining)

    return {
      state: 'RED',
      minutesRemaining,
      label: formatRemaining(
        overdueMinutes,
        'overdue',
      ),
    }
  }

  if (minutesRemaining <= 60) {
    return {
      state: 'ORANGE',
      minutesRemaining,
      label: formatRemaining(
        minutesRemaining,
        'remaining',
      ),
    }
  }

  if (minutesRemaining <= 120) {
    return {
      state: 'AMBER',
      minutesRemaining,
      label: formatRemaining(
        minutesRemaining,
        'remaining',
      ),
    }
  }

  return {
    state: 'GREEN',
    minutesRemaining,
    label: formatRemaining(
      minutesRemaining,
      'remaining',
    ),
  }
}

function formatRemaining(
  minutes: number,
  suffix: 'remaining' | 'overdue',
) {
  const duration = Duration
    .fromObject({
      minutes,
    })
    .shiftTo('days', 'hours', 'minutes')
    .normalize()

  const days = Math.floor(
    duration.days,
  )

  const hours = Math.floor(
    duration.hours,
  )

  const mins = Math.floor(
    duration.minutes,
  )

  let value = ''

  if (days > 0) {
    value += `${days}d `
  }

  if (hours > 0) {
    value += `${hours}h `
  }

  value += `${mins}m`

  return `${value.trim()} ${suffix}`
}
