import React from 'react'
import { AlertTriangle } from 'lucide-react'
import { parseWorkUpdate, type ParsedWorkUpdate } from './work-update-parser'

export { parseWorkUpdate, type ParsedWorkUpdate }

/**
 * Clean UI Card for rendering a work update with proper structured sections, badges, and empty states.
 */
export function StructuredWorkUpdateCard({
  update,
  unit = 'Items',
}: {
  update: {
    id: string
    created_at: string
    update_text: string
    report_data?: any
    actual_value?: number | null
    employee?: {
      first_name?: string
      last_name?: string | null
    }
    user?: {
      first_name?: string
      last_name?: string | null
    }
  }
  unit?: string
}) {
  const parsed = parseWorkUpdate(update.update_text, update.report_data)
  const employeeName =
    update.employee
      ? `${update.employee.first_name || ''} ${update.employee.last_name || ''}`.trim()
      : update.user
      ? `${update.user.first_name || ''} ${update.user.last_name || ''}`.trim()
      : 'Team Member'

  const actualQty =
    update.actual_value !== undefined && update.actual_value !== null
      ? update.actual_value
      : parsed.completedQuantity

  return (
    <div className="p-4 border border-slate-100 rounded-xl bg-slate-50/70 space-y-3 text-xs shadow-2xs hover:bg-slate-50 transition">
      {/* Header with Employee Name, Timestamp, and Completed Quantity Badge */}
      <div className="flex items-center justify-between border-b border-slate-200/50 pb-2">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-900">{employeeName}</span>
          {actualQty !== null && actualQty !== undefined && (
            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
              ✓ {actualQty} {unit}
            </span>
          )}
        </div>
        <span className="text-slate-400 text-[11px] font-mono">
          {new Date(update.created_at).toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>

      {/* Structured Sections */}
      <div className="space-y-2 text-slate-700">
        {parsed.workedToday && (
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono block">
              Work Completed / Worked On:
            </span>
            <p className="text-slate-800 font-medium whitespace-pre-wrap leading-relaxed">
              {parsed.workedToday}
            </p>
          </div>
        )}

        {parsed.completedWork && (
          <div className="bg-white/80 p-2.5 rounded-lg border border-slate-200/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 font-mono block">
              Deliverables Completed:
            </span>
            <p className="text-slate-800 font-semibold whitespace-pre-wrap">
              {parsed.completedWork}
            </p>
          </div>
        )}

        {parsed.blocker && (
          <div className="bg-rose-50/80 p-2.5 rounded-lg border border-rose-200 text-rose-900">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 font-mono flex items-center gap-1">
              <AlertTriangle size={12} />
              Blockers / Next Steps:
            </span>
            <p className="font-semibold whitespace-pre-wrap mt-0.5">{parsed.blocker}</p>
          </div>
        )}

        {!parsed.workedToday && !parsed.completedWork && !parsed.blocker && (
          <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
            {parsed.cleanSummary}
          </p>
        )}
      </div>
    </div>
  )
}
