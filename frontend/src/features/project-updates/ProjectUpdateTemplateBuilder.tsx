import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Save, CheckCircle, AlertCircle, Loader2, Sparkles, Layers } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import {
  getProjectUpdateTemplate,
  createProjectUpdateTemplate,
  addFieldsToTemplate,
} from './project-update.service'
import type { UpdateFieldType } from './project-update.types'

interface Props {
  projectId: string
  onSaved?: () => void
}

export interface BuilderField {
  field_name: string
  field_key: string
  field_type: UpdateFieldType
  is_required: boolean
}

function createField(): BuilderField {
  return {
    field_name: '',
    field_key: '',
    field_type: 'NUMBER',
    is_required: false,
  }
}

export default function ProjectUpdateTemplateBuilder({
  projectId,
  onSaved,
}: Props) {
  const { accessToken } = useAuth()

  const [templateName, setTemplateName] = useState('Daily Report Template')
  const [description, setDescription] = useState('')
  const [fields, setFields] = useState<BuilderField[]>([createField()])
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [templateId, setTemplateId] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken || !projectId) return

    async function load() {
      setFetching(true)
      try {
        const template = await getProjectUpdateTemplate(accessToken!, projectId)
        if (template) {
          setTemplateId(template.id)
          setTemplateName(template.name || template.title || 'Daily Report Template')
          setDescription(template.description || '')
          if (template.fields && template.fields.length > 0) {
            setFields(
              template.fields.map((field) => ({
                field_name: field.field_name,
                field_key: field.field_key,
                field_type: (field.field_type as UpdateFieldType) || 'TEXT',
                is_required: field.is_required,
              })),
            )
          }
        }
      } catch (error) {
        console.error('Failed to load project template:', error)
      } finally {
        setFetching(false)
      }
    }

    void load()
  }, [accessToken, projectId])

  function handleAddField() {
    setFields((prev) => [...prev, createField()])
  }

  function handleRemoveField(index: number) {
    setFields((prev) => prev.filter((_, i) => i !== index))
  }

  function handleFieldChange<K extends keyof BuilderField>(
    index: number,
    key: K,
    val: BuilderField[K],
  ) {
    setFields((prev) => {
      const updated = [...prev]
      const current = { ...updated[index], [key]: val }

      if (key === 'field_name') {
        const slugified = String(val)
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '')
        current.field_key = slugified
      }

      updated[index] = current
      return updated
    })
  }

  async function handleSaveTemplate(e: React.FormEvent) {
    e.preventDefault()
    if (!accessToken) return

    const validFields = fields.filter((f) => f.field_name.trim().length > 0)
    if (validFields.length === 0) {
      setMessage({
        type: 'error',
        text: 'Please add at least one valid field column name.',
      })
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      const template = await createProjectUpdateTemplate(accessToken, projectId, {
        title: templateName.trim(),
        name: templateName.trim(),
        description: description.trim(),
      })

      const targetTemplateId = template.id || templateId

      if (targetTemplateId) {
        const payloadFields = validFields.map((f, idx) => ({
          field_name: f.field_name.trim(),
          field_key: f.field_key.trim() || f.field_name.toLowerCase().replace(/\s+/g, '_'),
          field_type: f.field_type,
          is_required: f.is_required,
          display_order: idx + 1,
        }))

        await addFieldsToTemplate(accessToken, targetTemplateId, payloadFields)
      }

      setMessage({
        type: 'success',
        text: 'Daily Update Template successfully saved! Employees can now submit reports using these fields.',
      })

      if (onSaved) {
        onSaved()
      }
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.message || 'Failed to save template.',
      })
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 flex items-center justify-center gap-3 text-slate-500">
        <Loader2 className="animate-spin text-slate-800" size={20} />
        <span className="text-sm font-medium">Loading report template builder...</span>
      </div>
    )
  }

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center border border-slate-800">
            <Layers size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              Daily Update Template Builder
              <Sparkles size={16} className="text-amber-500" />
            </h2>
            <p className="text-xs text-slate-500">
              Customize dynamic input columns for employee daily reports on this project.
            </p>
          </div>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-2.5 ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle size={18} className="shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle size={18} className="shrink-0 text-rose-600" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <form onSubmit={handleSaveTemplate} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Template Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. GoToSlide Daily Report"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-zinc-800 focus:bg-white transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Description (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Mandatory metrics for daily submission"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-zinc-800 focus:bg-white transition"
            />
          </div>
        </div>

        {/* Dynamic Columns Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Custom Columns</h3>
            <span className="text-xs text-slate-400 font-medium">
              {fields.length} {fields.length === 1 ? 'column' : 'columns'} defined
            </span>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3">Field Name</th>
                  <th className="p-3">Field Key</th>
                  <th className="p-3">Type</th>
                  <th className="p-3 text-center">Required</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {fields.map((f, index) => (
                  <tr key={index} className="hover:bg-slate-50/50 transition">
                    <td className="p-3">
                      <input
                        type="text"
                        required
                        placeholder="e.g. Total Slides"
                        value={f.field_name}
                        onChange={(e) =>
                          handleFieldChange(index, 'field_name', e.target.value)
                        }
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-zinc-800 focus:bg-white"
                      />
                    </td>
                    <td className="p-3">
                      <input
                        type="text"
                        placeholder="e.g. total_slides"
                        value={f.field_key}
                        onChange={(e) =>
                          handleFieldChange(index, 'field_key', e.target.value)
                        }
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-600 outline-none focus:border-zinc-800 focus:bg-white"
                      />
                    </td>
                    <td className="p-3">
                      <select
                        value={f.field_type}
                        onChange={(e) =>
                          handleFieldChange(
                            index,
                            'field_type',
                            e.target.value as UpdateFieldType,
                          )
                        }
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-zinc-800 focus:bg-white"
                      >
                        <option value="NUMBER">NUMBER</option>
                        <option value="TEXT">TEXT</option>
                        <option value="LONG_TEXT">LONG_TEXT</option>
                        <option value="BOOLEAN">BOOLEAN</option>
                        <option value="DATE">DATE</option>
                        <option value="PHONE">PHONE</option>
                        <option value="EMAIL">EMAIL</option>
                        <option value="URL">URL</option>
                      </select>
                    </td>
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={f.is_required}
                        onChange={(e) =>
                          handleFieldChange(index, 'is_required', e.target.checked)
                        }
                        className="w-4 h-4 rounded text-zinc-900 focus:ring-zinc-800 border-slate-300 cursor-pointer"
                      />
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemoveField(index)}
                        disabled={fields.length === 1}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Remove column"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={handleAddField}
            className="flex items-center gap-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-xl border border-slate-200 transition"
          >
            <Plus size={16} />
            Add Another Column
          </button>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 bg-[#801424] hover:bg-[#9f1239] text-white font-bold text-xs px-6 py-2.5 rounded-xl transition shadow-xs disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                Saving...
              </>
            ) : (
              <>
                <Save size={16} />
                Save Template
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
