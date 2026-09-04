import React, { useEffect, useState } from 'react'
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  CheckCircle,
  AlertCircle,
  Settings,
  HelpCircle,
  Sparkles,
  Layers,
} from 'lucide-react'
import {
  getProjectDailyReportTemplate,
  saveProjectDailyReportTemplate,
  type DailyReportField,
  type DailyReportFieldType,
  type DailyReportTemplate,
} from '../project-daily-report.service'

interface Props {
  projectId: string
  accessToken: string
  onSaved?: () => void
}

const FIELD_TYPES: { value: DailyReportFieldType; label: string; description: string }[] = [
  { value: 'NUMBER', label: 'Number', description: 'Numeric counts (e.g. Videos completed, Calls done)' },
  { value: 'TEXT', label: 'Short Text', description: 'Single line text (e.g. Milestone name, Links)' },
  { value: 'PARAGRAPH', label: 'Paragraph / Long Text', description: 'Multi-line summaries or blocker details' },
  { value: 'BOOLEAN', label: 'Yes / No', description: 'Switch or binary status (e.g. Blocked?, Quality check pass?)' },
  { value: 'DATE', label: 'Date', description: 'Date picker' },
  { value: 'TIME', label: 'Time', description: 'Time picker' },
  { value: 'SELECT', label: 'Select / Dropdown', description: 'Pre-configured choice options' },
]

