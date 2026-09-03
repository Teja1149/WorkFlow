import { useEffect, useState } from 'react'
import {
  Archive,
  Edit3,
  Layers3,
  Plus,
  RefreshCw,
  Trash2,
  X,
  Gauge,
  FileText,
  Sliders,
  Sparkles,
  CheckCircle2,
} from 'lucide-react'
import { useAuth } from '../features/auth/AuthContext'
import {
  archiveWorkType,
  createWorkType,
  deleteWorkType,
  getWorkTypes,
  updateWorkType,
} from '../features/work-types/work-type.service'
import type {
  ReportFieldDefinition,
  WorkType,
} from '../features/work-types/work-type.types'

const DEFAULT_COLOR = '#801424'

function colorStyle(color?: string | null) {
  return color || DEFAULT_COLOR
}

const PRESETS = [
  {
    name: 'Video Editing',
    code: 'VIDEO_EDIT',
    description: 'Video editing and delivery',
    measurement: 'COUNT' as const,
    unit: 'Videos',
    default_target: 10,
    default_period: 'DAILY' as const,
    daily_target: 1,
    color: '#801424',
    icon: 'video',
    report_fields: [
      {
        key: 'videos_completed',
        label: 'Videos Completed',
        type: 'number' as const,
        required: true,
        counts_toward_target: true,
        display_order: 1,
      },
      {
        key: 'videos_exported',
        label: 'Videos Exported',
        type: 'number' as const,
        required: true,
        counts_toward_target: false,
        display_order: 2,
      },
      {
        key: 'revisions',
        label: 'Revisions',
        type: 'number' as const,
        required: false,
        counts_toward_target: false,
        display_order: 3,
      },
      {
        key: 'blocker',
        label: 'Blocker',
        type: 'paragraph' as const,
        required: false,
        counts_toward_target: false,
        display_order: 4,
      },
      {
        key: 'comments',
        label: 'Comments',
        type: 'paragraph' as const,
        required: false,
        counts_toward_target: false,
        display_order: 5,
      },
    ],
  },
  {
    name: 'Website Development',
    code: 'WEB_DEV',
    description: 'Web development and feature delivery',
    measurement: 'STORY_POINTS' as const,
    unit: 'Points',
    default_target: 10,
    default_period: 'DAILY' as const,
    daily_target: 6,
    color: '#2563EB',
    icon: 'code',
    report_fields: [
      {
        key: 'story_points_completed',
        label: 'Story Points Completed',
        type: 'number' as const,
        required: true,
        counts_toward_target: true,
        display_order: 1,
      },
      {
        key: 'bugs_fixed',
        label: 'Bugs Fixed',
        type: 'number' as const,
        required: false,
        counts_toward_target: false,
        display_order: 2,
      },
      {
        key: 'code_reviews',
        label: 'Code Reviews',
        type: 'number' as const,
        required: false,
        counts_toward_target: false,
        display_order: 3,
      },
      {
        key: 'hours_spent',
        label: 'Hours Spent',
        type: 'number' as const,
        required: false,
        counts_toward_target: false,
        display_order: 4,
      },
      {
        key: 'blockers',
        label: 'Blockers',
        type: 'paragraph' as const,
        required: false,
        counts_toward_target: false,
        display_order: 5,
      },
      {
        key: 'next_step',
        label: 'Next Step',
        type: 'paragraph' as const,
        required: false,
        counts_toward_target: false,
        display_order: 6,
      },
    ],
  },
  {
    name: 'App Development',
    code: 'APP_DEV',
    description: 'Mobile app feature development',
    measurement: 'CUSTOM' as const,
    unit: 'Features',
    default_target: 1,
    default_period: 'DAILY' as const,
    daily_target: 1,
    color: '#7C3AED',
    icon: 'smartphone',
    report_fields: [
      {
        key: 'features_completed',
        label: 'Features Completed',
        type: 'number' as const,
        required: true,
        counts_toward_target: true,
        display_order: 1,
      },
      {
        key: 'bugs_fixed',
        label: 'Bugs Fixed',
        type: 'number' as const,
        required: false,
        counts_toward_target: false,
        display_order: 2,
      },
      {
        key: 'test_cases_passed',
        label: 'Test Cases Passed',
        type: 'number' as const,
        required: false,
        counts_toward_target: false,
        display_order: 3,
      },
      {
        key: 'build_status',
        label: 'Build Status',
        type: 'text' as const,
        required: false,
        counts_toward_target: false,
        display_order: 4,
      },
      {
        key: 'blockers',
        label: 'Blockers',
        type: 'paragraph' as const,
        required: false,
        counts_toward_target: false,
        display_order: 5,
      },
    ],
  },
  {
    name: 'Customer Support',
    code: 'SUPPORT',
    description: 'Handling inquiries, tickets, and user resolutions',
    measurement: 'COUNT' as const,
    unit: 'Tickets',
    default_target: 40,
    default_period: 'DAILY' as const,
    daily_target: 40,
    color: '#059669',
    icon: 'headphones',
    report_fields: [
      {
        key: 'tickets_handled',
        label: 'Tickets Handled',
        type: 'number' as const,
        required: true,
        counts_toward_target: true,
        display_order: 1,
      },
      {
        key: 'tickets_resolved',
        label: 'Tickets Resolved',
        type: 'number' as const,
        required: true,
        counts_toward_target: false,
        display_order: 2,
      },
      {
        key: 'escalated',
        label: 'Escalated',
        type: 'number' as const,
        required: false,
        counts_toward_target: false,
        display_order: 3,
      },
      {
        key: 'major_issue',
        label: 'Major Issue',
        type: 'paragraph' as const,
        required: false,
        counts_toward_target: false,
        display_order: 4,
      },
    ],
  },
]

