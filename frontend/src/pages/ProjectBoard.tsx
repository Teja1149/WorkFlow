import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Flame,
  FolderKanban,
  Layers,
  Layers3,
  ListTodo,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  User,
  Users,
  Zap,
} from 'lucide-react'
import { useAuth } from '../features/auth/AuthContext'
import { getProjects, type Project } from '../features/projects/project.service'
import {
  getWorkItems,
  updateWorkItemStatus,
  createWorkItem,
  type WorkItem,
} from '../features/work-items/work-item.service'
import { subscribeToWorkItems } from '../features/work-items/work-item.realtime'
import {
  getProjectSprints,
  getSprintById,
  addWorkItemToSprint,
} from '../features/sprints/sprint.service'
import type { Sprint } from '../features/sprints/sprint.types'
import { getEmployees } from '../features/employees/employee.service'
import type { UserProfile } from '../features/auth/auth.types'
import { getWorkTypes } from '../features/work-types/work-type.service'
import type { WorkType } from '../features/work-types/work-type.types'
import WorkDetailsDrawer from '../features/work-items/WorkDetailsDrawer'

type KanbanColumnId = 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE'
type ScrumColumnId = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE'

const KANBAN_COLUMNS: { id: KanbanColumnId; label: string; color: string; badgeBg: string }[] = [
  { id: 'BACKLOG', label: 'Backlog', color: 'border-slate-300 bg-slate-50/70', badgeBg: 'bg-slate-200 text-slate-700' },
  { id: 'TODO', label: 'To Do', color: 'border-sky-200 bg-sky-50/40', badgeBg: 'bg-sky-100 text-sky-700' },
  { id: 'IN_PROGRESS', label: 'In Progress', color: 'border-amber-200 bg-amber-50/40', badgeBg: 'bg-amber-100 text-amber-800' },
  { id: 'IN_REVIEW', label: 'In Review', color: 'border-purple-200 bg-purple-50/40', badgeBg: 'bg-purple-100 text-purple-700' },
  { id: 'DONE', label: 'Done', color: 'border-emerald-200 bg-emerald-50/40', badgeBg: 'bg-emerald-100 text-emerald-800' },
]

const SCRUM_COLUMNS: { id: ScrumColumnId; label: string; color: string; badgeBg: string }[] = [
  { id: 'TODO', label: 'To Do', color: 'border-sky-200 bg-sky-50/40', badgeBg: 'bg-sky-100 text-sky-700' },
  { id: 'IN_PROGRESS', label: 'In Progress', color: 'border-amber-200 bg-amber-50/40', badgeBg: 'bg-amber-100 text-amber-800' },
  { id: 'IN_REVIEW', label: 'In Review', color: 'border-purple-200 bg-purple-50/40', badgeBg: 'bg-purple-100 text-purple-700' },
  { id: 'DONE', label: 'Done', color: 'border-emerald-200 bg-emerald-50/40', badgeBg: 'bg-emerald-100 text-emerald-800' },
]

