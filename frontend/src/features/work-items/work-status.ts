export const WORK_STATUS = {
  TODO: {
    label: 'To Do',
    dot: 'bg-slate-400',
    badge: 'bg-slate-50 text-slate-600 border-slate-200',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    dot: 'bg-blue-500',
    badge: 'bg-blue-50 text-blue-700 border-blue-200 font-semibold',
  },
  BLOCKED: {
    label: 'Blocked',
    dot: 'bg-amber-500',
    badge: 'bg-amber-50 text-amber-700 border-amber-200 font-semibold',
  },
  DONE: {
    label: 'Completed',
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold',
  },
} as const

export type WorkStatusKey = keyof typeof WORK_STATUS

export function getWorkStatusConfig(status?: string | null) {
  const key = (status as WorkStatusKey) || 'TODO'
  return (
    WORK_STATUS[key] || {
      label: status || 'To Do',
      dot: 'bg-slate-400',
      badge: 'bg-slate-50 text-slate-600 border-slate-200',
    }
  )
}
