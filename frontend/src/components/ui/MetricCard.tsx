export default function MetricCard({
  label,
  value,
  subtitle,
  icon: Icon,
}: {
  label: string
  value: string | number
  subtitle?: string
  icon?: any
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
          {label}
        </p>
        {Icon && (
          <div className="rounded-xl bg-slate-100 p-2 text-slate-600">
            <Icon size={16} />
          </div>
        )}
      </div>

      <p className="mt-2 text-2xl font-extrabold text-slate-900">
        {value}
      </p>

      {subtitle && (
        <p className="mt-1 text-xs font-medium text-slate-500">
          {subtitle}
        </p>
      )}
    </div>
  )
}
