export type Status =
  | 'TODO'
  | 'IN_PROGRESS'
  | 'BLOCKED'
  | 'DONE'

export default function StatusBadge({
  status,
}: {
  status: Status | string
}) {
  const config = {
    TODO: {
      label: 'To Do',
      className: 'border-slate-200 bg-slate-50 text-slate-600',
    },
    IN_PROGRESS: {
      label: 'In Progress',
      className: 'border-blue-200 bg-blue-50 text-blue-700 font-semibold',
    },
    BLOCKED: {
      label: 'Blocked',
      className: 'border-amber-200 bg-amber-50 text-amber-700 font-semibold',
    },
    DONE: {
      label: 'Completed',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700 font-semibold',
    },
  }[(status as Status) || 'TODO'] || {
    label: status || 'To Do',
    className: 'border-slate-200 bg-slate-50 text-slate-600',
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${config.className}`}
    >
      {config.label}
    </span>
  )
}