export default function WorkTypes() {
  const { accessToken, profile } = useAuth()

  const [workTypes, setWorkTypes] = useState<WorkType[]>([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [builderTab, setBuilderTab] = useState<'DETAILS' | 'MEASUREMENT' | 'FIELDS'>('DETAILS')

  // Core metadata
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('')
  const [color, setColor] = useState(DEFAULT_COLOR)

  // Measurement definition
  const [measurement, setMeasurement] = useState<'COUNT' | 'STORY_POINTS' | 'HOURS' | 'CUSTOM'>('COUNT')
  const [unit, setUnit] = useState('tasks')
  const [defaultTarget, setDefaultTarget] = useState<number | ''>(10)
  const [defaultPeriod, setDefaultPeriod] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('MONTHLY')
  const [dailyTarget, setDailyTarget] = useState<number | ''>(1)

  // Dynamic Report Fields
  const [reportFields, setReportFields] = useState<ReportFieldDefinition[]>([])

  // New field input
  const [newFieldLabel, setNewFieldLabel] = useState('')
  const [newFieldType, setNewFieldType] = useState<ReportFieldDefinition['type']>('number')
  const [newFieldRequired, setNewFieldRequired] = useState(false)
  const [newFieldCounts, setNewFieldCounts] = useState(false)

  const canManage =
    profile?.role === 'SUPER_ADMIN' ||
    profile?.role === 'ADMIN' ||
    profile?.role === 'MANAGER'

  async function loadWorkTypes() {
    if (!accessToken) return

    setLoading(true)
    setError('')

    try {
      const data = await getWorkTypes(accessToken)
      setWorkTypes(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load work types.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadWorkTypes()
  }, [accessToken])

  function resetForm() {
    setEditingId(null)
    setName('')
    setCode('')
    setDescription('')
    setIcon('')
    setColor(DEFAULT_COLOR)
    setMeasurement('COUNT')
    setUnit('tasks')
    setDefaultTarget(10)
    setDefaultPeriod('MONTHLY')
    setDailyTarget(1)
    setReportFields([])
    setBuilderTab('DETAILS')
    setShowForm(false)
  }

  function applyPreset(preset: typeof PRESETS[0]) {
    setName(preset.name)
    setCode(preset.code)
    setDescription(preset.description)
    setMeasurement(preset.measurement)
    setUnit(preset.unit)
    setDefaultTarget(preset.default_target)
    setDefaultPeriod(preset.default_period)
    setDailyTarget(preset.daily_target)
    setColor(preset.color)
    setIcon(preset.icon)
    setReportFields([...preset.report_fields])
  }

  function openCreate() {
    resetForm()
    setError('')
    setShowForm(true)
  }

  function openEdit(workType: WorkType) {
    setEditingId(workType.id)
    setName(workType.name)
    setCode(workType.code || '')
    setDescription(workType.description || '')
    setIcon(workType.icon || '')
    setColor(workType.color || DEFAULT_COLOR)
    setMeasurement((workType.measurement as any) || 'COUNT')
    setUnit(workType.unit || 'tasks')
    setDefaultTarget(workType.default_target ?? 10)
    setDefaultPeriod((workType.default_period as any) || 'MONTHLY')
    setDailyTarget(workType.daily_target ?? 1)
    setReportFields(Array.isArray(workType.report_fields) ? [...workType.report_fields] : [])
    setBuilderTab('DETAILS')
    setError('')
    setShowForm(true)
  }

  function handleAddField() {
    if (!newFieldLabel.trim()) return
    const slug = newFieldLabel
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
    const key = slug || `field_${Date.now()}`

    const field: ReportFieldDefinition = {
      key,
      label: newFieldLabel.trim(),
      type: newFieldType,
      required: newFieldRequired,
      counts_toward_target: newFieldCounts,
      display_order: reportFields.length + 1,
    }

    setReportFields((prev) => [...prev, field])
    setNewFieldLabel('')
    setNewFieldType('number')
    setNewFieldRequired(false)
    setNewFieldCounts(false)
  }

  function handleRemoveField(idx: number) {
    setReportFields((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!accessToken) return

    if (!name.trim()) {
      setError('Work type name is required.')
      return
    }

    setWorking(true)
    setError('')

    const payload = {
      name: name.trim(),
      code: code.trim() || undefined,
      description: description.trim() || undefined,
      icon: icon.trim() || undefined,
      color,
      measurement,
      unit: unit.trim() || 'tasks',
      default_target: typeof defaultTarget === 'number' ? defaultTarget : undefined,
      default_period: defaultPeriod,
      daily_target: typeof dailyTarget === 'number' ? dailyTarget : undefined,
      report_fields: reportFields,
    }

    try {
      if (editingId) {
        await updateWorkType(accessToken, editingId, payload)
      } else {
        await createWorkType(accessToken, payload)
      }

      resetForm()
      await loadWorkTypes()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save work type.')
    } finally {
      setWorking(false)
    }
  }

  async function handleArchive(workType: WorkType) {
    if (!accessToken) return

    if (
      !window.confirm(
        `Archive "${workType.name}"?\n\nArchived work types remain available for historical data but won't be active for new work.`,
      )
    ) {
      return
    }

    setWorking(true)
    setError('')

    try {
      await archiveWorkType(accessToken, workType.id)
      await loadWorkTypes()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to archive work type.')
    } finally {
      setWorking(false)
    }
  }

  async function handleDelete(workType: WorkType) {
    if (!accessToken) return

    if (
      !window.confirm(
        `Delete "${workType.name}"?\n\nThis is only allowed if no work items are using this work type.`,
      )
    ) {
      return
    }

    setWorking(true)
    setError('')

    try {
      await deleteWorkType(accessToken, workType.id)
      await loadWorkTypes()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete work type.')
    } finally {
      setWorking(false)
    }
  }

  const activeTypes = workTypes.filter((type) => type.is_active)
  const archivedTypes = workTypes.filter((type) => !type.is_active)

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-200/70 text-slate-700 text-[10px] font-bold uppercase tracking-wider mb-2">
              <Sliders size={12} className="text-[#801424]" />
              Enterprise Work Taxonomy
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Work Type Templates
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Define arbitrary categories of work, measurement units, target models, and custom daily report fields.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadWorkTypes}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            {canManage && (
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-2 rounded-xl bg-[#801424] hover:bg-[#9f1239] px-4 py-2 text-xs font-bold text-white shadow-xs cursor-pointer transition"
              >
                <Plus className="h-4 w-4" />
                Create Work Type
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">
            {error}
          </div>
        )}

        {/* Create/Edit Template Builder */}
        {showForm && canManage && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden animate-fadeIn">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>{editingId ? 'Edit Work Type Template' : 'Create Work Type Template'}</span>
                  {code && (
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                      {code}
                    </span>
                  )}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Configure measurement model and daily reporting fields for this discipline.
                </p>
              </div>

              <button
                onClick={resetForm}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Quick Presets Bar */}
            {!editingId && (
              <div className="px-6 py-2.5 bg-slate-100/70 border-b border-slate-200/80 flex flex-wrap items-center gap-2 text-xs">
                <span className="font-bold text-slate-500 text-[11px] flex items-center gap-1">
                  <Sparkles size={13} className="text-amber-500" />
                  Quick Load Template:
                </span>
                {PRESETS.map((p) => (
                  <button
                    key={p.code}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-200 text-slate-700 font-semibold text-[11px] border border-slate-200/80 shadow-2xs transition cursor-pointer"
                  >
                    + {p.name}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={handleSubmit} className="p-6 space-y-6 text-xs">
              {/* SECTION 1: BASIC INFORMATION */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
                    Basic Information
                  </h3>
                  <hr className="mt-2 border-slate-100" />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block font-bold text-slate-700 uppercase tracking-wider">
                      Name *
                    </label>
                    <input
                      required
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value)
                        if (!code) {
                          setCode(
                            e.target.value
                              .toUpperCase()
                              .replace(/[^A-Z0-9]+/g, '_')
                              .slice(0, 16),
                          )
                        }
                      }}
                      placeholder="e.g. Video Editing, Website Development"
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 outline-none focus:border-[#801424]"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block font-bold text-slate-700 uppercase tracking-wider">
                      Code Identifier (Optional)
                    </label>
                    <input
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      placeholder="e.g. VIDEO_EDIT, WEB_DEV"
                      className="w-full font-mono rounded-xl border border-slate-200 px-3.5 py-2.5 uppercase outline-none focus:border-[#801424]"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-1.5 block font-bold text-slate-700 uppercase tracking-wider">
                      Description
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                      placeholder="e.g. Video editing and delivery"
                      className="w-full resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 outline-none focus:border-[#801424]"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: HOW IS THIS WORK MEASURED? */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#801424] font-mono">
                    HOW IS THIS WORK MEASURED?
                  </h3>
                  <hr className="mt-2 border-slate-100" />
                </div>

                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                  <div>
                    <label className="mb-1.5 block font-bold text-slate-700 uppercase tracking-wider">
                      Measurement Type *
                    </label>
                    <select
                      value={measurement}
                      onChange={(e) => setMeasurement(e.target.value as any)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-semibold outline-none focus:border-[#801424]"
                    >
                      <option value="COUNT">Count</option>
                      <option value="STORY_POINTS">Story Points</option>
                      <option value="HOURS">Hours</option>
                      <option value="PERCENTAGE">Percentage</option>
                      <option value="CUSTOM">Custom</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block font-bold text-slate-700 uppercase tracking-wider">
                      Unit *
                    </label>
                    <input
                      required
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      placeholder="e.g. Videos, Points, Features"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-[#801424]"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block font-bold text-slate-700 uppercase tracking-wider">
                      Default Target
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={defaultTarget}
                      onChange={(e) => setDefaultTarget(e.target.value ? Number(e.target.value) : '')}
                      placeholder="e.g. 10"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-[#801424]"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block font-bold text-slate-700 uppercase tracking-wider">
                      Target Period
                    </label>
                    <select
                      value={defaultPeriod}
                      onChange={(e) => setDefaultPeriod(e.target.value as any)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-semibold outline-none focus:border-[#801424]"
                    >
                      <option value="DAILY">Daily</option>
                      <option value="WEEKLY">Weekly</option>
                      <option value="MONTHLY">Monthly</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION 3: DAILY REPORT FIELDS */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#801424] font-mono">
                    DAILY REPORT FIELDS
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Only fields with "Counts Target" marked calculate completion
                  </span>
                </div>
                <hr className="border-slate-100" />

                {/* Fields Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[10px] uppercase">
                        <th className="py-2.5 px-4 font-bold">Field Name</th>
                        <th className="py-2.5 px-4 font-bold">Type</th>
                        <th className="py-2.5 px-4 font-bold text-center">Required</th>
                        <th className="py-2.5 px-4 font-bold text-center">Counts Target</th>
                        <th className="py-2.5 px-4 font-bold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {reportFields.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-slate-400 italic">
                            No fields added yet. Use "+ Add Field" below or select a quick template preset.
                          </td>
                        </tr>
                      ) : (
                        reportFields.map((field, idx) => (
                          <tr key={field.key} className="hover:bg-slate-50/60 transition">
                            <td className="py-2.5 px-4 font-bold text-slate-900">
                              {field.label}
                            </td>
                            <td className="py-2.5 px-4 text-slate-600 capitalize">
                              {field.type === 'paragraph' ? 'Long Text' : field.type === 'text' ? 'Short Text' : field.type}
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              <input
                                type="checkbox"
                                checked={Boolean(field.required)}
                                onChange={(e) => {
                                  const updated = [...reportFields]
                                  updated[idx] = { ...updated[idx], required: e.target.checked }
                                  setReportFields(updated)
                                }}
                                className="accent-[#801424] rounded h-4 w-4 cursor-pointer"
                              />
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              <input
                                type="checkbox"
                                checked={Boolean(field.counts_toward_target)}
                                onChange={(e) => {
                                  const updated = [...reportFields]
                                  updated[idx] = { ...updated[idx], counts_toward_target: e.target.checked }
                                  setReportFields(updated)
                                }}
                                className="accent-[#801424] rounded h-4 w-4 cursor-pointer"
                              />
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveField(idx)}
                                className="text-slate-400 hover:text-rose-600 cursor-pointer p-1"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Inline Add Field Form */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-3">
                  <span className="font-bold text-[11px] uppercase tracking-wider text-slate-700 block">
                    + Add Field
                  </span>

                  <div className="grid gap-3 sm:grid-cols-4">
                    <div className="sm:col-span-2">
                      <input
                        value={newFieldLabel}
                        onChange={(e) => setNewFieldLabel(e.target.value)}
                        placeholder="e.g. Videos Completed, Revisions, Blocker"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 outline-none text-xs"
                      />
                    </div>

                    <div>
                      <select
                        value={newFieldType}
                        onChange={(e) => setNewFieldType(e.target.value as any)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 outline-none text-xs font-semibold"
                      >
                        <option value="number">Number</option>
                        <option value="paragraph">Long Text</option>
                        <option value="text">Short Text</option>
                        <option value="boolean">Yes / No</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1 cursor-pointer text-slate-700 text-[11px] font-semibold">
                        <input
                          type="checkbox"
                          checked={newFieldRequired}
                          onChange={(e) => setNewFieldRequired(e.target.checked)}
                          className="accent-[#801424] rounded"
                        />
                        <span>Req</span>
                      </label>

                      <label className="flex items-center gap-1 cursor-pointer text-slate-700 text-[11px] font-semibold">
                        <input
                          type="checkbox"
                          checked={newFieldCounts}
                          onChange={(e) => setNewFieldCounts(e.target.checked)}
                          className="accent-[#801424] rounded"
                        />
                        <span>Counts</span>
                      </label>

                      <button
                        type="button"
                        onClick={handleAddField}
                        className="px-3 py-2 rounded-lg bg-[#801424] hover:bg-[#9f1239] text-white font-bold text-xs cursor-pointer shadow-2xs transition shrink-0"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={working}
                  className="rounded-xl bg-[#801424] hover:bg-[#9f1239] px-6 py-2.5 text-xs font-bold text-white shadow-xs cursor-pointer disabled:opacity-50 transition"
                >
                  {working ? 'Saving...' : 'Save Work Type Template'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Active Types Cards */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-900 text-base">Active Work Type Templates</h2>
              <p className="text-xs text-slate-500">
                Measurement models ready for project targets and employee daily assignments.
              </p>
            </div>

            <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-700">
              {activeTypes.length} configured
            </span>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
              <RefreshCw className="mx-auto h-6 w-6 animate-spin text-slate-400" />
              <p className="mt-3 text-xs text-slate-500 font-medium">Loading work types...</p>
            </div>
          ) : activeTypes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <Layers3 className="mx-auto h-10 w-10 text-slate-300" />
              <h3 className="mt-3 font-bold text-slate-700 text-sm">No work types yet</h3>
              <p className="mt-1 text-xs text-slate-500">
                Click "+ Create Work Type" or choose a preset to establish your organization's work definitions.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {activeTypes.map((workType) => {
                const fields = Array.isArray(workType.report_fields) ? workType.report_fields : []
                return (
                  <div
                    key={workType.id}
                    className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs hover:border-slate-300 transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white font-bold text-xs shadow-xs"
                            style={{ backgroundColor: colorStyle(workType.color) }}
                          >
                            {workType.icon ? workType.icon.slice(0, 3).toUpperCase() : 'WT'}
                          </div>

                          <div className="min-w-0">
                            <h3 className="truncate font-bold text-slate-900 text-sm">{workType.name}</h3>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {workType.code && (
                                <span className="font-mono text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                                  {workType.code}
                                </span>
                              )}
                              <span className="text-[10px] font-semibold text-emerald-600 flex items-center gap-1">
                                <CheckCircle2 size={10} />
                                Active
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <p className="mt-3 text-xs leading-5 text-slate-500 line-clamp-2">
                        {workType.description || 'No description provided.'}
                      </p>

                      {/* Measurement Model Summary Badge */}
                      <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/70 p-3 space-y-1 text-xs">
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="font-semibold text-[11px]">Measurement:</span>
                          <span className="font-bold text-slate-900">
                            {workType.measurement || 'COUNT'} ({workType.unit || 'tasks'})
                          </span>
                        </div>

                        {workType.default_target && (
                          <div className="flex items-center justify-between text-slate-600">
                            <span className="font-semibold text-[11px]">Expected Target:</span>
                            <span className="font-bold text-slate-900">
                              {workType.default_target} {workType.unit} / {workType.default_period || 'MONTH'}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-slate-600">
                          <span className="font-semibold text-[11px]">Report Fields:</span>
                          <span className="font-bold text-slate-900">
                            {fields.length > 0 ? `${fields.length} dynamic fields` : 'Default text update'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {canManage && (
                      <div className="mt-5 flex gap-2 border-t border-slate-100 pt-4">
                        <button
                          onClick={() => openEdit(workType)}
                          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          Edit Template
                        </button>

                        <button
                          onClick={() => handleArchive(workType)}
                          disabled={working}
                          className="inline-flex items-center justify-center gap-1 rounded-xl border border-amber-200 bg-amber-50/40 px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-50 disabled:opacity-50 cursor-pointer"
                        >
                          <Archive className="h-3.5 w-3.5" />
                          Archive
                        </button>

                        <button
                          onClick={() => handleDelete(workType)}
                          disabled={working}
                          title="Delete if unused"
                          className="rounded-xl border border-red-200 bg-red-50/40 p-2 text-red-500 hover:bg-red-50 disabled:opacity-50 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Archived Types */}
        {archivedTypes.length > 0 && (
          <section>
            <div className="mb-3">
              <h2 className="font-bold text-slate-800 text-sm">Archived Work Types</h2>
              <p className="text-xs text-slate-500">Historical work types no longer active for new tasks.</p>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {archivedTypes.map((workType) => (
                <div key={workType.id} className="rounded-xl border border-slate-200 bg-slate-100/70 p-4 opacity-75">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-800 text-xs">{workType.name}</p>
                      <span className="text-[10px] text-slate-500">Archived</span>
                    </div>

                    {canManage && (
                      <button
                        onClick={() =>
                          updateWorkType(accessToken!, workType.id, { is_active: true }).then(loadWorkTypes)
                        }
                        disabled={working}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-white cursor-pointer"
                      >
                        Restore
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
