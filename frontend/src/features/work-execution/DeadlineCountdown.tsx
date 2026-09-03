import { useEffect, useState } from 'react'
import { Clock3 } from 'lucide-react'
import {
  getDeadlineInfo,
} from './deadline.utils'

interface Props {
  deadline: string | null
  deadlineTime: string | null
  timezone: string
  workdayEnd?: string
  health?: string
}

export default function DeadlineCountdown({
  deadline,
  deadlineTime,
  timezone,
  workdayEnd = '18:00',
  health,
}: Props) {
  const [, setTick] =
    useState(0)

  useEffect(() => {
    const interval =
      window.setInterval(
        () => setTick((value) => value + 1),
        60_000,
      )

    return () =>
      window.clearInterval(interval)
  }, [])

  const info =
    getDeadlineInfo(
      deadline,
      deadlineTime,
      timezone,
      workdayEnd,
    )

  if (
    info.state === 'NO_DEADLINE'
  ) {
    return (
      <span className="text-xs text-slate-400">
        No deadline
      </span>
    )
  }

  const effectiveState =
    health === 'CRITICAL'
      ? 'CRITICAL'
      : health === 'RED'
        ? 'RED'
        : info.state

  const classes = {
    GREEN:
      'text-emerald-700',
    AMBER:
      'text-amber-700',
    ORANGE:
      'text-orange-700',
    RED:
      'text-red-700',
    CRITICAL:
      'font-bold text-red-800',
  }[effectiveState]

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold ${classes}`}
    >
      <Clock3 className="h-3.5 w-3.5" />

      {deadlineTime
        ? `${deadline} ${deadlineTime}`
        : deadline}

      <span>·</span>

      {info.label}
    </span>
  )
}
