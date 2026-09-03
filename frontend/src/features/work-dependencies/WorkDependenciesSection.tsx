import React, { useEffect, useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { GitCommit, Plus, Trash2, ShieldAlert, ArrowDown, RefreshCw } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import {
  addWorkDependency,
  getWorkDependencies,
  removeWorkDependency,
  type WorkDependency,
} from './work-dependency.service'
import { getWorkItems, type WorkItem } from '../work-items/work-item.service'

function healthBadge(health?: string) {
  switch (health) {
    case 'CRITICAL':
      return 'bg-red-100 text-red-800 border-red-300'
    case 'RED':
      return 'bg-red-50 text-red-700 border-red-200'
    case 'ORANGE':
      return 'bg-orange-50 text-orange-700 border-orange-200'
    case 'AMBER':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    default:
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  }
}

export default function WorkDependenciesSection({
  workItem,
}: {
  workItem: WorkItem
}) {
  const { accessToken } = useAuth()

  const [dependencies, setDependencies] = useState<WorkDependency[]>([])
  const [projectWorkItems, setProjectWorkItems] = useState<WorkItem[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedDependsOnId, setSelectedDependsOnId] = useState('')
  const [error, setError] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)

  async function loadData() {
    if (!accessToken || !workItem.id) return
    setLoading(true)
    setError('')

    try {
      const [deps, allItems] = await Promise.all([
        getWorkDependencies(accessToken, workItem.id),
        getWorkItems(accessToken).catch(() => []),
      ])

      setDependencies(deps)

      // Filter work items in the SAME project, excluding current work item
      const sameProjectItems = allItems.filter(
        (item) => item.project_id === workItem.project_id && item.id !== workItem.id,
      )
      setProjectWorkItems(sameProjectItems)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load work dependencies.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [accessToken, workItem.id])

  async function handleAddDependency(e: React.FormEvent) {
    e.preventDefault()
    if (!accessToken || !selectedDependsOnId) return
    setSubmitting(true)
    setError('')

    try {
      await addWorkDependency(accessToken, workItem.id, selectedDependsOnId)
      setSelectedDependsOnId('')
      setShowAddForm(false)
      await loadData()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to add dependency.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRemoveDependency(dependencyId: string) {
    if (!accessToken) return
    try {
      await removeWorkDependency(accessToken, dependencyId)
      await loadData()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to remove dependency.',
      )
    }
  }

  // Active blockers (incomplete dependencies)
  const blockers = useMemo(() => {
    return dependencies.filter(
      (dep) =>
        dep.depends_on_work_item &&
        dep.depends_on_work_item.status !== 'DONE',
    )
  }, [dependencies])

  // Filter available options (exclude already added dependencies)
  const availableOptions = useMemo(() => {
    const existingDepIds = new Set(
      dependencies.map((d) => d.depends_on_work_item?.id).filter(Boolean),
    )

    return projectWorkItems.filter((item) => !existingDepIds.has(item.id))
  }, [projectWorkItems, dependencies])

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2">
          <GitCommit className="h-5 w-5 text-slate-700" />
          <h3 className="font-bold text-slate-900 text-base">Work Dependencies</h3>
        </div>

        <button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg cursor-pointer transition"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Dependency
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Add Dependency Form */}
      {showAddForm && (
        <form onSubmit={handleAddDependency} className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <label className="block text-xs font-semibold text-slate-700">
            Select Prerequisite Work Item (Same Project)
          </label>

          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={selectedDependsOnId}
              onChange={(e) => setSelectedDependsOnId(e.target.value)}
              required
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs outline-none focus:border-blue-500"
            >
              <option value="">Select work item...</option>
              {availableOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} ({item.status})
                </option>
              ))}
            </select>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting || !selectedDependsOnId}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                Save
              </button>

              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Dependencies List */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          This work depends on:
        </p>

        {loading ? (
          <div className="py-4 text-center text-xs text-slate-400">
            <RefreshCw className="mx-auto h-4 w-4 animate-spin mb-1" />
            Loading dependencies...
          </div>
        ) : dependencies.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No prerequisites defined.</p>
        ) : (
          <div className="space-y-2">
            {dependencies.map((dep) => {
              const target = dep.depends_on_work_item

              if (!target) return null

              return (
                <div
                  key={dep.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <RouterLink
                      to={`/work-items/${target.id}`}
                      className="font-semibold text-slate-900 hover:text-blue-600 truncate"
                    >
                      {target.title}
                    </RouterLink>

                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 border border-slate-200">
                      {target.status}
                    </span>

                    <span className="font-semibold text-slate-600">
                      {target.progress_percent || 0}%
                    </span>

                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${healthBadge(
                        target.health,
                      )}`}
                    >
                      {target.health === 'RED'
                        ? 'OVERDUE'
                        : target.health === 'CRITICAL'
                        ? 'EMERGENCY'
                        : target.health}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveDependency(dep.id)}
                    className="text-slate-400 hover:text-red-600 p-1 cursor-pointer transition shrink-0 ml-2"
                    title="Remove dependency"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Blocked By Chain Visualization */}
      {blockers.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 space-y-3 mt-4">
          <div className="flex items-center gap-2 text-red-800 font-bold text-xs">
            <ShieldAlert className="h-4 w-4 text-red-600" />
            <span>BLOCKED BY {blockers.length} INCOMPLETE PREREQUISITES</span>
          </div>

          <div className="space-y-2 pl-2">
            {blockers.map((b, idx) => {
              const target = b.depends_on_work_item

              if (!target) return null

              return (
                <React.Fragment key={b.id}>
                  <div className="flex items-center justify-between rounded-lg bg-white p-2.5 border border-red-200 text-xs shadow-2xs">
                    <RouterLink
                      to={`/work-items/${target.id}`}
                      className="font-bold text-red-900 hover:underline"
                    >
                      {target.title}
                    </RouterLink>

                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${healthBadge(
                        target.health,
                      )}`}
                    >
                      {target.health === 'RED'
                        ? 'OVERDUE'
                        : target.health === 'CRITICAL'
                        ? 'EMERGENCY'
                        : target.health}
                    </span>
                  </div>

                  {idx < blockers.length - 1 && (
                    <div className="flex justify-center my-0.5">
                      <ArrowDown className="h-3.5 w-3.5 text-red-400" />
                    </div>
                  )}
                </React.Fragment>
              )
            })}

            <div className="flex justify-center my-0.5">
              <ArrowDown className="h-3.5 w-3.5 text-red-500 font-bold" />
            </div>

            <div className="rounded-lg bg-red-100 p-2.5 border border-red-300 text-xs font-bold text-red-900 text-center">
              ↓ {workItem.title} (Current Work)
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
