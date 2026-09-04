import type { WorkItem } from './work-item.service'

export type WorkCategory =
  | 'OVERDUE'
  | 'CRITICAL'
  | 'TODAY'
  | 'UPCOMING'
  | 'COMPLETED'

function getDateOnly(
  value?: string | null,
) {
  if (!value) {
    return null
  }

  const date = new Date(
    `${value}T00:00:00`,
  )

  return Number.isNaN(
    date.getTime(),
  )
    ? null
    : date
}

export function classifyWorkItem(
  item: WorkItem,
): WorkCategory {
  const now = new Date()

  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  )

  if (item.status === 'DONE') {
    return 'COMPLETED'
  }

  const deadline = getDateOnly(
    item.deadline,
  )

  const startDate = getDateOnly(
    item.start_date,
  )

  /*
   * Overdue
   */
  if (
    deadline &&
    deadline < today
  ) {
    return 'OVERDUE'
  }

  /*
   * Critical work
   */
  if (
    item.health === 'RED' ||
    item.health === 'CRITICAL' ||
    Number((item as any).escalation_level || 0) >= 2 ||
    item.pacing?.status === 'OVERDUE' ||
    item.pacing?.status === 'BEHIND'
  ) {
    return 'CRITICAL'
  }

  /*
   * Today's work
   */
  if (deadline) {
    const isDueToday =
      deadline.getTime() ===
      today.getTime()

    const isActiveToday =
      Boolean(startDate &&
      startDate <= today &&
      deadline >= today)

    if (
      isDueToday ||
      isActiveToday
    ) {
      return 'TODAY'
    }
  }

  /*
   * Future work
   */
  return 'UPCOMING'
}

export function groupEmployeeWork(
  workItems: WorkItem[],
) {
  const groups = {
    overdue: [] as WorkItem[],
    critical: [] as WorkItem[],
    today: [] as WorkItem[],
    upcoming: [] as WorkItem[],
    completed: [] as WorkItem[],
  }

  for (const item of workItems) {
    const category =
      classifyWorkItem(item)

    switch (category) {
      case 'OVERDUE':
        groups.overdue.push(item)
        break

      case 'CRITICAL':
        groups.critical.push(item)
        break

      case 'TODAY':
        groups.today.push(item)
        break

      case 'UPCOMING':
        groups.upcoming.push(item)
        break

      case 'COMPLETED':
        groups.completed.push(item)
        break
    }
  }

  return groups
}

export function sortWorkByUrgency(
  items: WorkItem[],
) {
  return [...items].sort(
    (a, b) => {
      const getScore = (
        item: WorkItem,
      ) => {
        if (
          item.health === 'RED'
        ) {
          return 1000
        }

        if (
          item.health ===
          'CRITICAL'
        ) {
          return 900
        }

        if (
          item.pacing?.status ===
          'OVERDUE'
        ) {
          return 950
        }

        if (
          item.pacing?.status ===
          'BEHIND'
        ) {
          return 850
        }

        if (
          item.priority ===
          'URGENT'
        ) {
          return 800
        }

        if (
          item.priority ===
          'HIGH'
        ) {
          return 700
        }

        if (item.deadline) {
          const deadline =
            new Date(
              `${item.deadline}T${
                item.deadline_time ||
                '23:59:59'
              }`,
            )

          const remaining =
            deadline.getTime() -
            Date.now()

          const hours =
            remaining /
            (1000 * 60 * 60)

          if (hours <= 1) {
            return 950
          }

          if (hours <= 6) {
            return 850
          }

          if (hours <= 24) {
            return 750
          }
        }

        return 0
      }

      return (
        getScore(b) -
        getScore(a)
      )
    },
  )
}
