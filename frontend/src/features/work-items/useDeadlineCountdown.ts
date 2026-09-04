import {
  useEffect,
  useState,
} from 'react'

function getDeadlineTimestamp(
  deadline?: string | null,
  deadlineTime?: string | null,
) {
  if (!deadline) {
    return null
  }

  const value = new Date(
    `${deadline}T${
      deadlineTime || '23:59:59'
    }`,
  )

  const timestamp =
    value.getTime()

  return Number.isNaN(timestamp)
    ? null
    : timestamp
}

function calculateCountdown(
  deadline?: string | null,
  deadlineTime?: string | null,
) {
  const timestamp =
    getDeadlineTimestamp(
      deadline,
      deadlineTime,
    )

  if (!timestamp) {
    return {
      hasDeadline: false,
      isOverdue: false,
      totalSeconds: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    }
  }

  const difference =
    timestamp - Date.now()

  const isOverdue =
    difference < 0

  const totalSeconds =
    Math.max(
      0,
      Math.floor(
        Math.abs(difference) / 1000,
      ),
    )

  const days =
    Math.floor(
      totalSeconds /
        (60 * 60 * 24),
    )

  const hours =
    Math.floor(
      (totalSeconds %
        (60 * 60 * 24)) /
        (60 * 60),
    )

  const minutes =
    Math.floor(
      (totalSeconds %
        (60 * 60)) /
        60,
    )

  const seconds =
    totalSeconds % 60

  return {
    hasDeadline: true,
    isOverdue,
    totalSeconds,
    days,
    hours,
    minutes,
    seconds,
  }
}

export function useDeadlineCountdown(
  deadline?: string | null,
  deadlineTime?: string | null,
) {
  const [countdown, setCountdown] =
    useState(() =>
      calculateCountdown(
        deadline,
        deadlineTime,
      ),
    )

  useEffect(() => {
    setCountdown(
      calculateCountdown(
        deadline,
        deadlineTime,
      ),
    )

    const timer =
      window.setInterval(() => {
        setCountdown(
          calculateCountdown(
            deadline,
            deadlineTime,
          ),
        )
      }, 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [
    deadline,
    deadlineTime,
  ])

  return countdown
}

export function getWorkUrgencyScore(
  item: {
    health?: string | null
    priority?: string | null
    deadline?: string | null
    deadline_time?: string | null
  },
) {
  if (item.health === 'RED') {
    return 1000
  }

  if (item.health === 'CRITICAL') {
    return 900
  }

  if (item.priority === 'URGENT') {
    return 800
  }

  if (item.priority === 'HIGH') {
    return 700
  }

  if (item.deadline) {
    const deadline = new Date(
      `${item.deadline}T${
        item.deadline_time ||
        '23:59:59'
      }`,
    )

    const hoursRemaining =
      (deadline.getTime() -
        Date.now()) /
      (1000 * 60 * 60)

    if (hoursRemaining <= 1) {
      return 950
    }

    if (hoursRemaining <= 6) {
      return 850
    }

    if (hoursRemaining <= 24) {
      return 750
    }
  }

  return 0
}
