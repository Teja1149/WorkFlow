import type { ReactNode } from 'react'

export default function SectionCard({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-100 p-5">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            {title}
          </h2>

          {subtitle && (
            <p className="mt-0.5 text-xs text-slate-500">
              {subtitle}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>

      <div className="p-5">{children}</div>
    </div>
  )
}
