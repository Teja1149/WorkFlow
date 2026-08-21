import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, FolderKanban, Calendar, User, X, AlertCircle } from 'lucide-react'
import { useAuth } from '../features/auth/AuthContext'
import { getProjects, createProject, type Project } from '../features/projects/project.service'
import { getEmployees } from '../features/employees/employee.service'
import type { UserProfile } from '../features/auth/auth.types'

export default function Projects() {
  const { accessToken, profile } = useAuth()
  const navigate = useNavigate()

  const [projects, setProjects] = useState<Project[]>([])
  const [employees, setEmployees] = useState<UserProfile[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: '',
    project_key: '',
    description: '',
    methodology: 'SCRUM' as 'SCRUM' | 'KANBAN',
    project_manager_id: '',
    start_date: '',
    target_date: '',
  })

  async function loadData() {
    if (!accessToken) return
    setLoading(true)
    setError('')
    try {
      const [projData, empData] = await Promise.all([
        getProjects(accessToken),
        getEmployees(accessToken).catch(() => []),
      ])
      setProjects(projData)
      setEmployees(empData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load projects.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [accessToken])

  const managers = useMemo(() => {
    return employees.filter((e) => e.role === 'MANAGER' || e.role === 'SUPER_ADMIN')
  }, [employees])

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return projects

    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.project_key.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q),
    )
  }, [projects, search])

  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!accessToken) return
    setSaving(true)
    setError('')

    try {
      await createProject(accessToken, {
        name: form.name,
        project_key: form.project_key,
        description: form.description || undefined,
        methodology: form.methodology,
        project_manager_id: form.project_manager_id || null,
        start_date: form.start_date || null,
        target_date: form.target_date || null,
      })

      setModalOpen(false)
      setForm({
        name: '',
        project_key: '',
        description: '',
        methodology: 'SCRUM',
        project_manager_id: '',
        start_date: '',
        target_date: '',
      })
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create project.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-sm text-slate-500">Workspace</p>
          <h1 className="text-3xl font-bold mt-1">Projects</h1>
          <p className="text-slate-500 mt-2">
            Track agile projects, sprints, and methodology.
          </p>
        </div>

        {profile?.role === 'SUPER_ADMIN' && (
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 bg-[#801424] hover:bg-[#9f1239] text-white px-4 py-2.5 rounded-xl font-bold shadow-xs transition cursor-pointer"
          >
            <Plus size={18} />
            Create Project
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-3">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden mb-6">
        <div className="p-5 border-b border-slate-100">
          <div className="relative max-w-md">
            <Search
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-zinc-800 focus:ring-1 focus:ring-zinc-800 text-sm"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading projects...</div>
        ) : filteredProjects.length === 0 ? (
          <div className="p-12 text-center text-slate-400">No projects found.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 p-6">
            {filteredProjects.map((proj) => {
              const manager = employees.find((e) => e.id === proj.project_manager_id)

              return (
                <div
                  key={proj.id}
                  onClick={() => navigate(`/projects/${proj.id}`)}
                  className="bg-white border border-slate-200/80 hover:border-slate-300 hover:shadow-xs rounded-2xl p-6 transition flex flex-col justify-between cursor-pointer"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-[#801424] text-white shadow-2xs">
                        {proj.project_key}
                      </span>
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${
                          proj.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : proj.status === 'PLANNING'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {proj.status}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-slate-900 mb-1 hover:text-[#801424] transition">
                      {proj.name}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-2 mb-4">
                      {proj.description || 'No description provided.'}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-500">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-medium text-slate-700">
                        <FolderKanban size={14} className="text-slate-500" />
                        {proj.methodology}
                      </span>
                      {manager && (
                        <span className="flex items-center gap-1.5 text-slate-600">
                          <User size={14} />
                          {manager.first_name} {manager.last_name || ''}
                        </span>
                      )}
                    </div>
                    {proj.target_date && (
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Calendar size={14} />
                        Target: {new Date(proj.target_date).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 relative">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X size={20} />
            </button>

            <h2 className="text-xl font-bold text-slate-900 mb-1">Create Project</h2>
            <p className="text-xs text-slate-500 mb-5">
              Setup a new project workspace and assign project leads.
            </p>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-sm">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block font-medium text-slate-700 mb-1">Project Name *</label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-zinc-800"
                    placeholder="Customer Portal"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Key *</label>
                  <input
                    required
                    value={form.project_key}
                    onChange={(e) =>
                      setForm({ ...form, project_key: e.target.value.toUpperCase() })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-zinc-800 font-mono uppercase"
                    placeholder="CP"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-zinc-800 resize-none"
                  placeholder="Summary of project goals and scope..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Methodology *</label>
                  <select
                    value={form.methodology}
                    onChange={(e) =>
                      setForm({ ...form, methodology: e.target.value as 'SCRUM' | 'KANBAN' })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-zinc-800 bg-white"
                  >
                    <option value="SCRUM">SCRUM</option>
                    <option value="KANBAN">KANBAN</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Project Manager</label>
                  <select
                    value={form.project_manager_id}
                    onChange={(e) => setForm({ ...form, project_manager_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-zinc-800 bg-white"
                  >
                    <option value="">Select Manager</option>
                    {managers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.first_name} {m.last_name || ''}
                      </option>
                    ))}
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
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-zinc-800 bg-white text-slate-700"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Target Date</label>
                  <input
                    type="date"
                    value={form.target_date}
                    onChange={(e) => setForm({ ...form, target_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-zinc-800 bg-white text-slate-700"
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
                  {saving ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
