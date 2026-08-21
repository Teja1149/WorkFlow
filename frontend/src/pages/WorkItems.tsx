import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, AlertCircle, X, User, Calendar } from 'lucide-react'
import { useAuth } from '../features/auth/AuthContext'
import {
  getWorkItems,
  createWorkItem,
  updateWorkItem,
  type WorkItem,
} from '../features/work-items/work-item.service'
import { getProjects, type Project } from '../features/projects/project.service'
import { getEmployees } from '../features/employees/employee.service'
import type { UserProfile } from '../features/auth/auth.types'

const statusOptions: WorkItem['status'][] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED']
const priorityOptions: WorkItem['priority'][] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']

export default function WorkItems() {
  const { accessToken, profile } = useAuth()
  const navigate = useNavigate()

  const [workItems, setWorkItems] = useState<WorkItem[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [employees, setEmployees] = useState<UserProfile[]>([])

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL')
  const [loading, setLoading] = useState(true)

  // Assign Work Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    project_id: '',
    assigned_to: '',
    title: '',
    description: '',
    priority: 'MEDIUM' as WorkItem['priority'],
    start_date: '',
    deadline: '',
  })

  async function loadData() {
    if (!accessToken) return
    setLoading(true)
    setError('')

    try {
      const [items, projList, empList] = await Promise.all([
        getWorkItems(accessToken),
        getProjects(accessToken).catch(() => []),
        getEmployees(accessToken).catch(() => []),
      ])

      setWorkItems(items)
      setProjects(projList)
      setEmployees(empList)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load work items.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [accessToken])

  const isManagerOrAdmin = profile?.role === 'SUPER_ADMIN' || profile?.role === 'MANAGER'

  const filteredWorkItems = useMemo(() => {
    return workItems.filter((item) => {
      const matchesSearch =
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.description?.toLowerCase().includes(search.toLowerCase()) ||
        item.projects?.project_key.toLowerCase().includes(search.toLowerCase())

      const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter
      const matchesPriority = priorityFilter === 'ALL' || item.priority === priorityFilter

      return matchesSearch && matchesStatus && matchesPriority
    })
  }, [workItems, search, statusFilter, priorityFilter])

  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!accessToken) return
    setSaving(true)
    setError('')

    try {
      await createWorkItem(accessToken, {
        project_id: form.project_id,
        assigned_to: form.assigned_to || null,
        title: form.title,
        description: form.description || undefined,
        priority: form.priority,
        start_date: form.start_date || null,
        deadline: form.deadline || null,
      })

      setModalOpen(false)
      setForm({
        project_id: '',
        assigned_to: '',
        title: '',
        description: '',
        priority: 'MEDIUM',
        start_date: '',
        deadline: '',
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
      const updated = await updateWorkItem(accessToken, item.id, { status: newStatus })
      setWorkItems((prev) => prev.map((w) => (w.id === item.id ? { ...w, ...updated } : w)))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unable to update status.')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-sm text-slate-500">
            {isManagerOrAdmin ? 'Workspace' : 'My Workspace'}
          </p>
          <h1 className="text-3xl font-bold mt-1">
            {isManagerOrAdmin ? 'Work Items' : 'My Work'}
          </h1>
          <p className="text-slate-500 mt-2">
            {isManagerOrAdmin
              ? 'Assign, track, and manage employee tasks across projects.'
              : 'View and update your assigned work items.'}
          </p>
        </div>

        {isManagerOrAdmin && (
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 bg-[#801424] hover:bg-[#9f1239] text-white px-4 py-2.5 rounded-xl font-bold shadow-xs transition cursor-pointer"
          >
            <Plus size={18} />
            Assign Work
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-3">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-4 mb-6 flex flex-wrap gap-4 items-center justify-between">
        <div className="relative flex-1 min-w-60 max-w-md">
          <Search
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search work..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-zinc-800 focus:ring-1 focus:ring-zinc-800 text-sm"
          />
        </div>

        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-700 outline-none focus:border-zinc-800"
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
              className="px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-700 outline-none focus:border-zinc-800"
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

      {/* Work Items List */}
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

            return (
              <div
                key={item.id}
                onClick={() => navigate(`/work-items/${item.id}`)}
                className="bg-white border border-slate-200/80 hover:border-slate-300 hover:shadow-sm rounded-2xl p-6 transition flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-3">
                    {proj && (
                      <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                        {proj.project_key}
                      </span>
                    )}

                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${
                        item.priority === 'URGENT'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : item.priority === 'HIGH'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : item.priority === 'MEDIUM'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {item.priority}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900">{item.title}</h3>
                  {item.description && (
                    <p className="text-xs text-slate-500 line-clamp-2">{item.description}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                    {assignee ? (
                      <div className="flex items-center gap-1.5 font-medium text-slate-700">
                        <User size={14} className="text-slate-500" />
                        <span>
                          Assigned to: {assignee.first_name} {assignee.last_name || ''}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400 italic">Unassigned</span>
                    )}

                    {item.deadline && (
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <Calendar size={14} />
                        <span>Deadline: {new Date(item.deadline).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <select
                    value={item.status}
                    onChange={(e) =>
                      handleStatusChange(item, e.target.value as WorkItem['status'])
                    }
                    className={`px-3 py-2 rounded-xl text-xs font-bold border outline-none cursor-pointer transition ${
                      item.status === 'DONE'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : item.status === 'IN_PROGRESS'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : item.status === 'IN_REVIEW'
                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                        : item.status === 'BLOCKED'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <option value="TODO">TODO</option>
                    <option value="IN_PROGRESS">IN PROGRESS</option>
                    <option value="IN_REVIEW">IN REVIEW</option>
                    <option value="DONE">DONE</option>
                    <option value="BLOCKED">BLOCKED</option>
                  </select>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Assign Work Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 relative">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X size={20} />
            </button>

            <h2 className="text-xl font-bold text-slate-900 mb-1">Assign Work Item</h2>
            <p className="text-xs text-slate-500 mb-5">
              Create and delegate a work item to an employee.
            </p>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Project *</label>
                <select
                  required
                  value={form.project_id}
                  onChange={(e) => setForm({ ...form, project_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-zinc-800 bg-white"
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
                <label className="block font-medium text-slate-700 mb-1">Work Title *</label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-zinc-800"
                  placeholder="e.g., Implement authentication middleware"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-zinc-800 resize-none"
                  placeholder="Detailed instructions or acceptance criteria..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Assign To</label>
                  <select
                    value={form.assigned_to}
                    onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-zinc-800 bg-white"
                  >
                    <option value="">Unassigned</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.first_name} {emp.last_name || ''} ({emp.role})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Priority</label>
                  <select
                    value={form.priority}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        priority: e.target.value as WorkItem['priority'],
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-zinc-800 bg-white"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="URGENT">URGENT</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-zinc-800 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Deadline</label>
                  <input
                    type="date"
                    value={form.deadline}
                    onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-zinc-800 bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl transition font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-[#801424] hover:bg-[#9f1239] text-white font-bold rounded-xl transition disabled:opacity-60 cursor-pointer"
                >
                  {saving ? 'Assigning...' : 'Assign Work'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
