export type Health = 'GREEN' | 'AMBER' | 'ORANGE' | 'RED' | 'CRITICAL'

export default function HealthBadge({
  health,
  customLabel,
}: {
  health: Health | string
  customLabel?: string
}) {
  const config = {
    GREEN: {
      label: 'On Track',
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    AMBER: {
      label: 'Attention',
      className: 'bg-amber-50 text-amber-700 border-amber-200 font-semibold',
    },
    ORANGE: {
      label: 'At Risk',
      className: 'bg-orange-50 text-orange-700 border-orange-200 font-semibold',
    },
    RED: {
      label: 'Overdue',
      className: 'bg-red-50 text-red-700 border-red-200 font-bold',
    },
    CRITICAL: {
      label: 'Critical',
      className: 'bg-red-100 text-red-800 border-red-300 font-bold animate-pulse',
    },
  }[(health as Health) || 'GREEN'] || {
    label: health || 'On Track',
    className: 'bg-slate-100 text-slate-700 border-slate-200',
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] ${config.className}`}
    >
      {customLabel || config.label}
    </span>
  )
}
