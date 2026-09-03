import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Search, AlertCircle, X, User, Calendar, Flame, Layers3, Flag, FolderKanban } from 'lucide-react'
import { useAuth } from '../features/auth/AuthContext'
import {
  getWorkItems,
  createWorkItem,
  updateWorkItem,
  updateWorkItemStatus,
  type WorkItem,
} from '../features/work-items/work-item.service'
import { getProjects, type Project } from '../features/projects/project.service'
import { getEmployees } from '../features/employees/employee.service'
import { getWorkTypes } from '../features/work-types/work-type.service'
import type { WorkType } from '../features/work-types/work-type.types'
import type { UserProfile } from '../features/auth/auth.types'
import { getProjectModules } from '../features/project-modules/project-module.service'
import type { ProjectModule } from '../features/project-modules/project-module.types'
import { getProjectMilestones } from '../features/project-milestones/project-milestone.service'
import type { ProjectMilestone } from '../features/project-milestones/project-milestone.types'
import { getProjectSprints, addWorkItemToSprint } from '../features/sprints/sprint.service'
import type { Sprint } from '../features/sprints/sprint.types'
import PageHeader from '../components/ui/PageHeader'
import StatusBadge from '../components/ui/StatusBadge'
import HealthBadge from '../components/ui/HealthBadge'

const statusOptions: WorkItem['status'][] = [
  'TODO',
  'IN_PROGRESS',
  'BLOCKED',
  'DONE',
]
const priorityOptions: WorkItem['priority'][] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']

