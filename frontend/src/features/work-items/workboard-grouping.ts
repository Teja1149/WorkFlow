import type { WorkItem } from './work-item.service'

export type EmployeeWorkGroup = {
  employeeId: string
  workItems: WorkItem[]
}

export function groupWorkByEmployee(
  workItems: WorkItem[],
) {
  const grouped = new Map<
    string,
    WorkItem[]
  >()

  for (const item of workItems) {
    if (!item.assigned_to) {
      continue
    }

    const existing =
      grouped.get(item.assigned_to) || []

    existing.push(item)

    grouped.set(
      item.assigned_to,
      existing,
    )
  }

  return grouped
}
