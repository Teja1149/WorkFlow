import type { ReactNode } from 'react'

export default function PageHeader({
  context = 'Organization overview',
  title,
  description,
  actions,
}: {
  context?: string
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
          {context}
        </p>

        <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">
          {title}
        </h1>

        {description && (
          <p className="mt-1.5 text-xs text-slate-500">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  )
}
