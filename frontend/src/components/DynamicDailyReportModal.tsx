import { useEffect, useState } from 'react'
import { CheckCircle2, Target, X, AlertCircle } from 'lucide-react'
import { useAuth } from '../features/auth/AuthContext'
import type { DailyTarget } from '../features/daily-targets/daily-target.types'
import { updateDailyTargetResult } from '../features/daily-targets/daily-target.service'
import type { ReportFieldDefinition, WorkType } from '../features/work-types/work-type.types'

interface Props {
  isOpen: boolean
  target: DailyTarget | null
  workType?: WorkType | null
  onClose: () => void
  onSaved: () => Promise<void> | void
}

export default function DynamicDailyReportModal({
  isOpen,
  target,
  workType,
  onClose,
  onSaved,
}: Props) {
  const { accessToken } = useAuth()

  const [formValues, setFormValues] = useState<Record<string, any>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const reportFields: ReportFieldDefinition[] =
    workType?.report_fields && workType.report_fields.length > 0
      ? workType.report_fields
      : [
          {
            key: 'units_completed',
            label: `${target?.unit || 'Tasks'} completed`,
            type: 'number',
            required: true,
            counts_toward_target: true,
            display_order: 1,
          },
          {
            key: 'summary_completed',
            label: 'What was completed?',
            type: 'paragraph',
            required: true,
            display_order: 2,
          },
          {
            key: 'blocker',
            label: 'Any blocker?',
            type: 'paragraph',
            display_order: 3,
          },
          {
            key: 'next_step',
            label: 'Next step?',
            type: 'paragraph',
            display_order: 4,
          },
        ]

  useEffect(() => {
    if (target) {
      const initial: Record<string, any> = {}
      for (const field of reportFields) {
        if (field.counts_toward_target) {
          initial[field.key] = target.actual_value || 0
        } else if (field.type === 'number') {
          initial[field.key] = 0
        } else if (field.type === 'boolean') {
          initial[field.key] = false
        } else {
          initial[field.key] = ''
        }
      }
      setFormValues(initial)
      setError('')
    }
  }, [target, workType])

  if (!isOpen || !target) return null

  // Calculate live output based on target-counting fields
  const targetCountingFields = reportFields.filter((f) => f.counts_toward_target)
  const totalCompletedValue =
    targetCountingFields.length > 0
      ? targetCountingFields.reduce(
          (sum, f) => sum + (Number(formValues[f.key]) || 0),
          0,
        )
      : Number(formValues.units_completed) || 0

  const targetVal = Number(target.target_value) || 1
  const pendingVal = Math.max(0, targetVal - totalCompletedValue)
  const achievement = Math.min(
    100,
    Math.round((totalCompletedValue / targetVal) * 100),
  )

  async function handleSubmit(e?: React.FormEvent, markComplete = false) {
    if (e) e.preventDefault()
    if (!accessToken || !target) return

    setSubmitting(true)
    setError('')

    try {
      const finalCompleted = markComplete
        ? Math.max(totalCompletedValue, targetVal)
        : totalCompletedValue

      // Build structured report notes
      const noteLines: string[] = []
      for (const f of reportFields) {
        const val = formValues[f.key]
        if (val !== undefined && val !== '') {
          noteLines.push(`${f.label}: ${val}`)
        }
      }

      await updateDailyTargetResult(accessToken, target.id, {
        actual_value: finalCompleted,
        result_reason: (markComplete || finalCompleted >= targetVal) ? 'COMPLETED' : 'NORMAL_DELAY',
        result_note: noteLines.join('\n'),
      })

      await onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit daily report.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-fadeIn">
        {/* Modal Top Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 font-mono">
              {workType?.name || 'DAILY WORK REPORT'}
            </span>
            <h2 className="text-base font-bold text-white mt-0.5">
              {target.projects?.name || target.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        {/* TODAY'S TARGET SUMMARY BANNER */}
        <div className="bg-slate-50 border-b border-slate-200/80 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono flex items-center gap-1">
              <Target size={12} className="text-[#801424]" />
              TODAY'S TARGET
            </span>
            <span className="text-xs font-black text-[#801424]">
              {achievement}% Achieved
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-2xs">
              <span className="text-[10px] font-semibold text-slate-400 uppercase">Target</span>
              <p className="text-base font-black text-slate-900 mt-0.5">
                {target.target_value}
              </p>
              <span className="text-[10px] text-slate-500">{target.unit}</span>
            </div>

            <div className="bg-white border border-emerald-200 rounded-xl p-2.5 shadow-2xs">
              <span className="text-[10px] font-semibold text-emerald-600 uppercase">Completed</span>
              <p className="text-base font-black text-emerald-800 mt-0.5">
                {totalCompletedValue}
              </p>
              <span className="text-[10px] text-emerald-600">{target.unit}</span>
            </div>

            <div className="bg-white border border-rose-200 rounded-xl p-2.5 shadow-2xs">
              <span className="text-[10px] font-semibold text-rose-600 uppercase">Pending</span>
              <p className="text-base font-black text-rose-800 mt-0.5">
                {pendingVal}
              </p>
              <span className="text-[10px] text-rose-600">{target.unit}</span>
            </div>
          </div>

          <div className="h-1.5 w-full bg-slate-200 rounded-full mt-3 overflow-hidden">
            <div
              className="h-full bg-[#801424] transition-all duration-300 rounded-full"
              style={{ width: `${achievement}%` }}
            />
          </div>
        </div>

        {error && (
          <div className="p-4 mx-6 mt-4 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        {/* DYNAMIC REPORT FORM */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div className="flex items-center justify-between pb-1 border-b border-slate-100">
            <span className="font-bold uppercase tracking-wider text-slate-700 font-mono text-[11px]">
              TODAY'S REPORT
            </span>
            <span className="text-[10px] text-slate-400">
              Output calculates achievement automatically
            </span>
          </div>

          <div className="space-y-3.5 max-h-95 overflow-y-auto pr-1">
            {reportFields.map((field) => (
              <div key={field.key} className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                    <span>{field.label}</span>
                    {field.required && <span className="text-rose-600">*</span>}
                    {field.counts_toward_target && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Counts to target ({target.unit})
                      </span>
                    )}
                  </label>
                </div>

                {field.type === 'number' ? (
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required={field.required}
                    value={formValues[field.key] ?? ''}
                    onChange={(e) =>
                      setFormValues((prev) => ({
                        ...prev,
                        [field.key]: e.target.value === '' ? '' : Number(e.target.value),
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#801424]"
                    placeholder="0"
                  />
                ) : field.type === 'paragraph' ? (
                  <textarea
                    rows={2}
                    required={field.required}
                    value={formValues[field.key] ?? ''}
                    onChange={(e) =>
                      setFormValues((prev) => ({
                        ...prev,
                        [field.key]: e.target.value,
                      }))
                    }
                    className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#801424]"
                    placeholder="Write details here..."
                  />
                ) : field.type === 'boolean' ? (
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700 pt-1">
                    <input
                      type="checkbox"
                      checked={Boolean(formValues[field.key])}
                      onChange={(e) =>
                        setFormValues((prev) => ({
                          ...prev,
                          [field.key]: e.target.checked,
                        }))
                      }
                      className="accent-[#801424] rounded h-4 w-4"
                    />
                    <span>Yes, verified</span>
                  </label>
                ) : (
                  <input
                    type="text"
                    required={field.required}
                    value={formValues[field.key] ?? ''}
                    onChange={(e) =>
                      setFormValues((prev) => ({
                        ...prev,
                        [field.key]: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#801424]"
                    placeholder="Enter value..."
                  />
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-slate-800 hover:bg-slate-900 px-5 py-2 font-bold text-white shadow-xs cursor-pointer disabled:opacity-50 transition flex items-center gap-1.5"
            >
              <span>{submitting ? 'Saving...' : 'Save Update'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleSubmit(undefined, true)}
              disabled={submitting}
              className="rounded-xl bg-[#801424] hover:bg-[#9f1239] px-5 py-2 font-bold text-white shadow-xs cursor-pointer disabled:opacity-50 transition flex items-center gap-1.5"
            >
              <CheckCircle2 size={14} />
              <span>{submitting ? 'Completing...' : 'Complete Work'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