export default function ProjectDailyReportTemplateBuilder({
  projectId,
  accessToken,
  onSaved,
}: Props) {
  const [templateName, setTemplateName] = useState('Daily Report Template')
  const [description, setDescription] = useState('Daily employee end-of-day execution & blocker reporting')
  const [isActive, setIsActive] = useState(true)
  const [fields, setFields] = useState<DailyReportField[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    loadTemplate()
  }, [projectId, accessToken])

  async function loadTemplate() {
    if (!accessToken || !projectId) return
    setLoading(true)
    setMessage(null)
    try {
      const tmpl = await getProjectDailyReportTemplate(accessToken, projectId)
      if (tmpl) {
        setTemplateName(tmpl.name || 'Daily Report Template')
        setDescription(tmpl.description || '')
        setIsActive(tmpl.is_active !== false)
        if (tmpl.fields && tmpl.fields.length > 0) {
          setFields(tmpl.fields)
        } else {
          setFields(getDefaultFields())
        }
      } else {
        setFields(getDefaultFields())
      }
    } catch (err) {
      console.error('Failed to load template:', err)
      setFields(getDefaultFields())
    } finally {
      setLoading(false)
    }
  }

  function getDefaultFields(): DailyReportField[] {
    return [
      {
        id: 'f_1',
        label: 'Videos Completed',
        field_key: 'videos_completed',
        field_type: 'NUMBER',
        required: true,
        counts_toward_performance: true,
        counts_toward_target: true,
        sort_order: 1,
      },
      {
        id: 'f_2',
        label: 'Work completed today',
        field_key: 'work_completed_today',
        field_type: 'PARAGRAPH',
        required: true,
        counts_toward_performance: false,
        counts_toward_target: false,
        sort_order: 2,
      },
      {
        id: 'f_3',
        label: 'Blocked?',
        field_key: 'blocked',
        field_type: 'BOOLEAN',
        required: true,
        counts_toward_performance: true,
        counts_toward_target: false,
        sort_order: 3,
      },
      {
        id: 'f_4',
        label: 'Blocker details',
        field_key: 'blocker_details',
        field_type: 'PARAGRAPH',
        required: false,
        counts_toward_performance: false,
        counts_toward_target: false,
        sort_order: 4,
      },
      {
        id: 'f_5',
        label: "Tomorrow's plan",
        field_key: 'tomorrows_plan',
        field_type: 'PARAGRAPH',
        required: false,
        counts_toward_performance: false,
        counts_toward_target: false,
        sort_order: 5,
      },
    ]
  }

  function handleAddField() {
    const nextOrder = fields.length + 1
    const newField: DailyReportField = {
      id: `field_${Date.now()}`,
      label: `Field ${nextOrder}`,
      field_key: `field_${nextOrder}`,
      field_type: 'TEXT',
      required: false,
      counts_toward_performance: false,
      counts_toward_target: false,
      sort_order: nextOrder,
    }
    setFields([...fields, newField])
  }

  function handleRemoveField(index: number) {
    const updated = fields.filter((_, i) => i !== index)
    // Re-index sort order
    setFields(updated.map((f, i) => ({ ...f, sort_order: i + 1 })))
  }

  function handleMoveField(index: number, direction: 'up' | 'down') {
    const targetIdx = direction === 'up' ? index - 1 : index + 1
    if (targetIdx < 0 || targetIdx >= fields.length) return

    const newFields = [...fields]
    const temp = newFields[index]
    newFields[index] = newFields[targetIdx]
    newFields[targetIdx] = temp

    setFields(newFields.map((f, i) => ({ ...f, sort_order: i + 1 })))
  }

  function handleFieldChange(index: number, updates: Partial<DailyReportField>) {
    setFields((prev) =>
      prev.map((f, i) => {
        if (i !== index) return f
        const updated = { ...f, ...updates }
        if (updates.label && (!f.field_key || f.field_key.startsWith('field_'))) {
          // Auto-generate key from label
          updated.field_key = updates.label
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '') || `field_${i + 1}`
        }
        return updated
      }),
    )
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!accessToken || !projectId) return

    if (!templateName.trim()) {
      setMessage({ type: 'error', text: 'Template name is required.' })
      return
    }

    if (fields.length === 0) {
      setMessage({ type: 'error', text: 'Please add at least one report field.' })
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      await saveProjectDailyReportTemplate(accessToken, projectId, {
        name: templateName.trim(),
        description: description.trim(),
        is_active: isActive,
        fields,
      })

      setMessage({ type: 'success', text: '✓ Daily Report Template saved successfully.' })
      if (onSaved) onSaved()
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to save daily report template.',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-400">
        Loading template builder...
      </div>
    )
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#801424] font-mono flex items-center gap-1.5">
                <Settings size={14} />
                TEMPLATE CONFIGURATION
              </span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 mt-1">
              Project Daily Report Template
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Customize dynamic report fields for employees working on this project. Changes apply to future submissions.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setFields(getDefaultFields())}
              className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Sparkles size={14} className="text-amber-500" />
              <span>Load Presets</span>
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-[#801424] hover:bg-[#9f1239] text-white text-xs font-extrabold flex items-center gap-2 shadow-xs transition disabled:opacity-50 cursor-pointer"
            >
              <Save size={14} />
              <span>{saving ? 'Saving...' : 'Save Template'}</span>
            </button>
          </div>
        </div>

        {message && (
          <div
            className={`p-4 rounded-xl flex items-center gap-3 text-xs font-bold ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            <span>{message.text}</span>
          </div>
        )}

        {/* Template Meta */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Template Name *</label>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 outline-none focus:border-[#801424]"
              placeholder="e.g. Daily Execution & Velocity Report"
              required
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-bold text-slate-700">Description / Instructions</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 outline-none focus:border-[#801424]"
              placeholder="e.g. Submit by 06:00 PM without fail. Detail work completed, metrics, and blockers."
            />
          </div>
        </div>

        {/* Fields List Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 pt-2">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-[#801424]" />
            <h3 className="text-sm font-bold text-slate-900">Configured Report Fields ({fields.length})</h3>
          </div>

          <button
            type="button"
            onClick={handleAddField}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-2xs transition cursor-pointer"
          >
            <Plus size={14} />
            <span>Add Field</span>
          </button>
        </div>

        {/* Fields list */}
        <div className="space-y-3">
          {fields.map((field, idx) => (
            <div
              key={field.id || idx}
              className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-slate-300 transition space-y-3 shadow-2xs"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                {/* Field order & Label */}
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveField(idx, 'up')}
                      className="p-0.5 rounded text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                      title="Move up"
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      type="button"
                      disabled={idx === fields.length - 1}
                      onClick={() => handleMoveField(idx, 'down')}
                      className="p-0.5 rounded text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                      title="Move down"
                    >
                      <ArrowDown size={12} />
                    </button>
                  </div>

                  <span className="font-mono text-xs font-black text-slate-400 w-5">#{idx + 1}</span>

                  <div className="flex-1">
                    <input
                      type="text"
                      value={field.label}
                      onChange={(e) => handleFieldChange(idx, { label: e.target.value })}
                      placeholder="Field Label (e.g. Videos Completed)"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-900 outline-none focus:border-[#801424]"
                    />
                  </div>
                </div>

                {/* Type Selector */}
                <div className="flex items-center gap-2">
                  <select
                    value={field.field_type}
                    onChange={(e) =>
                      handleFieldChange(idx, {
                        field_type: e.target.value as DailyReportFieldType,
                      })
                    }
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-800 outline-none"
                  >
                    {FIELD_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => handleRemoveField(idx)}
                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition cursor-pointer"
                    title="Remove field"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {/* Options for Select/Dropdown */}
              {field.field_type === 'SELECT' && (
                <div className="pt-2 border-t border-slate-200/60">
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Dropdown Options (comma separated)
                  </label>
                  <input
                    type="text"
                    value={field.options?.join(', ') || ''}
                    onChange={(e) =>
                      handleFieldChange(idx, {
                        options: e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="e.g. In Progress, Completed, On Hold, Blocked"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 outline-none"
                  />
                </div>
              )}

              {/* Checkbox Flags */}
              <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-200/60 text-xs">
                <label className="flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(e) => handleFieldChange(idx, { required: e.target.checked })}
                    className="rounded border-slate-300 text-[#801424] focus:ring-[#801424]"
                  />
                  <span>Required *</span>
                </label>

                <label className="flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={field.counts_toward_performance}
                    onChange={(e) =>
                      handleFieldChange(idx, { counts_toward_performance: e.target.checked })
                    }
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                  />
                  <span>Performance Metric 📊</span>
                </label>

                <label className="flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={field.counts_toward_target}
                    onChange={(e) =>
                      handleFieldChange(idx, { counts_toward_target: e.target.checked })
                    }
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
                  />
                  <span>Counts toward Target 🎯</span>
                </label>

                <span className="text-[10px] text-slate-400 font-mono ml-auto">
                  key: {field.field_key}
                </span>
              </div>
            </div>
          ))}

          {fields.length === 0 && (
            <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              No fields configured yet. Click "Add Field" or "Load Presets" to build your daily report form.
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex justify-end pt-4 border-t border-slate-100">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-[#801424] hover:bg-[#9f1239] text-white text-xs font-extrabold flex items-center gap-2 shadow-xs transition disabled:opacity-50 cursor-pointer"
          >
            <Save size={14} />
            <span>{saving ? 'Saving...' : 'Save Template Changes'}</span>
          </button>
        </div>
      </div>
    </form>
  )
}
