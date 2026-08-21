import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, BriefcaseBusiness, Calendar, Users, FolderKanban, AlertCircle, Plus, Trash2, UserPlus } from 'lucide-react'
import { useAuth } from '../features/auth/AuthContext'
import { getProjects, getProjectMembers, addProjectMember, removeProjectMember, type Project } from '../features/projects/project.service'
import { getEmployees } from '../features/employees/employee.service'
import type { UserProfile } from '../features/auth/auth.types'
import ProjectDailyUpdatesSection from '../features/project-updates/ProjectDailyUpdatesSection'

export default function ProjectDetails() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { accessToken, profile } = useAuth()

  const [project, setProject] = useState<Project | null>(null)
  const [members, setMembers] = useState<any[]>([])
  const [employees, setEmployees] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)

  async function loadData() {
    if (!accessToken || !projectId) return
    setLoading(true)
    setError('')
    try {
      const [projList, memList, empList] = await Promise.all([
        getProjects(accessToken),
        getProjectMembers(accessToken, projectId).catch(() => []),
        getEmployees(accessToken).catch(() => []),
      ])

      const found = projList.find((p) => p.id === projectId)
      if (found) {
        setProject(found)
      }
      setMembers(memList)
      setEmployees(empList)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load project details.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [accessToken, projectId])

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault()
    if (!accessToken || !projectId || !selectedUserId) return
    setSubmitting(true)
    try {
      await addProjectMember(accessToken, projectId, selectedUserId)
      setSelectedUserId('')
      const updatedMembers = await getProjectMembers(accessToken, projectId)
      setMembers(updatedMembers)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add member.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!accessToken || !projectId) return
    try {
      await removeProjectMember(accessToken, projectId, userId)
      setMembers((prev) => prev.filter((m) => m.user_id !== userId))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove member.')
    }
  }

  if (loading) {
    return <div className="p-12 text-center text-slate-400">Loading project details...</div>
  }

  if (!project) {
    return (
      <div className="p-8">
        <button
          onClick={() => navigate('/projects')}
          className="flex items-center gap-2 text-blue-600 font-semibold"
        >
          <ArrowLeft size={18} />
          Back to Projects
        </button>
        <p className="mt-8 text-slate-500">Project not found.</p>
      </div>
    )
  }

  const canManageTeam = profile?.role === 'SUPER_ADMIN' || profile?.role === 'MANAGER'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/projects')}
          className="flex items-center gap-2 text-slate-700 hover:text-slate-900 font-semibold"
        >
          <ArrowLeft size={18} />
          Back to Projects
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-3">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Project Banner */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#801424] text-white flex items-center justify-center font-bold shadow-md border border-rose-500/20">
            {project.project_key}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
              <span className="text-xs font-mono text-slate-800 font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                {project.project_key}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">{project.description || 'No description provided.'}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            {project.status || 'ACTIVE'}
          </span>
        </div>
      </div>

      {/* Methodology & Team Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex items-center gap-3">
          <FolderKanban size={16} className="text-[#801424]" />
          <div>
            <span className="text-slate-400 font-medium">Methodology:</span>{' '}
            <span className="font-bold text-slate-800">{project.methodology}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users size={16} className="text-[#801424]" />
            <div>
              <span className="text-slate-400 font-medium">Team Members:</span>{' '}
              <span className="font-bold text-slate-800">{members.length} assigned</span>
            </div>
          </div>

          {(profile?.role === 'MANAGER' || profile?.role === 'SUPER_ADMIN') && (
            <button
              onClick={() => setShowAddMember(!showAddMember)}
              className="text-[#801424] hover:underline font-bold flex items-center gap-1"
            >
              <UserPlus size={14} />
              {showAddMember ? 'Cancel' : 'Add Member'}
            </button>
          )}
        </div>
      </div>

      {/* Add Member Form */}
      {showAddMember && (
        <form onSubmit={handleAddMember} className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-3">
          <h3 className="font-bold text-slate-900 text-xs">Add Team Member to Project</h3>
          <div className="flex gap-2">
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#801424] bg-white font-semibold text-slate-900"
            >
              <option value="">-- Select Employee --</option>
              {employees
                .filter((emp) => !members.some((m) => m.user_id === emp.id))
                .map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.first_name} {emp.last_name || ''} ({emp.role})
                  </option>
                ))}
            </select>

            <button
              type="submit"
              disabled={submitting || !selectedUserId}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#801424] hover:bg-[#9f1239] text-white font-bold text-xs rounded-xl transition disabled:opacity-50 cursor-pointer"
            >
              <UserPlus size={14} />
              {submitting ? 'Adding...' : 'Add Member'}
            </button>
          </div>
        </form>
      )}

      {/* Team Members List */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900 mb-4">Team Members</h2>
        <div className="divide-y divide-slate-100">
          {members.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">No team members assigned yet.</div>
          ) : (
            members.map((m) => (
              <div key={m.id} className="py-3 flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#801424] text-white font-bold flex items-center justify-center text-xs shadow-2xs">
                    {m.user?.first_name?.[0] || 'U'}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">
                      {m.user?.first_name} {m.user?.last_name || ''}
                    </div>
                    <div className="text-[10px] text-slate-400">{m.user?.role}</div>
                  </div>
                </div>

                {canManageTeam && (
                  <button
                    onClick={() => handleRemoveMember(m.user_id)}
                    className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg transition"
                    title="Remove from project"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Structured Project Daily Updates */}
      <ProjectDailyUpdatesSection projectId={projectId!} />
    </div>
  )
}
