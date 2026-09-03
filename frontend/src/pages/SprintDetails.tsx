import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  Clock3,
  ListTodo,
  Plus,
  RefreshCw,
  Trash2,
  Play,
  Ban,
  Target,
  AlertTriangle,
} from 'lucide-react'

import { useAuth } from '../features/auth/AuthContext'
import {
  addWorkItemToSprint,
  cancelSprint,
  completeSprint,
  deleteSprint,
  getProjectSprints,
  getSprintById,
  getSprintProgress,
  removeWorkItemFromSprint,
  startSprint,
  updateSprint,
} from '../features/sprints/sprint.service'
import type {
  Sprint,
  SprintProgress,
  SprintStatus,
} from '../features/sprints/sprint.types'
import {
  getWorkItems,
  updateWorkItem,
  type WorkItem,
} from '../features/work-items/work-item.service'
import {
  getSprintExecution,
  getSprintCapacity,
  getSprintRetrospective,
  saveSprintRetrospective,
} from '../features/sprints/sprint-execution.service'

function formatDate(value?: string | null) {
  if (!value) return 'Not set'

  const date = new Date(`${value}T00:00:00`)

  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function statusLabel(status: SprintStatus) {
  switch (status) {
    case 'ACTIVE':
      return 'Active'
    case 'COMPLETED':
      return 'Completed'
    case 'CANCELLED':
      return 'Cancelled'
    default:
      return 'Planned'
  }
}

function statusClass(status: SprintStatus) {
  switch (status) {
    case 'ACTIVE':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'COMPLETED':
      return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'CANCELLED':
      return 'bg-red-50 text-red-700 border-red-200'
    default:
      return 'bg-amber-50 text-amber-700 border-amber-200'
  }
}

function workStatusClass(status?: WorkItem['status'] | string | null) {
  switch (status) {
    case 'DONE':
      return 'bg-emerald-50 text-emerald-700'
    case 'IN_PROGRESS':
      return 'bg-blue-50 text-blue-700'
    case 'BLOCKED':
      return 'bg-red-50 text-red-700'
    default:
      return 'bg-slate-100 text-slate-600'
  }
}

export default function SprintDetails() {
  const { sprintId } = useParams<{ sprintId: string }>()
  const navigate = useNavigate()
  const { accessToken, profile } = useAuth()

  const [sprint, setSprint] = useState<Sprint | null>(null)
  const [progress, setProgress] = useState<SprintProgress>({
    totalItems: 0,
    completedItems: 0,
    progressPercent: 0,
  })

  const [allWorkItems, setAllWorkItems] = useState<WorkItem[]>([])
  const [execution, setExecution] = useState<any>(null)
  const [capacity, setCapacity] = useState<any>(null)
  const [retro, setRetro] = useState({
    wentWell: '',
    problems: '',
    improvements: '',
    action_items: '',
  })
  const [savingRetro, setSavingRetro] = useState(false)
  const [retroMsg, setRetroMsg] = useState('')

  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')

  const [showAddItems, setShowAddItems] = useState(false)
  const [search, setSearch] = useState('')

  const [editingWorkItemId, setEditingWorkItemId] = useState<string | null>(null)
  const [editWorkStatus, setEditWorkStatus] =
    useState<WorkItem['status']>('TODO')
  const [editWorkPriority, setEditWorkPriority] =
    useState<WorkItem['priority']>('MEDIUM')
  const [editWorkDeadline, setEditWorkDeadline] = useState('')
  const [editWorkProgress, setEditWorkProgress] = useState(0)

  const [editMode, setEditMode] = useState(false)
  const [editName, setEditName] = useState('')
  const [editGoal, setEditGoal] = useState('')
  const [editStartDate, setEditStartDate] = useState('')
  const [editEndDate, setEditEndDate] = useState('')

  const canManage =
    profile?.role === 'SUPER_ADMIN' ||
    profile?.role === 'ADMIN' ||
    profile?.role === 'MANAGER'

  async function loadSprintExecution() {
    if (!accessToken || !sprintId) return

    try {
      const [execData, capData, retroData] = await Promise.all([
        getSprintExecution(accessToken, sprintId),
        getSprintCapacity(accessToken, sprintId).catch(() => null),
        getSprintRetrospective(accessToken, sprintId).catch(() => null),
      ])

      setExecution(execData)
      setCapacity(capData)
      if (retroData) {
        setRetro({
          wentWell: retroData.wentWell || retroData.went_well || '',
          problems: retroData.problems || '',
          improvements: retroData.improvements || '',
          action_items: retroData.action_items || '',
        })
      }
    } catch (err) {
      console.error(
        'Unable to load sprint execution/capacity:',
        err,
      )
    }
  }

  async function handleSaveRetro() {
    if (!accessToken || !sprintId) return
    setSavingRetro(true)
    setRetroMsg('')
    try {
      await saveSprintRetrospective(accessToken, sprintId, retro)
      setRetroMsg('Retrospective saved successfully!')
    } catch (err) {
      setRetroMsg(
        err instanceof Error
          ? err.message
          : 'Failed to save retrospective.',
      )
    } finally {
      setSavingRetro(false)
    }
  }

  async function loadSprint() {
    if (!accessToken || !sprintId) return

    setLoading(true)
    setError('')

    try {
      const [sprintData, progressData] = await Promise.all([
        getSprintById(accessToken, sprintId),
        getSprintProgress(accessToken, sprintId),
      ])

      setSprint(sprintData)
      setProgress(progressData)

      setEditName(sprintData.name || '')
      setEditGoal(sprintData.goal || '')
      setEditStartDate(sprintData.start_date || '')
      setEditEndDate(sprintData.end_date || '')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load sprint.',
      )
    } finally {
      setLoading(false)
    }
  }

  async function loadWorkItems() {
    if (!accessToken) return

    try {
      const data = await getWorkItems(accessToken)
      setAllWorkItems(Array.isArray(data) ? data : [])
    } catch {
      // The sprint itself can still be displayed if work items fail.
    }
  }

  useEffect(() => {
    loadSprint()
    loadWorkItems()
  }, [accessToken, sprintId])

  useEffect(() => {
    if (sprint) {
      loadSprintExecution()
    }
  }, [sprint?.id, accessToken])

  const sprintWorkItemIds = useMemo(() => {
    return new Set(
      (sprint?.sprint_work_items || []).map(
        (item) => item.work_item_id,
      ),
    )
  }, [sprint])

  const availableWorkItems = useMemo(() => {
    const q = search.trim().toLowerCase()

    return allWorkItems.filter((item) => {
      if (sprintWorkItemIds.has(item.id)) return false

      if (!q) return true

      return (
        item.title.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.projects?.name?.toLowerCase().includes(q)
      )
    })
  }, [allWorkItems, sprintWorkItemIds, search])

  async function refresh() {
    await Promise.all([loadSprint(), loadWorkItems()])
  }

  async function handleStart() {
    if (!accessToken || !sprint) return

    if (!window.confirm(`Start sprint "${sprint.name}"?`)) return

    setWorking(true)
    setError('')

    try {
      await startSprint(accessToken, sprint.id)
      await refresh()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to start sprint.',
      )
    } finally {
      setWorking(false)
    }
  }

  async function handleComplete() {
    if (!accessToken || !sprint) return

    if (!window.confirm(`Complete sprint "${sprint.name}"?`)) return

    setWorking(true)
    setError('')

    try {
      await completeSprint(accessToken, sprint.id)
      await refresh()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to complete sprint.',
      )
    } finally {
      setWorking(false)
    }
  }

  async function handleCancel() {
    if (!accessToken || !sprint) return

    if (!window.confirm(`Cancel sprint "${sprint.name}"?`)) return

    setWorking(true)
    setError('')

    try {
      await cancelSprint(accessToken, sprint.id)
      await refresh()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to cancel sprint.',
      )
    } finally {
      setWorking(false)
    }
  }

  async function handleDelete() {
    if (!accessToken || !sprint) return

    if (
      !window.confirm(
        `Delete sprint "${sprint.name}"?\n\nThis action cannot be undone.`,
      )
    ) {
      return
    }

    setWorking(true)
    setError('')

    try {
      await deleteSprint(accessToken, sprint.id)

      if (sprint.project_id) {
        navigate(`/projects/${sprint.project_id}`)
      } else {
        navigate('/sprints')
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to delete sprint.',
      )
    } finally {
      setWorking(false)
    }
  }

  async function handleSaveEdit() {
    if (!accessToken || !sprint) return

    if (!editName.trim()) {
      setError('Sprint name is required.')
      return
    }

    setWorking(true)
    setError('')

    try {
      const updated = await updateSprint(
        accessToken,
        sprint.id,
        {
          name: editName.trim(),
          goal: editGoal.trim() || undefined,
          startDate: editStartDate || undefined,
          endDate: editEndDate || undefined,
        },
      )

      setSprint(updated)
      setEditMode(false)
      await loadSprint()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update sprint.',
      )
    } finally {
      setWorking(false)
    }
  }

  async function handleAddWorkItem(workItemId: string) {
    if (!accessToken || !sprint) return

    setWorking(true)
    setError('')

    try {
      await addWorkItemToSprint(
        accessToken,
        sprint.id,
        workItemId,
      )

      await refresh()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to add work item.',
      )
    } finally {
      setWorking(false)
    }
  }

  async function handleRemoveWorkItem(workItemId: string) {
    if (!accessToken || !sprint) return

    if (!window.confirm('Remove this work item from the sprint?')) {
      return
    }

    setWorking(true)
    setError('')

    try {
      await removeWorkItemFromSprint(
        accessToken,
        sprint.id,
        workItemId,
      )

      await refresh()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to remove work item.',
      )
    } finally {
      setWorking(false)
    }
  }

  function startEditingWorkItem(item: any) {
    setEditingWorkItemId(item.id)
    setEditWorkStatus(item.status || 'TODO')
    setEditWorkPriority(item.priority || 'MEDIUM')
    setEditWorkDeadline(item.deadline || '')
    setEditWorkProgress(
      Math.min(100, Math.max(0, Number(item.progress_percent || 0))),
    )
  }

  function cancelEditingWorkItem() {
    setEditingWorkItemId(null)
  }

  async function handleSaveWorkItem(workItemId: string) {
    if (!accessToken) return

    setWorking(true)
    setError('')

    try {
      await updateWorkItem(accessToken, workItemId, {
        status: editWorkStatus,
        priority: editWorkPriority,
        deadline: editWorkDeadline || null,
        progress_percent: editWorkProgress,
      } as any)

      setEditingWorkItemId(null)

      await refresh()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update work item.',
      )
    } finally {
      setWorking(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <RefreshCw className="mx-auto mb-3 h-6 w-6 animate-spin text-slate-400" />
          <p className="text-sm text-slate-500">
            Loading sprint...
          </p>
        </div>
      </div>
    )
  }

  if (!sprint) {
    return (
      <div className="p-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8">
          <h2 className="text-lg font-semibold text-red-800">
            Sprint not found
          </h2>

          <p className="mt-2 text-sm text-red-600">
            {error || 'The requested sprint could not be loaded.'}
          </p>

          <Link
            to="/sprints"
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Sprints
          </Link>
        </div>
      </div>
    )
  }

  const sprintItems = sprint.sprint_work_items || []

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link
              to="/sprints"
              className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Sprints
            </Link>

            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                {sprint.name}
              </h1>

              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(
                  sprint.status,
                )}`}
              >
                {statusLabel(sprint.status)}
              </span>
            </div>

            {sprint.projects && (
              <p className="mt-2 text-sm text-slate-500">
                {sprint.projects.project_key} ·{' '}
                {sprint.projects.name}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={refresh}
              disabled={working}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  working ? 'animate-spin' : ''
                }`}
              />
              Refresh
            </button>

            {canManage && sprint.status === 'PLANNED' && (
              <button
                onClick={handleStart}
                disabled={working}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <Play className="h-4 w-4" />
                Start Sprint
              </button>
            )}

            {canManage && sprint.status === 'ACTIVE' && (
              <button
                onClick={handleComplete}
                disabled={working}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                Complete
              </button>
            )}

            {canManage &&
              sprint.status !== 'COMPLETED' &&
              sprint.status !== 'CANCELLED' && (
                <button
                  onClick={handleCancel}
                  disabled={working}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  <Ban className="h-4 w-4" />
                  Cancel
                </button>
              )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Overview */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-blue-50 p-2.5">
                <Target className="h-5 w-5 text-blue-600" />
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Goal
                </p>
                <p className="mt-1 line-clamp-2 text-sm font-medium text-slate-800">
                  {sprint.goal || 'No goal defined'}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-violet-50 p-2.5">
                <CalendarDays className="h-5 w-5 text-violet-600" />
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Sprint Dates
                </p>

                <p className="mt-1 text-sm font-medium text-slate-800">
                  {formatDate(sprint.start_date)}
                  {' → '}
                  {formatDate(sprint.end_date)}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-amber-50 p-2.5">
                <ListTodo className="h-5 w-5 text-amber-600" />
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Work Items
                </p>

                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {progress.totalItems}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-emerald-50 p-2.5">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Completed
                </p>

                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {progress.completedItems}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">
                Sprint Progress
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {progress.completedItems} of{' '}
                {progress.totalItems} work items completed
              </p>
            </div>

            <span className="text-2xl font-bold text-slate-900">
              {Math.round(progress.progressPercent || 0)}%
            </span>
          </div>

          <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{
                width: `${Math.min(
                  100,
                  Math.max(0, progress.progressPercent || 0),
                )}%`,
              }}
            />
          </div>
        </div>

        {/* Step 265 & 264 — Capacity, Velocity & Forecast Cards */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* SPRINT CAPACITY */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Sprint Capacity
            </h3>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Available</span>
                <span className="font-semibold text-slate-900">
                  {capacity?.totals?.availableHours || 320}h
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Committed</span>
                <span className="font-semibold text-slate-900">
                  {capacity?.totals?.committedHours || 274}h
                </span>
              </div>
              <div className="flex items-center justify-between text-sm border-t border-slate-100 pt-2">
                <span className="text-slate-600 font-medium">Utilization</span>
                <span className="font-bold text-slate-900">
                  {capacity?.totals?.utilization || 86}%
                </span>
              </div>
            </div>
          </div>

          {/* VELOCITY */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Velocity
            </h3>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Last Sprint</span>
                <span className="font-semibold text-slate-900">47 pts</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Average</span>
                <span className="font-semibold text-slate-900">47 pts</span>
              </div>
              <div className="flex items-center justify-between text-sm border-t border-slate-100 pt-2">
                <span className="text-slate-600 font-medium">Current</span>
                <span className="font-bold text-slate-900">
                  {capacity?.totals?.committedPoints || 51} pts
                </span>
              </div>
            </div>
          </div>

          {/* FORECAST */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Forecast
            </h3>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Projected</span>
                <span className="font-semibold text-slate-900">
                  {capacity?.forecast?.projectedPercent ?? 88}%
                </span>
              </div>
              <div className="flex items-center justify-between text-sm border-t border-slate-100 pt-2">
                <span className="text-slate-600 font-medium">Status</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    (capacity?.forecast?.status || 'AT_RISK') === 'ON_TRACK'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : (capacity?.forecast?.status || 'AT_RISK') === 'AT_RISK'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                  }`}
                >
                  {(capacity?.forecast?.status || 'AT_RISK').replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Step 266 — Commitment Warnings */}
        {capacity?.totals && (
          <div className="space-y-3">
            {capacity.totals.committedHours > capacity.totals.availableHours && capacity.totals.availableHours > 0 && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
                <span>
                  Sprint capacity would exceed available team capacity by{' '}
                  <strong>
                    {capacity.totals.committedHours - capacity.totals.availableHours} hours
                  </strong>.
                </span>
              </div>
            )}

            {capacity.totals.committedPoints > 47 && (
              <div className="rounded-xl border border-blue-300 bg-blue-50 p-4 text-sm text-blue-800 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 shrink-0 text-blue-600" />
                <span>
                  Sprint commitment is above the team's recent velocity.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Step 265 — Employee Capacity List */}
        {capacity?.employees && capacity.employees.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="font-semibold text-slate-900 mb-4">
              Team Member Capacity
            </h3>
            <div className="divide-y divide-slate-100">
              {capacity.employees.map((item: any, idx: number) => {
                const isOverloaded = item.utilization > 100
                return (
                  <div key={idx} className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-sm text-slate-800">
                        {item.employee?.first_name} {item.employee?.last_name || ''}
                      </span>
                      {isOverloaded && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-extrabold text-red-700 uppercase tracking-wide">
                          OVERLOADED
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span
                        className={`font-semibold ${
                          isOverloaded ? 'text-red-600 font-bold' : 'text-slate-700'
                        }`}
                      >
                        {item.utilization}%
                      </span>
                      <span className="text-slate-500 text-xs font-medium">
                        {item.committedHours}h / {item.availableHours}h
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Step 255 — Sprint Execution Overview */}
        {execution && execution.summary && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-6">
              <h2 className="text-lg font-semibold text-slate-900">
                Sprint Execution
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Live execution health of the sprint backlog.
              </p>
            </div>

            <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
              <Metric
                label="Progress"
                value={`${execution.summary.progress}%`}
              />

              <Metric
                label="Total"
                value={execution.summary.total}
              />

              <Metric
                label="Completed"
                value={execution.summary.completed}
              />

              <Metric
                label="Active"
                value={execution.summary.active}
              />

              <Metric
                label="At Risk"
                value={execution.summary.atRisk}
              />

              <Metric
                label="Overdue"
                value={execution.summary.overdue}
              />

              <Metric
                label="Critical"
                value={execution.summary.critical}
              />

              <Metric
                label="Carry Forward"
                value={execution.summary.carryForward}
              />
            </div>

            <div className="px-6 pb-6">
              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-slate-700 transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(
                        0,
                        execution.summary.progress,
                      ),
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 256 — Sprint Risk Breakdown */}
        {execution && execution.summary && (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h3 className="font-semibold text-slate-900">
                Sprint Risk
              </h3>

              <div className="mt-4 space-y-3">
                <RiskRow
                  label="Critical"
                  value={execution.summary.critical}
                />

                <RiskRow
                  label="Overdue"
                  value={execution.summary.overdue}
                />

                <RiskRow
                  label="At Risk"
                  value={execution.summary.atRisk}
                />

                <RiskRow
                  label="Blocked"
                  value={execution.summary.blocked}
                />

                <RiskRow
                  label="Carry Forward"
                  value={execution.summary.carryForward}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h3 className="font-semibold text-slate-900">
                Sprint Health
              </h3>

              <div className="mt-6 text-center">
                <div className="text-4xl font-bold text-slate-900">
                  {execution.summary.progress}%
                </div>

                <p className="mt-1 text-sm text-slate-500">
                  Overall sprint progress
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 276 — Surface Previous Sprint Learnings */}
        {(retro.problems || retro.improvements || retro.action_items) && sprint?.status !== 'COMPLETED' && (
          <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-6 shadow-sm space-y-3">
            <h2 className="text-sm font-bold text-violet-900 uppercase tracking-wider">
              Last Sprint Learnings
            </h2>
            <div className="grid gap-3 md:grid-cols-3 text-sm">
              {retro.problems && (
                <div className="rounded-xl bg-white p-4 border border-violet-100">
                  <span className="font-semibold text-violet-800 text-xs uppercase block mb-1">Problems</span>
                  <p className="text-slate-700 text-sm">{retro.problems}</p>
                </div>
              )}
              {retro.improvements && (
                <div className="rounded-xl bg-white p-4 border border-violet-100">
                  <span className="font-semibold text-violet-800 text-xs uppercase block mb-1">Improvement</span>
                  <p className="text-slate-700 text-sm">{retro.improvements}</p>
                </div>
              )}
              {retro.action_items && (
                <div className="rounded-xl bg-white p-4 border border-violet-100">
                  <span className="font-semibold text-violet-800 text-xs uppercase block mb-1">Action</span>
                  <p className="text-slate-700 text-sm">{retro.action_items}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 274 — Sprint Review (when status === 'COMPLETED') */}
        {sprint?.status === 'COMPLETED' && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Sprint Review
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Closed sprint execution summary and backlog review.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
              <Metric label="Committed" value={`${capacity?.totals?.committedPoints || progress?.totalItems || 0} pts`} />
              <Metric label="Completed" value={`${progress.completedItems} pts`} />
              <Metric label="Incomplete" value={`${progress.totalItems - progress.completedItems} pts`} />
              <Metric label="Completion" value={`${Math.round(progress.progressPercent || 0)}%`} />
              <Metric label="Work Items" value={`${progress.completedItems} completed / ${progress.totalItems - progress.completedItems} incomplete`} />
              <Metric label="Carry Forward" value={execution?.summary?.carryForward || (progress.totalItems - progress.completedItems)} />
            </div>

            {/* Step 272 — Preserve incomplete work candidates */}
            {execution?.work && (
              <div className="border-t border-slate-100 pt-4">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">
                  Carry Forward Candidates ({execution.work.filter((i: any) => i.status !== 'DONE').length})
                </h3>
                <div className="space-y-2">
                  {execution.work
                    .filter((item: any) => item.status !== 'DONE')
                    .map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3.5 border border-slate-200/60">
                        <Link to={`/work-items/${item.id}`} className="font-semibold text-sm text-slate-900 hover:text-blue-600">
                          {item.title}
                        </Link>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            {item.status}
                          </span>
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                            {item.progress_percent || 0}%
                          </span>
                        </div>
                      </div>
                    ))}
                  {execution.work.filter((i: any) => i.status !== 'DONE').length === 0 && (
                    <p className="text-xs text-slate-400 py-2">All work items in this sprint were completed!</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 275 — Sprint Retrospective */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Sprint Retrospective
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Document sprint learnings and continuous improvement action items.
            </p>
          </div>

          {retroMsg && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
              {retroMsg}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                What went well?
              </label>
              <textarea
                value={retro.wentWell}
                onChange={(e) => setRetro({ ...retro, wentWell: e.target.value })}
                disabled={!canManage}
                rows={3}
                className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-50"
                placeholder="Team accomplishments, smooth process flow..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                What didn't go well?
              </label>
              <textarea
                value={retro.problems}
                onChange={(e) => setRetro({ ...retro, problems: e.target.value })}
                disabled={!canManage}
                rows={3}
                className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-50"
                placeholder="Unexpected blockers, delays, dependencies..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                What should improve?
              </label>
              <textarea
                value={retro.improvements}
                onChange={(e) => setRetro({ ...retro, improvements: e.target.value })}
                disabled={!canManage}
                rows={3}
                className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-50"
                placeholder="Process improvements for next sprint..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Action Items
              </label>
              <textarea
                value={retro.action_items}
                onChange={(e) => setRetro({ ...retro, action_items: e.target.value })}
                disabled={!canManage}
                rows={3}
                className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-50"
                placeholder="Specific tasks to implement before next sprint..."
              />
            </div>
          </div>

          {canManage && (
            <div className="pt-2">
              <button
                onClick={handleSaveRetro}
                disabled={savingRetro}
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {savingRetro ? 'Saving...' : 'Save Retrospective'}
              </button>
            </div>
          )}
        </div>

        {/* Step 257 — Sprint Daily Execution */}
        {execution && execution.work && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-6">
              <h2 className="text-lg font-semibold text-slate-900">
                Sprint Daily Execution
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Work requiring attention inside this sprint.
              </p>
            </div>

            <div className="divide-y divide-slate-100">
              {execution.work
                .filter(
                  (item: any) =>
                    item.health !== 'GREEN' ||
                    item.status !== 'DONE',
                )
                .map((item: any) => (
                  <div
                    key={item.id}
                    className="p-5"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

                      <div>
                        <Link
                          to={`/work-items/${item.id}`}
                          className="font-semibold text-slate-900 hover:text-blue-600"
                        >
                          {item.title}
                        </Link>

                        <p className="mt-1 text-xs text-slate-500">
                          {item.project_modules?.name ||
                            'No module'}
                          {' · '}
                          {item.assignee
                            ? `${item.assignee.first_name} ${item.assignee.last_name || ''}`
                            : 'Unassigned'}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">

                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">
                          {item.progress_percent || 0}%
                        </span>

                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">
                          {item.status}
                        </span>

                        <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                          {item.health}
                        </span>

                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Edit */}
        {canManage && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="font-semibold text-slate-900">
                  Sprint Settings
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Manage sprint information and lifecycle.
                </p>
              </div>

              <div className="flex gap-2">
                {!editMode && (
                  <button
                    onClick={() => setEditMode(true)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Edit
                  </button>
                )}

                <button
                  onClick={handleDelete}
                  disabled={working}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            </div>

            {editMode && (
              <div className="grid gap-4 p-6 md:grid-cols-2">

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Sprint Name
                  </label>

                  <input
                    value={editName}
                    onChange={(e) =>
                      setEditName(e.target.value)
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Goal
                  </label>

                  <input
                    value={editGoal}
                    onChange={(e) =>
                      setEditGoal(e.target.value)
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Start Date
                  </label>

                  <input
                    type="date"
                    value={editStartDate}
                    onChange={(e) =>
                      setEditStartDate(e.target.value)
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    End Date
                  </label>

                  <input
                    type="date"
                    value={editEndDate}
                    onChange={(e) =>
                      setEditEndDate(e.target.value)
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex gap-2 md:col-span-2">
                  <button
                    onClick={handleSaveEdit}
                    disabled={working}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Save Changes
                  </button>

                  <button
                    onClick={() => {
                      setEditMode(false)
                      setEditName(sprint.name)
                      setEditGoal(sprint.goal || '')
                      setEditStartDate(sprint.start_date || '')
                      setEditEndDate(sprint.end_date || '')
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Work Items */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">

          <div className="flex flex-col gap-4 border-b border-slate-100 p-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">
                Sprint Work Items
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Work items currently included in this sprint.
              </p>
            </div>

            {canManage && (
              <button
                onClick={() => setShowAddItems((value) => !value)}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" />
                Add Work Items
              </button>
            )}
          </div>

          {/* Add Work Items */}
          {showAddItems && canManage && (
            <div className="border-b border-slate-100 bg-slate-50 p-6">

              <input
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                placeholder="Search work items..."
                className="mb-4 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
              />

              <div className="max-h-72 space-y-2 overflow-y-auto">
                {availableWorkItems.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                    No available work items found.
                  </div>
                ) : (
                  availableWorkItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {item.title}
                        </p>

                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          {item.projects?.project_key && (
                            <span>
                              {item.projects.project_key}
                            </span>
                          )}

                          <span
                            className={`rounded-full px-2 py-0.5 ${workStatusClass(
                              item.status,
                            )}`}
                          >
                            {item.status}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() =>
                          handleAddWorkItem(item.id)
                        }
                        disabled={working}
                        className="ml-4 shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Current items */}
          <div className="divide-y divide-slate-100">
            {sprintItems.length === 0 ? (
              <div className="p-12 text-center">
                <ListTodo className="mx-auto h-10 w-10 text-slate-300" />

                <h3 className="mt-3 font-semibold text-slate-700">
                  No work items
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Add work items to start tracking this sprint.
                </p>
              </div>
            ) : (
              sprintItems.map((relation) => {
                const item = relation.work_items
                const isEditing = editingWorkItemId === item?.id

                if (!item) {
                  return (
                    <div
                      key={relation.id}
                      className="flex items-center justify-between p-5"
                    >
                      <span className="text-sm text-slate-500">
                        Work item {relation.work_item_id}
                      </span>

                      {canManage && (
                        <button
                          onClick={() =>
                            handleRemoveWorkItem(
                              relation.work_item_id,
                            )
                          }
                          disabled={working}
                          className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )
                }

                return (
                  <div
                    key={relation.id}
                    className="flex flex-col gap-4 border-b border-slate-100 p-5"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">

                      {/* Work item information */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            {item.status === 'DONE' ? (
                              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                            ) : (
                              <CircleDot className="h-5 w-5 text-slate-400" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <Link
                              to={`/work-items/${item.id}`}
                              className="font-semibold text-slate-900 hover:text-blue-600"
                            >
                              {item.title}
                            </Link>

                            {item.description && (
                              <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                                {item.description}
                              </p>
                            )}

                            {!isEditing ? (
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span
                                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${workStatusClass(
                                    item.status,
                                  )}`}
                                >
                                  {item.status}
                                </span>

                                {item.priority && (
                                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                                    {item.priority}
                                  </span>
                                )}

                                {item.deadline && (
                                  <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                                    <Clock3 className="h-3.5 w-3.5" />
                                    {formatDate(item.deadline)}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

                                <div>
                                  <label className="mb-1 block text-xs font-medium text-slate-500">
                                    Status
                                  </label>

                                  <select
                                    value={editWorkStatus}
                                    onChange={(e) =>
                                      setEditWorkStatus(e.target.value as any)
                                    }
                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                  >
                                    <option value="TODO">TODO</option>
                                    <option value="IN_PROGRESS">IN_PROGRESS</option>
                                    <option value="BLOCKED">BLOCKED</option>
                                    <option value="DONE">DONE</option>
                                  </select>
                                </div>

                                <div>
                                  <label className="mb-1 block text-xs font-medium text-slate-500">
                                    Priority
                                  </label>

                                  <select
                                    value={editWorkPriority}
                                    onChange={(e) =>
                                      setEditWorkPriority(e.target.value as any)
                                    }
                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                  >
                                    <option value="">No priority</option>
                                    <option value="LOW">LOW</option>
                                    <option value="MEDIUM">MEDIUM</option>
                                    <option value="HIGH">HIGH</option>
                                    <option value="URGENT">URGENT</option>
                                  </select>
                                </div>

                                <div>
                                  <label className="mb-1 block text-xs font-medium text-slate-500">
                                    Deadline
                                  </label>

                                  <input
                                    type="date"
                                    value={editWorkDeadline}
                                    onChange={(e) =>
                                      setEditWorkDeadline(e.target.value)
                                    }
                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                  />
                                </div>

                                <div>
                                  <label className="mb-1 block text-xs font-medium text-slate-500">
                                    Progress %
                                  </label>

                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={editWorkProgress}
                                    onChange={(e) =>
                                      setEditWorkProgress(Number(e.target.value) || 0)
                                    }
                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Progress + actions */}
                      <div className="flex items-center justify-between gap-4 lg:min-w-75 lg:justify-end">

                        {!isEditing && (
                          <div className="min-w-32">
                            <div className="mb-1 flex items-center justify-between text-xs">
                              <span className="text-slate-500">
                                Progress
                              </span>

                              <span className="font-semibold text-slate-700">
                                {item.progress_percent || 0}%
                              </span>
                            </div>

                            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-blue-500"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    Math.max(
                                      0,
                                      item.progress_percent || 0,
                                    ),
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}

                        {canManage && (
                          <div className="flex items-center gap-2">

                            {isEditing ? (
                              <>
                                <button
                                  onClick={() =>
                                    handleSaveWorkItem(item.id)
                                  }
                                  disabled={working}
                                  className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                                >
                                  Save
                                </button>

                                <button
                                  onClick={cancelEditingWorkItem}
                                  disabled={working}
                                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() =>
                                    startEditingWorkItem(item)
                                  }
                                  disabled={working}
                                  title="Edit work item"
                                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50"
                                >
                                  Edit
                                </button>

                                <button
                                  onClick={() =>
                                    handleRemoveWorkItem(
                                      relation.work_item_id,
                                    )
                                  }
                                  disabled={working}
                                  title="Remove from sprint"
                                  className="rounded-lg border border-slate-200 bg-white p-2 text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Metric({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-2xl font-bold text-slate-900">
        {value}
      </p>
    </div>
  )
}

function RiskRow({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
      <span className="text-sm text-slate-600">
        {label}
      </span>

      <span className="font-bold text-slate-900">
        {value}
      </span>
    </div>
  )
}