export default function WorkItems() {
  const { accessToken, profile } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [workItems, setWorkItems] = useState<WorkItem[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [employees, setEmployees] = useState<UserProfile[]>([])
  const [workTypes, setWorkTypes] = useState<WorkType[]>([])
  const [availableModules, setAvailableModules] = useState<ProjectModule[]>([])
  const [availableMilestones, setAvailableMilestones] = useState<ProjectMilestone[]>([])
  const [availableSprints, setAvailableSprints] = useState<Sprint[]>([])

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL')
  const [workTypeFilter, setWorkTypeFilter] = useState<string>('ALL')
  const [moduleFilter, setModuleFilter] = useState<string>('ALL')
  const [loading, setLoading] = useState(true)

  // Sync state from query parameters on mount or param change
  useEffect(() => {
    const rawStatus = searchParams.get('status')?.toUpperCase()
    const rawFilter = searchParams.get('filter')?.toUpperCase()

    if (rawStatus) {
      if (rawStatus === 'IN_PROGRESS' || rawStatus === 'DONE' || rawStatus === 'TODO' || rawStatus === 'BLOCKED') {
        setStatusFilter(rawStatus)
      } else if (rawStatus === 'OVERDUE') {
        setStatusFilter('OVERDUE')
      } else if (rawStatus === 'CARRY_FORWARD') {
        setStatusFilter('CARRY_FORWARD')
      }
    } else if (rawFilter) {
      if (rawFilter === 'OVERDUE') {
        setStatusFilter('OVERDUE')
      } else if (rawFilter === 'DUE_TODAY') {
        setStatusFilter('DUE_TODAY')
      } else if (rawFilter === 'CARRY_FORWARD') {
        setStatusFilter('CARRY_FORWARD')
      }
    }
  }, [searchParams])

  // Assign Work Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Step 1 — Work Item creation form hierarchy
  const [form, setForm] = useState({
    project_id: '',
    work_type_id: '',
    module_id: '',
    milestone_id: '',
    sprint_id: '',
    assigned_to: '',
    title: '',
    description: '',
    priority: 'MEDIUM' as WorkItem['priority'],
    start_date: '',
    deadline: '',
    deadline_time: '',
    estimated_hours: '',
    story_points: '',
  })

  async function loadData() {
    if (!accessToken) return
    setLoading(true)
    setError('')

    try {
      const [items, projList, empList, wtList] = await Promise.all([
        getWorkItems(accessToken),
        getProjects(accessToken).catch(() => []),
        getEmployees(accessToken).catch(() => []),
        getWorkTypes(accessToken).catch(() => []),
      ])

      setWorkItems(items)
      setProjects(projList)
      setEmployees(empList)
      setWorkTypes(wtList)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load work items.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [accessToken])

  // Step 2 — Load Modules, Milestones, and Sprints filtered by selected project
  useEffect(() => {
    if (!accessToken || !form.project_id) {
      setAvailableModules([])
      setAvailableMilestones([])
      setAvailableSprints([])
      setForm((prev) => ({
        ...prev,
        module_id: '',
        milestone_id: '',
        sprint_id: '',
      }))
      return
    }

    getProjectModules(accessToken, form.project_id)
      .then((mods) => setAvailableModules(Array.isArray(mods) ? mods : []))
      .catch(() => setAvailableModules([]))

    getProjectMilestones(accessToken, form.project_id)
      .then((ms) => setAvailableMilestones(Array.isArray(ms) ? ms : []))
      .catch(() => setAvailableMilestones([]))

    getProjectSprints(accessToken, form.project_id)
      .then((sp) => setAvailableSprints(Array.isArray(sp) ? sp : []))
      .catch(() => setAvailableSprints([]))
  }, [accessToken, form.project_id])

  const isManagerOrAdmin =
    profile?.role === 'SUPER_ADMIN' ||
    profile?.role === 'ADMIN' ||
    profile?.role === 'MANAGER'

  const uniqueModulesList = useMemo(() => {
    const map = new Map<string, string>()
    workItems.forEach((item) => {
      const mod = item.project_modules || item.module
      if (mod?.id && mod?.name) {
        map.set(mod.id, mod.name)
      }
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [workItems])

  const filteredWorkItems = useMemo(() => {
    const todayIso = new Date().toISOString().slice(0, 10)
    const paramEmployee = searchParams.get('employee')
    const paramProject = searchParams.get('project')
    const paramHealth = searchParams.get('health')?.toUpperCase()

    return workItems.filter((item) => {
      const matchesSearch =
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.description?.toLowerCase().includes(search.toLowerCase()) ||
        item.projects?.project_key?.toLowerCase().includes(search.toLowerCase())

      let matchesStatus = true
      if (statusFilter === 'ALL') {
        matchesStatus = true
      } else if (statusFilter === 'OVERDUE') {
        matchesStatus =
          item.status !== 'DONE' &&
          ((item.deadline && item.deadline.slice(0, 10) < todayIso) ||
            item.health === 'RED' ||
            item.health === 'CRITICAL')
      } else if (statusFilter === 'DUE_TODAY') {
        matchesStatus =
          item.status !== 'DONE' &&
          Boolean(item.deadline && item.deadline.slice(0, 10) === todayIso)
      } else if (statusFilter === 'CARRY_FORWARD') {
        matchesStatus = Boolean(item.carry_forward_count && item.carry_forward_count > 0)
      } else {
        matchesStatus = item.status === statusFilter
      }

      const matchesPriority = priorityFilter === 'ALL' || item.priority === priorityFilter
      const matchesWorkType =
        workTypeFilter === 'ALL' || item.work_type_id === workTypeFilter
      const matchesModule =
        moduleFilter === 'ALL' ||
        item.module_id === moduleFilter ||
        item.project_modules?.id === moduleFilter ||
        item.module?.id === moduleFilter

      const matchesEmployee = !paramEmployee || item.assigned_to === paramEmployee
      const matchesProject = !paramProject || item.project_id === paramProject
      const matchesHealth = !paramHealth || item.health === paramHealth

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPriority &&
        matchesWorkType &&
        matchesModule &&
        matchesEmployee &&
        matchesProject &&
        matchesHealth
      )
    })
  }, [
    workItems,
    search,
    statusFilter,
    priorityFilter,
    workTypeFilter,
    moduleFilter,
    searchParams,
  ])

  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!accessToken) return
    setSaving(true)
    setError('')

    try {
      const createdWork = await createWorkItem(accessToken, {
        project_id: form.project_id,
        work_type_id: form.work_type_id || null,
        module_id: form.module_id || null,
        milestone_id: form.milestone_id || null,
        assigned_to: form.assigned_to || null,
        title: form.title,
        description: form.description || undefined,
        priority: form.priority,
        start_date: form.start_date || null,
        deadline: form.deadline || null,
        deadline_time: form.deadline_time || null,
        estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : null,
        story_points: form.story_points ? Number(form.story_points) : null,
      })

      // Step 6 — Sprint assignment via sprint_work_items
      if (form.sprint_id && createdWork?.id) {
        await addWorkItemToSprint(accessToken, form.sprint_id, createdWork.id).catch(console.error)
      }

      setModalOpen(false)
      setForm({
        project_id: '',
        work_type_id: '',
        module_id: '',
        milestone_id: '',
        sprint_id: '',
        assigned_to: '',
        title: '',
        description: '',
        priority: 'MEDIUM',
        start_date: '',
        deadline: '',
        deadline_time: '',
        estimated_hours: '',
        story_points: '',
      })
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create work item.')
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusChange(item: WorkItem, newStatus: WorkItem['status']) {
    if (!accessToken) return
    try {
      const updated = await updateWorkItemStatus(accessToken, item.id, newStatus)
      setWorkItems((prev) => prev.map((w) => (w.id === item.id ? { ...w, ...updated } : w)))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unable to update status.')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        context="Detailed Work Repository"
        title="Work Items"
        description="View the underlying work behind projects, modules, milestones, sprints, and daily targets."
        actions={
          isManagerOrAdmin ? (
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => navigate('/work-distribution')}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#801424] hover:bg-[#9f1239] text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <FolderKanban size={15} />
                <span>Work Distribution</span>
              </button>
              <button
                onClick={() => setModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
              >
                <Plus size={15} />
                <span>New Work Item</span>
              </button>
            </div>
          ) : null
        }
      />

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search work title, description, or project key..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-500 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Work Type:</span>
            <select
              value={workTypeFilter}
              onChange={(e) => setWorkTypeFilter(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-xl bg-white text-slate-700 outline-none focus:border-blue-500"
            >
              <option value="ALL">All Work Types</option>
              {workTypes
                .filter((type) => type.is_active)
                .map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Module:</span>
            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-xl bg-white text-slate-700 outline-none focus:border-blue-500"
            >
              <option value="ALL">All Modules</option>
              {uniqueModulesList.map((mod) => (
                <option key={mod.id} value={mod.id}>
                  {mod.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-xl bg-white text-slate-700 outline-none focus:border-blue-500"
            >
              <option value="ALL">All Statuses</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Priority:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-xl bg-white text-slate-700 outline-none focus:border-blue-500"
            >
              <option value="ALL">All Priorities</option>
              {priorityOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Work Items List — Step 7: Hierarchical display */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center text-slate-400">
            Loading work items...
          </div>
        ) : filteredWorkItems.length === 0 ? (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center text-slate-400">
            No work items found.
          </div>
        ) : (
          filteredWorkItems.map((item) => {
            const assignee = item.assignee
            const proj = item.projects
            const mod = item.project_modules || item.module
            const milestone = item.project_milestones

            return (
              <div
                key={item.id}
                onClick={() => navigate(`/work-items/${item.id}`)}
                className="bg-white border border-slate-200/80 hover:border-slate-300 hover:shadow-sm rounded-2xl p-5 transition flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer"
              >
                <div className="space-y-2 flex-1">
                  {/* Step 7 — Work Hierarchy Badges */}
                  <div className="flex flex-wrap items-center gap-2">
                    {proj && (
                      <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1">
                        <FolderKanban size={11} />
                        {proj.project_key} — {proj.name}
                      </span>
                    )}

                    {mod && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                        <Layers3 size={11} />
                        {mod.name}
                      </span>
                    )}

                    {milestone && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                        <Flag size={11} />
                        {milestone.name}
                      </span>
                    )}

                    {(item.work_types || item.work_type) && (() => {
                      const wt = item.work_types || item.work_type
                      return (
                        <span
                          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md text-white shadow-2xs"
                          style={{ backgroundColor: wt?.color || '#801424' }}
                        >
                          {wt?.name}
                        </span>
                      )
                    })()}

                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                        item.priority === 'URGENT'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200 font-bold'
                          : item.priority === 'HIGH'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : item.priority === 'MEDIUM'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {item.priority}
                    </span>

                    {item.health && <HealthBadge health={item.health} />}
                  </div>

                  <h3 className="text-base font-bold text-slate-900">{item.title}</h3>
                  {item.description && (
                    <p className="text-xs text-slate-500 line-clamp-2">{item.description}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                    {assignee ? (
                      <div className="flex items-center gap-1.5 font-medium text-slate-700">
                        <User size={13} className="text-slate-500" />
                        <span>
                          {assignee.first_name} {assignee.last_name || ''}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400 italic">Unassigned</span>
                    )}

                    {item.deadline && (
                      <div className="flex items-center gap-1 text-slate-500">
                        <Calendar size={13} />
                        <span>
                          Due: {new Date(item.deadline).toLocaleDateString()}
                          {item.deadline_time ? ` ${item.deadline_time}` : ''}
                        </span>
                      </div>
                    )}

                    {item.estimated_hours ? (
                      <span className="text-slate-500 font-medium">
                        Est: {item.estimated_hours}h
                      </span>
                    ) : null}

                    {item.story_points ? (
                      <span className="text-slate-500 font-medium bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                        {item.story_points} pts
                      </span>
                    ) : null}

                    {Number(item.carry_forward_count || 0) > 0 && (
                      <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-bold text-[10px]">
                        Carried {item.carry_forward_count}x
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <StatusBadge status={item.status} />
                </div>
              </div>
            )
          }))}
      </div>

      {/* Step 3 — Assign Work Modal with Work Hierarchy Selector */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X size={20} />
            </button>

            <h2 className="text-xl font-bold text-slate-900 mb-1">Assign Work Item</h2>
            <p className="text-xs text-slate-500 mb-5">
              Define work hierarchy, deliverables, and delegate to team members.
            </p>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              {/* Step 3 — WORK HIERARCHY SECTION */}
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  WORK HIERARCHY
                </h3>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Project *</label>
                    <select
                      required
                      value={form.project_id}
                      onChange={(e) => {
                        const projectId = e.target.value
                        setForm((prev) => ({
                          ...prev,
                          project_id: projectId,
                          module_id: '',
                          milestone_id: '',
                          sprint_id: '',
                        }))
                      }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-blue-500 bg-white"
                    >
                      <option value="">Select Project</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          [{p.project_key}] {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Module</label>
                    <select
                      value={form.module_id}
                      disabled={!form.project_id}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          module_id: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-blue-500 bg-white disabled:bg-slate-100"
                    >
                      <option value="">Select Module</option>
                      {availableModules
                        .filter((m) => m.project_id === form.project_id)
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Milestone</label>
                    <select
                      value={form.milestone_id}
                      disabled={!form.project_id}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          milestone_id: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-blue-500 bg-white disabled:bg-slate-100"
                    >
                      <option value="">No Milestone</option>
                      {availableMilestones
                        .filter((m) => m.project_id === form.project_id)
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Sprint</label>
                    <select
                      value={form.sprint_id}
                      disabled={!form.project_id}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          sprint_id: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-blue-500 bg-white disabled:bg-slate-100"
                    >
                      <option value="">No Sprint</option>
                      {availableSprints
                        .filter((s) => s.project_id === form.project_id)
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Work Type</label>
                <select
                  value={form.work_type_id}
                  onChange={(e) => setForm({ ...form, work_type_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-blue-500 bg-white"
                >
                  <option value="">Select Work Type (Optional)</option>
                  {workTypes
                    .filter((wt) => wt.is_active)
                    .map((wt) => (
                      <option key={wt.id} value={wt.id}>
                        {wt.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Work Title *</label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                  placeholder="e.g., Implement authentication middleware"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                  placeholder="Detailed work requirements..."
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assigned To</label>
                  <select
                    value={form.assigned_to}
                    onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="">Unassigned</option>
                    {employees
                      .filter((emp) =>
                        profile?.role === 'MANAGER'
                          ? emp.role === 'EMPLOYEE'
                          : emp.role === 'EMPLOYEE' || emp.role === 'MANAGER',
                      )
                      .map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.first_name} {emp.last_name || ''} ({emp.role})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Priority</label>
                  <select
                    value={form.priority}
                    onChange={(e) =>
                      setForm({ ...form, priority: e.target.value as WorkItem['priority'] })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-blue-500 bg-white"
                  >
                    {priorityOptions.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Deadline Date</label>
                  <input
                    type="date"
                    value={form.deadline}
                    onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Deadline Time</label>
                  <input
                    type="time"
                    value={form.deadline_time}
                    onChange={(e) => setForm({ ...form, deadline_time: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Est. Hours</label>
                  <input
                    type="number"
                    value={form.estimated_hours}
                    onChange={(e) => setForm({ ...form, estimated_hours: e.target.value })}
                    placeholder="e.g. 16"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Story Points</label>
                <input
                  type="number"
                  value={form.story_points}
                  onChange={(e) => setForm({ ...form, story_points: e.target.value })}
                  placeholder="e.g. 5"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 font-semibold hover:bg-slate-100"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-[#801424] hover:bg-[#9f1239] text-white font-bold disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {saving ? 'Creating...' : 'Create Work Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
