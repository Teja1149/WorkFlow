import type { ReactNode } from 'react'
import { CircleDot } from 'lucide-react'

export default function EmptyState({
  title = 'No items found',
  description = 'Everything is currently on track.',
  action,
}: {
  title?: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-xs">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <CircleDot size={24} />
      </div>

      <h3 className="mt-4 text-base font-semibold text-slate-900">
        {title}
      </h3>

      <p className="mt-1 text-xs text-slate-500">
        {description}
      </p>

      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