export default function ProjectBoard() {
  const { projectId } = useParams<{ projectId: string }>()
  const { accessToken, profile } = useAuth()
  const navigate = useNavigate()

  const [project, setProject] = useState<Project | null>(null)
  const [workItems, setWorkItems] = useState<WorkItem[]>([])
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [selectedSprintId, setSelectedSprintId] = useState<string>('')
  const [sprintWorkItemIds, setSprintWorkItemIds] = useState<string[]>([])
  const [employees, setEmployees] = useState<UserProfile[]>([])
  const [workTypes, setWorkTypes] = useState<WorkType[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedAssignee, setSelectedAssignee] = useState<string>('ALL')
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL')

  // Selected work for details drawer
  const [drawerWork, setDrawerWork] = useState<WorkItem | null>(null)
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)

  // Create Work Item Quick Modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newPriority, setNewPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM')
  const [newWorkTypeId, setNewWorkTypeId] = useState('')
  const [newAssigneeId, setNewAssigneeId] = useState('')
  const [newEstimatedHours, setNewEstimatedHours] = useState('')
  const [creatingWork, setCreatingWork] = useState(false)

  // Load all project board data
  async function loadData() {
    if (!accessToken || !projectId) return
    setLoading(true)
    setError('')

    try {
      const [projectsList, allItems, empList, wtList] = await Promise.all([
        getProjects(accessToken).catch(() => []),
        getWorkItems(accessToken).catch(() => []),
        getEmployees(accessToken).catch(() => []),
        getWorkTypes(accessToken).catch(() => []),
      ])

      const found = projectsList.find((p) => p.id === projectId)
      if (!found) {
        setError('Project not found.')
        setLoading(false)
        return
      }

      setProject(found)
      setEmployees(empList)
      setWorkTypes(wtList)

      // Filter work items for this project
      const projItems = allItems.filter((w) => w.project_id === projectId)
      setWorkItems(projItems)

      if (found.methodology === 'SCRUM') {
        const sprintList = await getProjectSprints(accessToken, projectId).catch(() => [])
        setSprints(sprintList)

        // Select active sprint or first sprint
        const active = sprintList.find((s) => s.status === 'ACTIVE')
        const targetSprint = active || sprintList.find((s) => s.status === 'PLANNED') || sprintList[0]

        if (targetSprint) {
          setSelectedSprintId(targetSprint.id)
          await loadSprintItems(targetSprint.id)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project board.')
    } finally {
      setLoading(false)
    }
  }

  async function loadSprintItems(sprintId: string) {
    if (!accessToken || !sprintId) return
    try {
      const sprintDetail = await getSprintById(accessToken, sprintId)
      const ids = ((sprintDetail as any).sprint_work_items || []).map(
        (sw: any) => sw.work_item_id || sw.work_items?.id,
      )
      setSprintWorkItemIds(ids.filter(Boolean))
    } catch {
      setSprintWorkItemIds([])
    }
  }

  useEffect(() => {
    loadData()
  }, [accessToken, projectId])

  // Realtime subscription
  useEffect(() => {
    if (!profile?.organization_id) return
    const unsubscribe = subscribeToWorkItems(profile.organization_id, () => {
      getWorkItems(accessToken!).then((allItems) => {
        setWorkItems(allItems.filter((w) => w.project_id === projectId))
      }).catch(() => {})
    })
    return () => {
      unsubscribe()
    }
  }, [profile?.organization_id, accessToken, projectId])

  // Handle sprint switch in Scrum mode
  async function handleSprintChange(sprintId: string) {
    setSelectedSprintId(sprintId)
    await loadSprintItems(sprintId)
  }

  // Active/selected sprint object
  const activeSprint = useMemo(() => {
    return sprints.find((s) => s.id === selectedSprintId) || null
  }, [sprints, selectedSprintId])

  // Sprint Progress stats
  const sprintStats = useMemo(() => {
    if (!activeSprint) return { total: 0, completed: 0, percent: 0 }
    const itemsInSprint = workItems.filter((w) => sprintWorkItemIds.includes(w.id))
    const completed = itemsInSprint.filter((w) => w.status === 'DONE').length
    const total = itemsInSprint.length
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0
    return { total, completed, percent }
  }, [activeSprint, workItems, sprintWorkItemIds])

  // Filtered items
  const filteredWorkItems = useMemo(() => {
    return workItems.filter((item) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesTitle = item.title.toLowerCase().includes(q)
        const matchesDesc = (item.description || '').toLowerCase().includes(q)
        if (!matchesTitle && !matchesDesc) return false
      }
      if (selectedAssignee !== 'ALL') {
        if (selectedAssignee === 'UNASSIGNED') {
          if (item.assigned_to) return false
        } else if (item.assigned_to !== selectedAssignee) {
          return false
        }
      }
      if (selectedPriority !== 'ALL' && item.priority !== selectedPriority) {
        return false
      }
      return true
    })
  }, [workItems, searchQuery, selectedAssignee, selectedPriority])

  // Board items separation
  const scrumBoardItems = useMemo(() => {
    return filteredWorkItems.filter((w) => sprintWorkItemIds.includes(w.id))
  }, [filteredWorkItems, sprintWorkItemIds])

  const backlogItems = useMemo(() => {
    return filteredWorkItems.filter((w) => !sprintWorkItemIds.includes(w.id))
  }, [filteredWorkItems, sprintWorkItemIds])

  // Status transition handler
  async function handleMoveStatus(itemId: string, newStatus: string) {
    if (!accessToken) return
    const targetStatus = newStatus === 'BACKLOG' ? 'TODO' : newStatus

    // Optimistic UI update
    setWorkItems((prev) =>
      prev.map((w) => (w.id === itemId ? { ...w, status: targetStatus as any } : w)),
    )

    try {
      await updateWorkItemStatus(accessToken, itemId, targetStatus as any)
    } catch (err) {
      console.error('Failed to update status:', err)
      // Revert on error
      loadData()
    }
  }

  // Drag and drop handlers
  function handleDragStart(e: React.DragEvent, id: string) {
    e.dataTransfer.setData('text/plain', id)
    setDraggedItemId(id)
  }

  function handleDragOver(e: React.DragEvent, colId: string) {
    e.preventDefault()
    setDragOverColumn(colId)
  }

  function handleDragLeave() {
    setDragOverColumn(null)
  }

  async function handleDrop(e: React.DragEvent, colId: string) {
    e.preventDefault()
    setDragOverColumn(null)
    const itemId = e.dataTransfer.getData('text/plain') || draggedItemId
    if (!itemId) return
    await handleMoveStatus(itemId, colId)
    setDraggedItemId(null)
  }

  // Quick Add Work Item
  async function handleCreateWorkItem(e: React.FormEvent) {
    e.preventDefault()
    if (!accessToken || !projectId || !newTitle.trim()) return
    setCreatingWork(true)
    try {
      const created = await createWorkItem(accessToken, {
        project_id: projectId,
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        priority: newPriority,
        work_type_id: newWorkTypeId || null,
        assigned_to: newAssigneeId || null,
        estimated_hours: newEstimatedHours ? Number(newEstimatedHours) : null,
      })

      // If Scrum mode and a sprint is selected, add to sprint
      if (project?.methodology === 'SCRUM' && selectedSprintId) {
        await addWorkItemToSprint(accessToken, selectedSprintId, created.id).catch(() => {})
      }

      setNewTitle('')
      setNewDescription('')
      setNewPriority('MEDIUM')
      setNewWorkTypeId('')
      setNewAssigneeId('')
      setNewEstimatedHours('')
      setShowCreateModal(false)
      await loadData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create work item.')
    } finally {
      setCreatingWork(false)
    }
  }

  // Add Backlog Item to Current Sprint
  async function handleAddToSprint(workItemId: string) {
    if (!accessToken || !selectedSprintId) return
    try {
      await addWorkItemToSprint(accessToken, selectedSprintId, workItemId)
      await loadSprintItems(selectedSprintId)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add work item to sprint.')
    }
  }

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500 font-medium">
          <RefreshCw className="h-5 w-5 animate-spin text-[#801424]" />
          Loading project board...
        </div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4">
        <button
          onClick={() => navigate('/projects')}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Projects
        </button>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
          <h3 className="font-bold text-base">Error Loading Board</h3>
          <p className="mt-1 text-xs">{error || 'Project not found.'}</p>
        </div>
      </div>
    )
  }

  const isScrum = project.methodology === 'SCRUM'

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/projects/${projectId}`)}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-2xs transition cursor-pointer"
            title="Back to Project Details"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="rounded-md bg-slate-900 px-2 py-0.5 font-mono text-xs font-black text-white">
                {project.project_key}
              </span>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                {project.name}
              </h1>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-black tracking-wide border ${
                  isScrum
                    ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                }`}
              >
                {project.methodology}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isScrum
                ? 'Sprint-driven execution board with time-boxed delivery.'
                : 'Continuous Kanban board with flexible work-in-progress flow.'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadData()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs transition cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#801424] px-4 py-2 text-xs font-bold text-white hover:bg-[#9f1239] shadow-xs transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            New Work Item
          </button>
        </div>
      </div>

      {/* SCRUM VIEW: Active Sprint Banner */}
      {isScrum && (
        <div className="rounded-2xl border border-indigo-100 bg-linear-to-r from-indigo-50/70 via-white to-purple-50/50 p-5 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-indigo-600" />
                <h2 className="text-base font-black text-slate-900">
                  {activeSprint ? activeSprint.name : 'No Active Sprint'}
                </h2>
                {activeSprint && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-black border ${
                      activeSprint.status === 'ACTIVE'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-amber-200 bg-amber-50 text-amber-700'
                    }`}
                  >
                    {activeSprint.status}
                  </span>
                )}
              </div>
              {activeSprint?.goal && (
                <p className="text-xs text-slate-600 font-medium">
                  <span className="font-bold text-slate-800">Goal:</span> {activeSprint.goal}
                </p>
              )}
            </div>

            {/* Sprint Selector */}
            {sprints.length > 1 && (
              <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                <span>Select Sprint:</span>
                <select
                  value={selectedSprintId}
                  onChange={(e) => handleSprintChange(e.target.value)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-indigo-600 cursor-pointer shadow-2xs"
                >
                  {sprints.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.status})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {activeSprint && (
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-indigo-100/80 pt-3 text-xs">
              <div className="flex items-center gap-4 text-slate-600">
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-indigo-500" />
                  <span>
                    {activeSprint.start_date || 'Start TBD'} &rarr; {activeSprint.end_date || 'End TBD'}
                  </span>
                </div>
                <div>
                  <span className="font-bold text-slate-900">{sprintStats.completed}</span> of{' '}
                  <span className="font-bold text-slate-900">{sprintStats.total}</span> items completed
                </div>
              </div>

              {/* Progress Bar */}
              <div className="flex items-center gap-3 min-w-50">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full bg-indigo-600 transition-all duration-500"
                    style={{ width: `${sprintStats.percent}%` }}
                  />
                </div>
                <span className="font-black text-indigo-700">{sprintStats.percent}%</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* KANBAN VIEW: Continuous Workflow Banner */}
      {!isScrum && (
        <div className="rounded-2xl border border-emerald-100 bg-linear-to-r from-emerald-50/70 via-white to-teal-50/40 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-600 p-2 text-white shadow-xs">
              <FolderKanban className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900">Continuous Kanban Execution Board</h2>
              <p className="text-xs text-slate-500">
                Items flow seamlessly from Backlog to Done without sprint deadlines.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-bold text-slate-600">
            <div>
              Total Work: <span className="text-slate-900">{filteredWorkItems.length}</span> items
            </div>
            <div>
              Completed:{' '}
              <span className="text-emerald-700">
                {filteredWorkItems.filter((w) => w.status === 'DONE').length}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="relative min-w-60 flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search work items by title or keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-9 pr-3 py-1.5 text-xs outline-none focus:border-slate-800 focus:bg-white transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          {/* Assignee Filter */}
          <select
            value={selectedAssignee}
            onChange={(e) => setSelectedAssignee(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-slate-800 cursor-pointer"
          >
            <option value="ALL">All Assignees</option>
            <option value="UNASSIGNED">Unassigned</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.first_name} {emp.last_name}
              </option>
            ))}
          </select>

          {/* Priority Filter */}
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-slate-800 cursor-pointer"
          >
            <option value="ALL">All Priorities</option>
            <option value="URGENT">Urgent</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>
      </div>

      {/* BOARD COLUMNS */}
      {isScrum ? (
        /* SCRUM BOARD */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {SCRUM_COLUMNS.map((col) => {
            const colItems = scrumBoardItems.filter((w) => w.status === col.id)
            const isOver = dragOverColumn === col.id

            return (
              <div
                key={col.id}
                onDragOver={(e) => handleDragOver(e, col.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col.id)}
                className={`rounded-2xl border ${col.color} p-4 transition-all duration-200 flex flex-col min-h-125 ${
                  isOver ? 'ring-2 ring-indigo-500 ring-offset-2 bg-indigo-50/50' : ''
                }`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between mb-3.5 pb-2 border-b border-slate-200/60">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-xs text-slate-900 tracking-wide uppercase">
                      {col.label}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${col.badgeBg}`}>
                      {colItems.length}
                    </span>
                  </div>
                </div>

                {/* Card List */}
                <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                  {colItems.length === 0 ? (
                    <div className="flex h-32 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400 font-medium">
                      No items
                    </div>
                  ) : (
                    colItems.map((item) => (
                      <WorkItemCard
                        key={item.id}
                        item={item}
                        onClick={() => setDrawerWork(item)}
                        onDragStart={(e) => handleDragStart(e, item.id)}
                        onMoveStatus={(next) => handleMoveStatus(item.id, next)}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* KANBAN BOARD */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {KANBAN_COLUMNS.map((col) => {
            const colItems = filteredWorkItems.filter((w) => {
              if (col.id === 'BACKLOG') {
                return w.status === 'TODO' && !w.assigned_to
              }
              if (col.id === 'TODO') {
                return w.status === 'TODO' && Boolean(w.assigned_to)
              }
              return w.status === col.id
            })
            const isOver = dragOverColumn === col.id

            return (
              <div
                key={col.id}
                onDragOver={(e) => handleDragOver(e, col.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col.id)}
                className={`rounded-2xl border ${col.color} p-3.5 transition-all duration-200 flex flex-col min-h-125 ${
                  isOver ? 'ring-2 ring-emerald-500 ring-offset-2 bg-emerald-50/50' : ''
                }`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200/60">
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-xs text-slate-900 tracking-wide uppercase">
                      {col.label}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${col.badgeBg}`}>
                      {colItems.length}
                    </span>
                  </div>
                </div>

                {/* Card List */}
                <div className="space-y-2.5 flex-1 overflow-y-auto pr-0.5">
                  {colItems.length === 0 ? (
                    <div className="flex h-28 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 text-center text-[11px] text-slate-400 font-medium">
                      No items
                    </div>
                  ) : (
                    colItems.map((item) => (
                      <WorkItemCard
                        key={item.id}
                        item={item}
                        onClick={() => setDrawerWork(item)}
                        onDragStart={(e) => handleDragStart(e, item.id)}
                        onMoveStatus={(next) => handleMoveStatus(item.id, next)}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* SCRUM BACKLOG DRAWER / SECTION */}
      {isScrum && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <ListTodo className="h-5 w-5 text-slate-700" />
              <h3 className="font-black text-base text-slate-900">Product Backlog</h3>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">
                {backlogItems.length} items outside current sprint
              </span>
            </div>
          </div>

          {backlogItems.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-3">All backlog items are assigned to sprints.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {backlogItems.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 hover:bg-slate-50/80 px-2 rounded-xl transition"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-50">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-black uppercase border ${
                        item.priority === 'URGENT'
                          ? 'border-red-200 bg-red-50 text-red-700'
                          : item.priority === 'HIGH'
                            ? 'border-orange-200 bg-orange-50 text-orange-700'
                            : 'border-slate-200 bg-slate-50 text-slate-600'
                      }`}
                    >
                      {item.priority}
                    </span>
                    <button
                      onClick={() => setDrawerWork(item)}
                      className="font-bold text-xs text-slate-900 hover:text-indigo-600 text-left transition cursor-pointer line-clamp-1"
                    >
                      {item.title}
                    </button>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    {item.assignee ? (
                      <span className="text-slate-600">
                        {item.assignee.first_name} {item.assignee.last_name}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">Unassigned</span>
                    )}

                    {selectedSprintId && (
                      <button
                        onClick={() => handleAddToSprint(item.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100 transition cursor-pointer"
                      >
                        <Plus className="h-3 w-3" /> Add to Sprint
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* QUICK CREATE WORK ITEM MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-base text-slate-900">Create New Work Item</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateWorkItem} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Implement OAuth Authentication flow"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 font-medium outline-none focus:border-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Detailed requirements or acceptance criteria..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 font-medium outline-none focus:border-slate-800 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 font-medium outline-none focus:border-slate-800 bg-white"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Assignee</label>
                  <select
                    value={newAssigneeId}
                    onChange={(e) => setNewAssigneeId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 font-medium outline-none focus:border-slate-800 bg-white"
                  >
                    <option value="">Unassigned</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.first_name} {emp.last_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Work Type</label>
                  <select
                    value={newWorkTypeId}
                    onChange={(e) => setNewWorkTypeId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 font-medium outline-none focus:border-slate-800 bg-white"
                  >
                    <option value="">Select Work Type</option>
                    {workTypes.map((wt) => (
                      <option key={wt.id} value={wt.id}>
                        {wt.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Est. Hours</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g., 4"
                    value={newEstimatedHours}
                    onChange={(e) => setNewEstimatedHours(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 font-medium outline-none focus:border-slate-800"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingWork}
                  className="rounded-xl bg-[#801424] px-5 py-2 font-bold text-white hover:bg-[#9f1239] shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {creatingWork ? 'Creating...' : 'Create Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Work Item Details Drawer */}
      {drawerWork && (
        <WorkDetailsDrawer
          work={drawerWork}
          onClose={() => setDrawerWork(null)}
          onChanged={async () => {
            await loadData()
            setDrawerWork(null)
          }}
        />
      )}
    </div>
  )
}

/* Individual Work Item Card Component */
function WorkItemCard({
  item,
  onClick,
  onDragStart,
  onMoveStatus,
}: {
  item: WorkItem
  onClick: () => void
  onDragStart: (e: React.DragEvent) => void
  onMoveStatus: (next: string) => void
}) {
  const priorityStyle =
    item.priority === 'URGENT'
      ? 'border-red-200 bg-red-50 text-red-700'
      : item.priority === 'HIGH'
        ? 'border-orange-200 bg-orange-50 text-orange-700'
        : item.priority === 'MEDIUM'
          ? 'border-amber-200 bg-amber-50 text-amber-700'
          : 'border-slate-200 bg-slate-100 text-slate-600'

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className="group relative rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs hover:shadow-md hover:border-slate-400/80 transition cursor-grab active:cursor-grabbing space-y-2.5"
    >
      {/* Top Badges */}
      <div className="flex items-center justify-between gap-1.5 text-[10px]">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`rounded-md px-1.5 py-0.5 font-black uppercase border ${priorityStyle}`}>
            {item.priority}
          </span>
          {item.work_types && (
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-bold text-slate-700">
              {item.work_types.name}
            </span>
          )}
        </div>

        {item.estimated_hours && (
          <span className="flex items-center gap-1 text-slate-400 font-bold">
            <Clock3 className="h-3 w-3" />
            {item.estimated_hours}h
          </span>
        )}
      </div>

      {/* Title & Description */}
      <div>
        <h4 className="font-bold text-xs text-slate-900 leading-snug group-hover:text-indigo-600 transition line-clamp-2">
          {item.title}
        </h4>
        {item.description && (
          <p className="text-[11px] text-slate-500 mt-1 line-clamp-1 leading-relaxed">
            {item.description}
          </p>
        )}
      </div>

      {/* Card Footer: Assignee & Progress */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 text-[11px]">
        <div className="flex items-center gap-1.5 text-slate-600 font-medium">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
            {item.assignee ? item.assignee.first_name?.[0] || 'U' : <User className="h-3 w-3" />}
          </div>
          <span className="truncate max-w-22.5">
            {item.assignee
              ? `${item.assignee.first_name} ${item.assignee.last_name?.[0] || ''}`
              : 'Unassigned'}
          </span>
        </div>

        {/* Quick Advance Button */}
        {item.status !== 'DONE' && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              const nextStatus =
                item.status === 'TODO'
                  ? 'IN_PROGRESS'
                  : item.status === 'IN_PROGRESS'
                    ? 'IN_REVIEW'
                    : 'DONE'
              onMoveStatus(nextStatus)
            }}
            className="flex items-center gap-0.5 rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            title="Advance Status"
          >
            <span>&rarr;</span>
          </button>
        )}
      </div>
    </div>
  )
}
