import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
} from 'lucide-react'
import type { DailyTarget } from './daily-target.types'
import {
  formatTargetValue,
  targetAchievement,
  targetRemaining,
  resultReasonLabel,
} from './daily-target.ui'

interface Props {
  target: DailyTarget
  showEmployee?: boolean
  showActions?: boolean
  onUpdate?: () => void
  onView?: () => void
}

export default function DailyTargetCard({
  target,
  showEmployee = false,
  showActions = false,
  onUpdate,
  onView,
}: Props) {
  const achievement =
    targetAchievement(
      target.target_value,
      target.actual_value,
    )

  const remaining =
    targetRemaining(
      target.target_value,
      target.actual_value,
    )

  const completed =
    target.status === 'COMPLETED'

  const carried =
    Boolean(
      target.carried_forward_from,
    )

  const currentHealth = target.health || 'GREEN'

  const healthClass = {
    GREEN:
      'bg-emerald-50 text-emerald-700 border-emerald-200',
    AMBER:
      'bg-amber-50 text-amber-700 border-amber-200',
    ORANGE:
      'bg-orange-50 text-orange-700 border-orange-200',
    RED:
      'bg-red-50 text-red-700 border-red-200',
    CRITICAL:
      'bg-red-100 text-red-800 border-red-300',
  }[currentHealth]

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-slate-300">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {completed ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : carried ? (
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            ) : (
              <Clock3 className="h-4 w-4 text-slate-400" />
            )}

            <h3 className="font-bold text-slate-900 text-sm">
              {target.title}
            </h3>

            {carried && (
              <span className="rounded-full bg-orange-50 border border-orange-200 px-2 py-0.5 text-[10px] font-bold text-orange-800">
                Carried Forward
              </span>
            )}
          </div>

          <p className="mt-1 text-xs text-slate-500 font-medium">
            {target.projects?.name || 'General Work'}
            {target.project_modules?.name && ` · ${target.project_modules.name}`}
            {target.project_milestones?.name && ` · ${target.project_milestones.name}`}
            {target.sprints?.name && ` · ${target.sprints.name}`}
          </p>

          {showEmployee && target.employee && (
            <p className="mt-2 text-xs font-semibold text-slate-700">
              {target.employee.first_name} {target.employee.last_name || ''}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600 uppercase">
            {target.status}
          </span>

          <span
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase ${healthClass}`}
          >
            {currentHealth}
          </span>
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase font-mono text-slate-400">
            Output Progress
          </p>

          <p className="mt-0.5 text-lg font-extrabold text-slate-900">
            {formatTargetValue(
              target.actual_value,
              target.unit,
            )}
            <span className="mx-1.5 text-slate-300 font-normal">
              /
            </span>
            {formatTargetValue(
              target.target_value,
              target.unit,
            )}
          </p>
        </div>

        <span className="text-xl font-black text-[#801424]">
          {achievement}%
        </span>
      </div>

      <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-[#801424] transition-all"
          style={{
            width: `${achievement}%`,
          }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-slate-500 font-medium">
        <span>
          {remaining > 0
            ? `${remaining} ${target.unit || 'units'} remaining`
            : 'Target achieved'}
        </span>

        <span>
          Deadline: {target.deadline_time || 'End of day'}
        </span>
      </div>

      {target.result_reason && (
        <div className="mt-3 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-xs text-slate-600">
          <span className="font-bold text-slate-800">
            Reason:
          </span>{' '}
          {resultReasonLabel(target.result_reason)}
        </div>
      )}

      {target.result_note && (
        <p className="mt-2 text-xs leading-5 text-slate-500 italic">
          "{target.result_note}"
        </p>
      )}

      {showActions && (
        <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end gap-2">
          {onView && (
            <button
              type="button"
              onClick={onView}
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs cursor-pointer"
            >
              View
            </button>
          )}

          {!completed && onUpdate && (
            <button
              type="button"
              onClick={onUpdate}
              className="rounded-xl bg-[#801424] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#9f1239] shadow-xs cursor-pointer"
            >
              Update Result
            </button>
          )}
        </div>
      )}
    </article>
  )
}
