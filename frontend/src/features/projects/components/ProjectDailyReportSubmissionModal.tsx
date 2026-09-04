import React, { useEffect, useState } from 'react'
import {
  X,
  FileCheck2,
  AlertCircle,
  Calendar,
  Send,
  CheckCircle2,
  Sparkles,
} from 'lucide-react'
import {
  getProjectDailyReportTemplate,
  submitProjectDailyReport,
  type DailyReportField,
  type DailyReportTemplate,
} from '../project-daily-report.service'
import { playWorkNotificationSound } from '../../notifications/notification.sound'

interface Props {
  isOpen: boolean
  onClose: () => void
  projectId: string
  projectName?: string
  accessToken: string
  onSubmitted?: () => void
}

export default function ProjectDailyReportSubmissionModal({
  isOpen,
  onClose,
  projectId,
  projectName,
  accessToken,
  onSubmitted,
}: Props) {
  const [template, setTemplate] = useState<DailyReportTemplate | null>(null)
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10))
  const [formValues, setFormValues] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (isOpen && projectId && accessToken) {
      loadTemplate()
    }
  }, [isOpen, projectId, accessToken])

  async function loadTemplate() {
    setLoading(true)
    setError('')
    setSuccess(false)
    try {
      const tmpl = await getProjectDailyReportTemplate(accessToken, projectId)
      if (tmpl && tmpl.fields && tmpl.fields.length > 0) {
        setTemplate(tmpl)
        // Initialize default empty values
        const initial: Record<string, any> = {}
        for (const f of tmpl.fields) {
          if (f.field_type === 'BOOLEAN') {
            initial[f.id] = false
          } else if (f.field_type === 'NUMBER') {
            initial[f.id] = ''
          } else {
            initial[f.id] = ''
          }
        }
        setFormValues(initial)
      } else {
        setError('No daily report template configured for this project yet. Please ask your Admin to configure one.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load report template.')
    } finally {
      setLoading(false)
    }
  }

  function handleValueChange(fieldId: string, value: any) {
    setFormValues((prev) => ({
      ...prev,
      [fieldId]: value,
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!accessToken || !projectId || !template) return

    // Validate required fields
    for (const field of template.fields) {
      if (field.required) {
        const val = formValues[field.id]
        if (val === undefined || val === null || val === '') {
          setError(`Please fill in required field: "${field.label}"`)
          return
        }
      }
    }

    setSubmitting(true)
    setError('')

    try {
      await submitProjectDailyReport(accessToken, projectId, {
        report_date: reportDate,
        answers: formValues,
      })

      playWorkNotificationSound()
      setSuccess(true)
      setTimeout(() => {
        if (onSubmitted) onSubmitted()
        onClose()
      }, 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit daily report.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 text-white p-6 relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#801424] flex items-center justify-center text-white shadow-md">
              <FileCheck2 size={20} />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 font-mono">
                TODAY'S DAILY REPORT
              </span>
              <h2 className="text-lg font-black text-white">
                {projectName ? `${projectName}` : 'Project Daily Submission'}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            Loading project daily report template...
          </div>
        ) : success ? (
          <div className="p-12 text-center space-y-3">
            <CheckCircle2 size={48} className="mx-auto text-emerald-500 animate-bounce" />
            <h3 className="text-lg font-bold text-slate-900">Daily Report Submitted!</h3>
            <p className="text-xs text-slate-500">
              Your compliance status is updated in real-time. Great job!
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Date Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs">
              <div className="flex items-center gap-2">
                <Calendar size={15} className="text-[#801424]" />
                <span className="font-bold text-slate-700">Reporting Date:</span>
                <input
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white font-bold text-slate-900 outline-none"
                  required
                />
              </div>

              <span className="text-[11px] font-mono text-slate-500 font-semibold">
                Single submission per day enforced
              </span>
            </div>

            {/* Dynamic Fields */}
            {template && template.fields && template.fields.length > 0 ? (
              <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
                {template.fields.map((field) => (
                  <div key={field.id} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <span>{field.label}</span>
                        {field.required && <span className="text-rose-600 font-bold">*</span>}
                        {field.counts_toward_performance && (
                          <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-1.5 py-0.5 rounded border border-indigo-200">
                            Perf Metric
                          </span>
                        )}
                        {field.counts_toward_target && (
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-1.5 py-0.5 rounded border border-emerald-200">
                            Target
                          </span>
                        )}
                      </label>
                    </div>

                    {/* Field Type Specific Controls */}
                    {field.field_type === 'NUMBER' ? (
                      <input
                        type="number"
                        value={formValues[field.id] ?? ''}
                        onChange={(e) => handleValueChange(field.id, e.target.value)}
                        placeholder="0"
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 outline-none focus:border-[#801424]"
                        required={field.required}
                      />
                    ) : field.field_type === 'PARAGRAPH' ? (
                      <textarea
                        rows={3}
                        value={formValues[field.id] ?? ''}
                        onChange={(e) => handleValueChange(field.id, e.target.value)}
                        placeholder={`Provide details for ${field.label}...`}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 outline-none focus:border-[#801424] resize-y"
                        required={field.required}
                      />
                    ) : field.field_type === 'BOOLEAN' ? (
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleValueChange(field.id, true)}
                          className={`px-4 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                            formValues[field.id] === true
                              ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          onClick={() => handleValueChange(field.id, false)}
                          className={`px-4 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                            formValues[field.id] === false || formValues[field.id] === undefined
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          No
                        </button>
                      </div>
                    ) : field.field_type === 'SELECT' ? (
                      <select
                        value={formValues[field.id] ?? ''}
                        onChange={(e) => handleValueChange(field.id, e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 outline-none bg-white"
                        required={field.required}
                      >
                        <option value="">-- Select an option --</option>
                        {field.options?.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : field.field_type === 'DATE' ? (
                      <input
                        type="date"
                        value={formValues[field.id] ?? ''}
                        onChange={(e) => handleValueChange(field.id, e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 outline-none"
                        required={field.required}
                      />
                    ) : field.field_type === 'TIME' ? (
                      <input
                        type="time"
                        value={formValues[field.id] ?? ''}
                        onChange={(e) => handleValueChange(field.id, e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 outline-none"
                        required={field.required}
                      />
                    ) : (
                      <input
                        type="text"
                        value={formValues[field.id] ?? ''}
                        onChange={(e) => handleValueChange(field.id, e.target.value)}
                        placeholder={`Enter ${field.label}...`}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 outline-none focus:border-[#801424]"
                        required={field.required}
                      />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                Template has no fields configured.
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submitting || !template}
                className="px-6 py-2.5 rounded-xl bg-[#801424] hover:bg-[#9f1239] text-white text-xs font-extrabold flex items-center gap-2 shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                <Send size={14} />
                <span>{submitting ? 'Submitting...' : 'Submit Daily Report'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
