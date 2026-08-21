import React, { useEffect, useMemo, useState } from 'react'
import {
  Calendar,
  CheckCircle2,
  Send,
  Loader2,
  FileText,
  Layers,
  Sparkles,
  Settings,
  Download,
  Search,
  User,
  History,
  FileSpreadsheet,
  Filter,
  X,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import {
  getProjectUpdateTemplate,
  submitProjectDailyUpdate,
  getProjectDailyUpdates,
} from './project-update.service'
import type {
  ProjectUpdateTemplate,
  ProjectUpdateField,
  ProjectDailyUpdate,
} from './project-update.types'
import ProjectUpdateTemplateBuilder from './ProjectUpdateTemplateBuilder'
import ProjectUpdateColumnFilterPopover, {
  type ColumnFilterRule,
} from './ProjectUpdateColumnFilterPopover'

interface Props {
  projectId: string
}

function DynamicFieldInput({
  field,
  value,
  onChange,
}: {
  field: ProjectUpdateField
  value: any
  onChange: (val: any) => void
}) {
  const label = (
    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
      {field.field_name}
      {field.is_required && <span className="ml-1 text-rose-500">*</span>}
    </label>
  )

  if (field.field_type === 'BOOLEAN') {
    return (
      <label className="flex items-center gap-3 cursor-pointer pt-6">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="h-5 w-5 rounded border-slate-300 text-zinc-900 focus:ring-zinc-800 cursor-pointer"
        />
        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          {field.field_name}
          {field.is_required && <span className="ml-1 text-rose-500">*</span>}
        </span>
      </label>
    )
  }

  if (field.field_type === 'LONG_TEXT') {
    return (
      <div>
        {label}
        <textarea
          rows={3}
          value={value === null || value === undefined ? '' : String(value)}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${field.field_name.toLowerCase()}`}
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-xs outline-none transition focus:border-zinc-800 bg-slate-50 focus:bg-white"
        />
      </div>
    )
  }

  return (
    <div>
      {label}
      <input
        type={
          field.field_type === 'NUMBER'
            ? 'number'
            : field.field_type === 'DATE'
              ? 'date'
              : field.field_type === 'EMAIL'
                ? 'email'
                : field.field_type === 'PHONE'
                  ? 'tel'
                  : field.field_type === 'URL'
                    ? 'url'
                    : 'text'
        }
        value={value === null || value === undefined ? '' : String(value)}
        onChange={(event) => {
          if (field.field_type === 'NUMBER') {
            onChange(
              event.target.value === '' ? 0 : Number(event.target.value),
            )
          } else {
            onChange(event.target.value)
          }
        }}
        placeholder={`Enter ${field.field_name.toLowerCase()}`}
        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold outline-none transition focus:border-zinc-800 bg-slate-50 focus:bg-white"
      />
    </div>
  )
}

export default function ProjectDailyUpdatesSection({ projectId }: Props) {
  const { accessToken, profile } = useAuth()

  const [template, setTemplate] = useState<ProjectUpdateTemplate | null>(null)
  const [updates, setUpdates] = useState<ProjectDailyUpdate[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Filters for Manager / Admin
  const [selectedEmployee, setSelectedEmployee] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [fromDate, setFromDate] = useState<string>('')
  const [toDate, setToDate] = useState<string>('')

  // Form state for employee submission
  const [paragraphUpdate, setParagraphUpdate] = useState('')
  const [progressPercent, setProgressPercent] = useState<number>(0)
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({})
  const [submitting, setSubmitting] = useState(false)
  const [formSuccess, setFormSuccess] = useState('')
  const [formError, setFormError] = useState('')

  // Toggle for template builder mode (for Managers/Admins)
  const [showBuilder, setShowBuilder] = useState(false)

  const userRole = (profile?.role || '').toUpperCase()
  const isManagerOrAdmin =
    userRole === 'SUPER_ADMIN' ||
    userRole === 'MANAGER' ||
    userRole === 'ADMIN'

  async function loadData() {
    if (!accessToken || !projectId) return

    try {
      setLoading(true)
      setLoadError(null)

      const [templateData, updatesData] = await Promise.all([
        getProjectUpdateTemplate(accessToken, projectId).catch((err) => {
          console.warn('Template load warning:', err)
          return null
        }),
        getProjectDailyUpdates(accessToken, projectId, {
          employeeId: selectedEmployee || undefined,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
        }).catch((err) => {
          console.warn('Daily updates load warning:', err)
          return []
        }),
      ])

      setTemplate(templateData)
      setUpdates(updatesData || [])
    } catch (error) {
      console.error('PROJECT DAILY UPDATE ERROR:', error)
      setLoadError(
        error instanceof Error
          ? error.message
          : 'Failed to load daily updates.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [accessToken, projectId, selectedEmployee, fromDate, toDate])

  const handleFieldValueChange = (fieldId: string, val: any) => {
    setFieldValues((prev) => ({ ...prev, [fieldId]: val }))
  }

  async function handleSubmitUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!accessToken || !projectId) return

    setSubmitting(true)
    setFormSuccess('')
    setFormError('')

    try {
      await submitProjectDailyUpdate(accessToken, projectId, {
        paragraphUpdate,
        progressPercent: Number(progressPercent),
        values: fieldValues,
      })

      setFormSuccess('Daily update submitted successfully!')
      await loadData()
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit daily update.')
    } finally {
      setSubmitting(false)
    }
  }

  const sortedFields = useMemo(() => {
    if (!template?.fields) return []
    const fields = [...template.fields].sort((a, b) => a.display_order - b.display_order)

    const unique: typeof fields = []
    const seen = new Set<string>()
    for (const f of fields) {
      const key = f.field_key || f.field_name.toLowerCase().trim().replace(/\s+/g, '_')
      if (key && !seen.has(key)) {
        seen.add(key)
        unique.push(f)
      }
    }
    return unique
  }, [template])

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], [])

  const myTodayUpdate = useMemo(() => {
    return updates.find(
      (u) =>
        (u.employee_id === profile?.id || u.profiles?.id === profile?.id) &&
        u.update_date.startsWith(todayStr),
    )
  }, [updates, profile, todayStr])

  // Prefill form values if employee has already submitted today's report
  useEffect(() => {
    if (myTodayUpdate) {
      setParagraphUpdate(myTodayUpdate.paragraph_update || '')
      setProgressPercent(myTodayUpdate.progress_percent || 0)

      if (myTodayUpdate.values && myTodayUpdate.values.length > 0) {
        const vals: Record<string, any> = {}
        for (const v of myTodayUpdate.values) {
          vals[v.field_id] = v.value_text
        }
        setFieldValues(vals)
      }
    }
  }, [myTodayUpdate])

  // Extract unique employees for manager chip filter
  const uniqueEmployees = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>()
    for (const upd of updates) {
      const empId = upd.employee_id || upd.profiles?.id
      if (empId && !map.has(empId)) {
        const name = upd.profiles
          ? `${upd.profiles.first_name} ${upd.profiles.last_name || ''}`.trim()
          : 'Employee'
        map.set(empId, { id: empId, name })
      }
    }
    return Array.from(map.values())
  }, [updates])

  // Dynamic Per-Column Filters
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilterRule>>({})
  const [activeFilterPopover, setActiveFilterPopover] = useState<string | null>(null)

  function evaluateColumnFilter(
    upd: ProjectDailyUpdate,
    rule: ColumnFilterRule,
  ): boolean {
    let rawVal = ''

    if (rule.columnId === 'date') {
      rawVal = upd.update_date ? upd.update_date.slice(0, 10) : ''
    } else if (rule.columnId === 'employee') {
      rawVal = upd.profiles
        ? `${upd.profiles.first_name} ${upd.profiles.last_name || ''}`.trim()
        : 'Employee'
    } else if (rule.columnId === 'progress') {
      rawVal = String(upd.progress_percent ?? 0)
    } else if (rule.columnId === 'summary') {
      rawVal = upd.paragraph_update || ''
    } else {
      const matched = upd.values?.find((v) => v.field_id === rule.columnId)
      rawVal = matched?.value_text || ''
    }

    const isNum = rule.fieldType === 'NUMBER' || rule.fieldType === 'BUILTIN_NUMBER'
    const isDate = rule.fieldType === 'DATE' || rule.fieldType === 'BUILTIN_DATE'
    const isBool = rule.fieldType === 'BOOLEAN'

    if (isBool) {
      const isTrueVal = rawVal === 'true' || rawVal === '1' || rawVal === 'Yes'
      return rule.operator === 'is_true' ? isTrueVal : !isTrueVal
    }

    if (isNum) {
      const num = Number(rawVal)
      const v1 = Number(rule.value)
      const v2 = Number(rule.value2)

      if (isNaN(num)) return false

      switch (rule.operator) {
        case 'gt':
          return num > v1
        case 'gte':
          return num >= v1
        case 'lt':
          return num < v1
        case 'lte':
          return num <= v1
        case 'equals':
          return num === v1
        case 'between':
          return num >= v1 && num <= v2
        default:
          return true
      }
    }

    if (isDate) {
      const dateStr = rawVal.slice(0, 10)
      const v1 = rule.value
      const v2 = rule.value2 || ''

      switch (rule.operator) {
        case 'equals':
          return dateStr === v1
        case 'before':
          return dateStr < v1
        case 'after':
          return dateStr > v1
        case 'between':
          return dateStr >= v1 && dateStr <= v2
        default:
          return true
      }
    }

    // Text types (contains, equals, starts_with)
    const text = rawVal.toLowerCase()
    const target = rule.value.toLowerCase()

    switch (rule.operator) {
      case 'equals':
        return text === target
      case 'starts_with':
        return text.startsWith(target)
      case 'contains':
      default:
        return text.includes(target)
    }
  }

  // Filter updates based on search query, employee, date range, and dynamic column filters
  const filteredUpdates = useMemo(() => {
    return updates.filter((upd) => {
      if (selectedEmployee && upd.employee_id !== selectedEmployee && upd.profiles?.id !== selectedEmployee) {
        return false
      }
      if (fromDate && upd.update_date.slice(0, 10) < fromDate) return false
      if (toDate && upd.update_date.slice(0, 10) > toDate) return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const empName = upd.profiles
          ? `${upd.profiles.first_name} ${upd.profiles.last_name || ''}`.toLowerCase()
          : ''
        const summary = (upd.paragraph_update || '').toLowerCase()
        const valuesText = (upd.values || []).map((v) => (v.value_text || '').toLowerCase()).join(' ')

        if (!empName.includes(q) && !summary.includes(q) && !valuesText.includes(q)) {
          return false
        }
      }

      // Dynamic Column Filters (AND logic)
      const rules = Object.values(columnFilters)
      for (const rule of rules) {
        if (!evaluateColumnFilter(upd, rule)) {
          return false
        }
      }

      return true
    })
  }, [updates, selectedEmployee, searchQuery, fromDate, toDate, columnFilters])

  // Export to Excel / CSV function
  const handleExportExcel = () => {
    if (filteredUpdates.length === 0) return

    const headers = [
      'Date',
      'Employee',
      ...sortedFields.map((f) => f.field_name),
      'Progress (%)',
      'Summary',
    ]

    const rows = filteredUpdates.map((upd) => {
      const empName = upd.profiles
        ? `${upd.profiles.first_name} ${upd.profiles.last_name || ''}`.trim()
        : 'Employee'
      const dateStr = new Date(upd.update_date).toLocaleDateString()
      const fieldVals = sortedFields.map((f) => {
        const matched = upd.values?.find((v) => v.field_id === f.id)
        return `"${(matched?.value_text || '-').replace(/"/g, '""')}"`
      })
      const summary = `"${(upd.paragraph_update || '-').replace(/"/g, '""')}"`

      return [
        `"${dateStr}"`,
        `"${empName}"`,
        ...fieldVals,
        `"${upd.progress_percent}%"`,
        summary,
      ].join(',')
    })

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `Team_Daily_Updates_${projectId}_${todayStr}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-8 mt-8">
      {/* Header Banner */}
      <div className="card-3d p-6 rounded-3xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#801424] text-white flex items-center justify-center font-bold shadow-md border border-rose-500/20 shrink-0">
            <Layers size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              {isManagerOrAdmin ? 'Team Daily Updates' : 'My Daily Updates'}
              <Sparkles size={18} className="text-amber-500" />
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isManagerOrAdmin
                ? 'Review team member updates, dynamic metrics, and export report performance.'
                : 'Submit your daily work metrics, accomplishments, and view past update history.'}
            </p>
          </div>
        </div>

        {isManagerOrAdmin && (
          <button
            onClick={() => setShowBuilder(!showBuilder)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#801424] hover:bg-[#9f1239] text-white font-bold text-xs rounded-xl transition shadow-xs cursor-pointer"
          >
            <Settings size={15} />
            {showBuilder ? 'Close Template Builder' : 'Configure Update Format'}
          </button>
        )}
      </div>

      {loadError && (
        <section className="rounded-3xl border border-rose-200 bg-rose-50/50 p-8 card-3d">
          <div className="text-center">
            <h2 className="text-lg font-bold text-rose-700">
              Daily Updates Failed to Load
            </h2>
            <p className="mt-2 text-xs text-rose-600">{loadError}</p>
            <button
              type="button"
              onClick={() => void loadData()}
              className="mt-5 rounded-2xl bg-rose-600 px-5 py-2.5 text-xs font-extrabold text-white cursor-pointer hover:bg-rose-700 transition shadow-md"
            >
              Try Again
            </button>
          </div>
        </section>
      )}

      {/* Callout Banner when no template is configured */}
      {!template && !showBuilder && !loadError && !loading && (
        <div className="card-3d p-6 rounded-3xl flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Sparkles size={18} className="text-amber-500" />
              Daily Report Format Not Configured
            </h3>
            <p className="text-xs text-slate-600 max-w-xl">
              {isManagerOrAdmin
                ? 'Configure custom metric columns so employees can submit daily reports for this project.'
                : 'No daily update template has been configured by a manager for this project yet.'}
            </p>
          </div>

          {isManagerOrAdmin && (
            <button
              onClick={() => setShowBuilder(true)}
              className="px-5 py-2.5 text-white font-extrabold text-xs rounded-2xl shadow-md transition shrink-0 cursor-pointer btn-3d-primary"
            >
              + Configure Update Format
            </button>
          )}
        </div>
      )}

      {/* Admin/Manager Template Builder Section */}
      {showBuilder && isManagerOrAdmin && (
        <ProjectUpdateTemplateBuilder
          projectId={projectId}
          onSaved={() => {
            setShowBuilder(false)
            void loadData()
          }}
        />
      )}

      {/* Daily Update Submission Form (Shown to employees, or when template exists) */}
      {template && sortedFields.length > 0 && (
        <div className="card-3d p-6 rounded-3xl space-y-6">
          <div className="border-b border-slate-200/60 pb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                {myTodayUpdate ? "Update Today's Report" : "My Daily Work Update"}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} — Fill in your daily report metrics below.
              </p>
            </div>
            <span className="text-xs font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
              {myTodayUpdate ? 'Submitted Today' : 'Pending Submission'}
            </span>
          </div>

          {formSuccess && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600" />
              <span>{formSuccess}</span>
            </div>
          )}

          {formError && (
            <div className="p-3.5 rounded-2xl bg-rose-50 text-rose-800 text-xs font-semibold border border-rose-200">
              {formError}
            </div>
          )}

          <form onSubmit={handleSubmitUpdate} className="space-y-6">
            <fieldset className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {sortedFields.map((f) => (
                  <DynamicFieldInput
                    key={f.id || f.field_key}
                    field={f}
                    value={fieldValues[f.id]}
                    onChange={(val) => handleFieldValueChange(f.id, val)}
                  />
                ))}
              </div>

              {/* Overall Progress & Paragraph Update */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-200/60">
                <div className="space-y-1.5">
                  <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                    Overall Progress ({progressPercent}%)
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={progressPercent}
                    onChange={(e) => setProgressPercent(Number(e.target.value))}
                    className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-zinc-900"
                  />
                </div>

                <div className="md:col-span-2 space-y-1.5">
                  <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                    Paragraph Work Summary
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Describe your accomplishments, work completed, or blockers today..."
                    value={paragraphUpdate}
                    onChange={(e) => setParagraphUpdate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50/80 border border-slate-200 rounded-2xl text-xs outline-none focus:border-zinc-800 focus:bg-white transition"
                  />
                </div>
              </div>
            </fieldset>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 text-white font-extrabold text-xs px-6 py-3 rounded-2xl transition disabled:opacity-50 cursor-pointer btn-3d-primary"
              >
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin" size={15} />
                    Saving...
                  </>
                ) : myTodayUpdate ? (
                  <>
                    <Send size={15} />
                    Update Today's Report
                  </>
                ) : (
                  <>
                    <Send size={15} />
                    Submit Update
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* EMPLOYEE VIEW: My Update History */}
      {!isManagerOrAdmin && (
        <div className="card-3d p-6 rounded-3xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200/60 pb-4">
            <div className="flex items-center gap-2">
              <History size={18} className="text-slate-800" />
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                My Update History
              </h3>
            </div>
            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
              {updates.length} {updates.length === 1 ? 'Report' : 'Reports'}
            </span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
              <Loader2 className="animate-spin text-slate-800" size={18} />
              <span>Loading your history...</span>
            </div>
          ) : updates.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <FileText size={28} className="mx-auto text-slate-300" />
              <p className="font-medium text-slate-600 text-sm">No update history found.</p>
              <p className="text-xs text-slate-400">
                Submit your first update using the form above.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {updates.map((upd) => (
                <div
                  key={upd.id}
                  className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3 hover:border-slate-300 transition"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800">
                      <Calendar size={14} className="text-slate-700" />
                      <span>{new Date(upd.update_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                    <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                      {upd.progress_percent}% Progress
                    </span>
                  </div>

                  {upd.paragraph_update && (
                    <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                      "{upd.paragraph_update}"
                    </p>
                  )}

                  {upd.values && upd.values.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                      {upd.values.map((v) => (
                        <div key={v.id} className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                          <span className="block text-[10px] text-slate-400 uppercase font-semibold">
                            {v.project_update_fields?.field_name || 'Metric'}
                          </span>
                          <span className="font-bold text-slate-800">{v.value_text || '-'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MANAGER / ADMIN VIEW: Team Daily Updates Matrix + Excel Export + Employee Performance */}
      {isManagerOrAdmin && (
        <>
          <div className="card-3d p-6 rounded-3xl space-y-6">
            {/* Header with Export Excel */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/60 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                  Team Daily Updates
                  <FileSpreadsheet size={18} className="text-[#801424]" />
                </h3>
                <p className="text-xs text-slate-600 font-medium mt-0.5">
                  Real-time submitted daily metrics breakdown across all team members.
                </p>
              </div>

              <button
                onClick={handleExportExcel}
                disabled={filteredUpdates.length === 0}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#801424] hover:bg-[#9f1239] text-white font-bold text-xs rounded-xl transition shadow-xs disabled:opacity-50 cursor-pointer"
              >
                <Download size={15} />
                Export Excel
              </button>
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3 text-xs w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search employee, summary..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-[#801424] font-semibold text-slate-900"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-slate-700 font-bold">From:</span>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-[#801424] font-semibold text-slate-900"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-slate-700 font-bold">To:</span>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-[#801424] font-semibold text-slate-900"
                  />
                </div>

                {(fromDate || toDate || selectedEmployee || searchQuery) && (
                  <button
                    onClick={() => {
                      setFromDate('')
                      setToDate('')
                      setSelectedEmployee('')
                      setSearchQuery('')
                    }}
                    className="text-xs text-[#801424] font-bold hover:underline cursor-pointer ml-auto md:ml-0"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>

            {/* Employee Filter Chips */}
            {uniqueEmployees.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs font-black text-slate-800 mr-1 flex items-center gap-1">
                  <User size={13} />
                  Employees:
                </span>
                <button
                  onClick={() => setSelectedEmployee('')}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer transition ${
                    !selectedEmployee
                      ? 'bg-[#801424] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  All ({updates.length})
                </button>

                {uniqueEmployees.map((emp) => {
                  const empCount = updates.filter(
                    (u) => (u.employee_id === emp.id || u.profiles?.id === emp.id),
                  ).length
                  return (
                    <button
                      key={emp.id}
                      onClick={() => setSelectedEmployee(emp.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer transition ${
                        selectedEmployee === emp.id
                          ? 'bg-[#801424] text-white shadow-xs'
                          : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
                      }`}
                    >
                      {emp.name} ({empCount})
                    </button>
                  )
                })}
              </div>
            )}

            {/* Active Column Filters Bar */}
            {Object.keys(columnFilters).length > 0 && (
              <div className="flex flex-wrap items-center gap-2 bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl text-xs">
                <span className="font-black text-slate-900 mr-1 flex items-center gap-1.5">
                  <Filter size={13} className="text-[#801424]" />
                  Active Filters:
                </span>

                {Object.values(columnFilters).map((rule) => {
                  let label = `${rule.columnName}: ${rule.value}`
                  if (rule.operator === 'between') {
                    label = `${rule.columnName}: ${rule.value} to ${rule.value2 || ''}`
                  } else if (rule.operator === 'gt') {
                    label = `${rule.columnName} > ${rule.value}`
                  } else if (rule.operator === 'gte') {
                    label = `${rule.columnName} >= ${rule.value}`
                  } else if (rule.operator === 'lt') {
                    label = `${rule.columnName} < ${rule.value}`
                  } else if (rule.operator === 'lte') {
                    label = `${rule.columnName} <= ${rule.value}`
                  } else if (rule.operator === 'is_true') {
                    label = `${rule.columnName}: True`
                  } else if (rule.operator === 'is_false') {
                    label = `${rule.columnName}: False`
                  } else if (rule.operator === 'contains') {
                    label = `${rule.columnName} contains "${rule.value}"`
                  } else if (rule.operator === 'starts_with') {
                    label = `${rule.columnName} starts with "${rule.value}"`
                  } else if (rule.operator === 'before') {
                    label = `${rule.columnName} before ${rule.value}`
                  } else if (rule.operator === 'after') {
                    label = `${rule.columnName} after ${rule.value}`
                  }

                  return (
                    <span
                      key={rule.columnId}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#801424] text-white font-bold text-[11px] shadow-2xs"
                    >
                      <span>{label}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setColumnFilters((prev) => {
                            const copy = { ...prev }
                            delete copy[rule.columnId]
                            return copy
                          })
                        }}
                        className="hover:text-rose-200 p-0.5 rounded transition cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  )
                })}

                <button
                  type="button"
                  onClick={() => setColumnFilters({})}
                  className="text-xs font-bold text-[#801424] hover:underline ml-auto cursor-pointer"
                >
                  Clear All Filters
                </button>
              </div>
            )}

            {/* Matrix Table */}
            {loading ? (
              <div className="py-12 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
                <Loader2 className="animate-spin text-[#801424]" size={18} />
                <span>Loading daily updates matrix...</span>
              </div>
            ) : filteredUpdates.length === 0 ? (
              <div className="py-12 text-center text-slate-500 space-y-2">
                <FileText size={28} className="mx-auto text-slate-400" />
                <p className="font-bold text-slate-800 text-sm">No daily updates found.</p>
                <p className="text-xs text-slate-500">
                  Try adjusting your search or column filters.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200/80 rounded-2xl shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/90 border-b border-slate-200 text-slate-900 font-black uppercase tracking-wider">
                    <tr>
                      {/* Date Column */}
                      <th className="p-3.5 whitespace-nowrap">
                        <div className="flex items-center justify-between gap-2">
                          <span>Date</span>
                          <button
                            type="button"
                            onClick={() =>
                              setActiveFilterPopover((prev) => (prev === 'date' ? null : 'date'))
                            }
                            title="Filter Date"
                            className={`p-1.5 rounded-lg transition cursor-pointer ${
                              columnFilters['date']
                                ? 'bg-[#801424] text-white shadow-2xs'
                                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'
                            }`}
                          >
                            <Filter size={13} className={columnFilters['date'] ? 'fill-white' : ''} />
                          </button>
                        </div>
                        {activeFilterPopover === 'date' && (
                          <ProjectUpdateColumnFilterPopover
                            columnId="date"
                            columnName="Date"
                            fieldType="BUILTIN_DATE"
                            activeFilter={columnFilters['date']}
                            onApply={(rule) =>
                              setColumnFilters((prev) => ({ ...prev, date: rule }))
                            }
                            onClear={() =>
                              setColumnFilters((prev) => {
                                const copy = { ...prev }
                                delete copy.date
                                return copy
                              })
                            }
                            onClose={() => setActiveFilterPopover(null)}
                          />
                        )}
                      </th>

                      {/* Employee Column */}
                      <th className="p-3.5 whitespace-nowrap">
                        <div className="flex items-center justify-between gap-2">
                          <span>Employee</span>
                          <button
                            type="button"
                            onClick={() =>
                              setActiveFilterPopover((prev) => (prev === 'employee' ? null : 'employee'))
                            }
                            title="Filter Employee"
                            className={`p-1.5 rounded-lg transition cursor-pointer ${
                              columnFilters['employee']
                                ? 'bg-[#801424] text-white shadow-2xs'
                                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'
                            }`}
                          >
                            <Filter size={13} className={columnFilters['employee'] ? 'fill-white' : ''} />
                          </button>
                        </div>
                        {activeFilterPopover === 'employee' && (
                          <ProjectUpdateColumnFilterPopover
                            columnId="employee"
                            columnName="Employee"
                            fieldType="BUILTIN_TEXT"
                            activeFilter={columnFilters['employee']}
                            availableValues={uniqueEmployees.map((e) => e.name)}
                            onApply={(rule) =>
                              setColumnFilters((prev) => ({ ...prev, employee: rule }))
                            }
                            onClear={() =>
                              setColumnFilters((prev) => {
                                const copy = { ...prev }
                                delete copy.employee
                                return copy
                              })
                            }
                            onClose={() => setActiveFilterPopover(null)}
                          />
                        )}
                      </th>

                      {/* Dynamic Template Fields */}
                      {sortedFields.map((f) => {
                        const colId = f.id || f.field_key
                        const availableVals = Array.from(
                          new Set(
                            updates
                              .map((u) => u.values?.find((v) => v.field_id === f.id)?.value_text)
                              .filter(Boolean),
                          ),
                        ) as string[]

                        return (
                          <th key={colId} className="p-3.5 whitespace-nowrap">
                            <div className="flex items-center justify-between gap-2">
                              <span>{f.field_name}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  setActiveFilterPopover((prev) =>
                                    prev === colId ? null : colId,
                                  )
                                }
                                title={`Filter ${f.field_name}`}
                                className={`p-1.5 rounded-lg transition cursor-pointer ${
                                  columnFilters[colId]
                                    ? 'bg-[#801424] text-white shadow-2xs'
                                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'
                                }`}
                              >
                                <Filter
                                  size={13}
                                  className={columnFilters[colId] ? 'fill-white' : ''}
                                />
                              </button>
                            </div>

                            {activeFilterPopover === colId && (
                              <ProjectUpdateColumnFilterPopover
                                columnId={colId}
                                columnName={f.field_name}
                                fieldType={f.field_type}
                                activeFilter={columnFilters[colId]}
                                availableValues={availableVals}
                                onApply={(rule) =>
                                  setColumnFilters((prev) => ({ ...prev, [colId]: rule }))
                                }
                                onClear={(id) =>
                                  setColumnFilters((prev) => {
                                    const copy = { ...prev }
                                    delete copy[id]
                                    return copy
                                  })
                                }
                                onClose={() => setActiveFilterPopover(null)}
                              />
                            )}
                          </th>
                        )
                      })}

                      {/* Progress Column */}
                      <th className="p-3.5 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <span>Progress</span>
                          <button
                            type="button"
                            onClick={() =>
                              setActiveFilterPopover((prev) => (prev === 'progress' ? null : 'progress'))
                            }
                            title="Filter Progress"
                            className={`p-1.5 rounded-lg transition cursor-pointer ${
                              columnFilters['progress']
                                ? 'bg-[#801424] text-white shadow-2xs'
                                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'
                            }`}
                          >
                            <Filter size={13} className={columnFilters['progress'] ? 'fill-white' : ''} />
                          </button>
                        </div>
                        {activeFilterPopover === 'progress' && (
                          <ProjectUpdateColumnFilterPopover
                            columnId="progress"
                            columnName="Progress"
                            fieldType="BUILTIN_NUMBER"
                            activeFilter={columnFilters['progress']}
                            onApply={(rule) =>
                              setColumnFilters((prev) => ({ ...prev, progress: rule }))
                            }
                            onClear={() =>
                              setColumnFilters((prev) => {
                                const copy = { ...prev }
                                delete copy.progress
                                return copy
                              })
                            }
                            onClose={() => setActiveFilterPopover(null)}
                          />
                        )}
                      </th>

                      {/* Summary Column */}
                      <th className="p-3.5 whitespace-nowrap">
                        <div className="flex items-center justify-between gap-2">
                          <span>Summary</span>
                          <button
                            type="button"
                            onClick={() =>
                              setActiveFilterPopover((prev) => (prev === 'summary' ? null : 'summary'))
                            }
                            title="Filter Summary"
                            className={`p-1.5 rounded-lg transition cursor-pointer ${
                              columnFilters['summary']
                                ? 'bg-[#801424] text-white shadow-2xs'
                                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'
                            }`}
                          >
                            <Filter size={13} className={columnFilters['summary'] ? 'fill-white' : ''} />
                          </button>
                        </div>
                        {activeFilterPopover === 'summary' && (
                          <ProjectUpdateColumnFilterPopover
                            columnId="summary"
                            columnName="Summary"
                            fieldType="BUILTIN_TEXT"
                            activeFilter={columnFilters['summary']}
                            onApply={(rule) =>
                              setColumnFilters((prev) => ({ ...prev, summary: rule }))
                            }
                            onClear={() =>
                              setColumnFilters((prev) => {
                                const copy = { ...prev }
                                delete copy.summary
                                return copy
                              })
                            }
                            onClose={() => setActiveFilterPopover(null)}
                          />
                        )}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredUpdates.map((upd) => {
                      const empName = upd.profiles
                        ? `${upd.profiles.first_name} ${upd.profiles.last_name || ''}`.trim()
                        : 'Employee'
                      return (
                        <tr key={upd.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="p-3.5 font-bold text-slate-900 whitespace-nowrap">
                            {new Date(upd.update_date).toLocaleDateString()}
                          </td>
                          <td className="p-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-[#801424] text-white font-bold flex items-center justify-center text-[10px] shadow-2xs">
                                {empName[0]}
                              </div>
                              <span className="font-bold text-slate-900">{empName}</span>
                            </div>
                          </td>

                          {/* Dynamic Field Values */}
                          {sortedFields.map((f) => {
                            const matchedVal = upd.values?.find(
                              (v) => v.field_id === f.id,
                            )
                            return (
                              <td key={f.id || f.field_key} className="p-3.5 font-mono font-bold text-slate-900">
                                {matchedVal?.value_text || '-'}
                              </td>
                            )
                          })}

                          <td className="p-3.5 text-center whitespace-nowrap">
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-slate-100 text-slate-900 border border-slate-200">
                              {upd.progress_percent}%
                            </span>
                          </td>

                          <td className="p-3.5 text-slate-800 font-semibold max-w-xs truncate">
                            {upd.paragraph_update || '-'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Individual Employee Performance Cards */}
          {filteredUpdates.length > 0 && (
            <div className="card-3d p-6 rounded-3xl space-y-4">
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                Employee Performance Cards
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {filteredUpdates.map((upd) => {
                  const empName = upd.profiles
                    ? `${upd.profiles.first_name} ${upd.profiles.last_name || ''}`.trim()
                    : 'Employee'
                  return (
                    <div
                      key={upd.id}
                      className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3 hover:border-teal-300 transition"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 font-bold flex items-center justify-center text-sm border border-purple-100">
                            {empName[0]}
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-slate-900">{empName}</h4>
                            <span className="text-[10px] text-slate-400 flex items-center gap-1">
                              <Calendar size={11} />
                              {new Date(upd.update_date).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                          {upd.progress_percent}%
                        </span>
                      </div>

                      {upd.paragraph_update && (
                        <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                          "{upd.paragraph_update}"
                        </p>
                      )}

                      {upd.values && upd.values.length > 0 && (
                        <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                          {upd.values.map((v) => (
                            <div key={v.id} className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                              <span className="block text-[10px] text-slate-400 uppercase font-semibold">
                                {v.project_update_fields?.field_name || 'Metric'}
                              </span>
                              <span className="font-bold text-slate-800">{v.value_text || '-'}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

