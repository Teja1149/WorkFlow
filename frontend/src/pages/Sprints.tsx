import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthContext'
import {
  createSprint,
  getProjectSprints,
  startSprint,
  completeSprint,
  cancelSprint,
  deleteSprint,
} from '../features/sprints/sprint.service'
import type { Sprint, SprintStatus } from '../features/sprints/sprint.types'

type Project = {
  id: string
  name: string
  project_key: string
  methodology?: 'SCRUM' | 'KANBAN'
}

const statusStyles: Record<SprintStatus, string> = {
  PLANNED: 'bg-slate-100 text-slate-700',
  ACTIVE: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
}

export default function Sprints() {
  const navigate = useNavigate()
  const { profile, accessToken } = useAuth()

  const [projects, setProjects] = useState<Project[]>([])
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [selectedProject, setSelectedProject] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const selectedProjectInfo = useMemo(
    () => projects.find((p) => p.id === selectedProject),
    [projects, selectedProject],
  )

  const [showCreate, setShowCreate] = useState(false)

  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const canManage =
    profile?.role === 'SUPER_ADMIN' ||
    profile?.role === 'ADMIN' ||
    profile?.role === 'MANAGER'

  /*
   * Load projects.
   *
   * Use the existing project API instead of creating
   * another project endpoint.
   */
  useEffect(() => {
    async function loadProjects() {
      if (!accessToken) return

      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL || '/api'}/projects`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        )

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.message || 'Unable to load projects.')
        }

        const data = Array.isArray(result.data) ? result.data : []

        setProjects(data)

        if (data.length > 0) {
          setSelectedProject(data[0].id)
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load projects.',
        )
      }
    }

    loadProjects()
  }, [accessToken])

  async function loadSprints() {
    if (!accessToken || !selectedProject) return

    if (selectedProjectInfo?.methodology === 'KANBAN') {
      setSprints([])
      return
    }

    try {
      setLoading(true)
      setError('')

      const data = await getProjectSprints(
        accessToken,
        selectedProject,
      )

      setSprints(data)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load sprints.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSprints()
  }, [accessToken, selectedProject, selectedProjectInfo?.methodology])

  async function handleCreateSprint(e: React.FormEvent) {
    e.preventDefault()

    if (!accessToken || !selectedProject) return

    if (selectedProjectInfo?.methodology === 'KANBAN') {
      setError('Kanban projects do not use sprints.')
      return
    }

    if (!name.trim()) {
      setError('Sprint name is required.')
      return
    }

    try {
      setLoading(true)
      setError('')

      await createSprint(
        accessToken,
        selectedProject,
        {
          name: name.trim(),
          goal: goal.trim() || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        },
      )

      setName('')
      setGoal('')
      setStartDate('')
      setEndDate('')
      setShowCreate(false)

      await loadSprints()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to create sprint.',
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleStart(id: string) {
    if (!accessToken) return

    try {
      await startSprint(accessToken, id)
      await loadSprints()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to start sprint.',
      )
    }
  }

  async function handleComplete(id: string) {
    if (!accessToken) return

    try {
      await completeSprint(accessToken, id)
      await loadSprints()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to complete sprint.',
      )
    }
  }

  async function handleCancel(id: string) {
    if (!accessToken) return

    if (!window.confirm('Cancel this sprint?')) return

    try {
      await cancelSprint(accessToken, id)
      await loadSprints()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to cancel sprint.',
      )
    }
  }

  async function handleDelete(id: string) {
    if (!accessToken) return

    if (!window.confirm('Delete this sprint?')) return

    try {
      await deleteSprint(accessToken, id)
      await loadSprints()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to delete sprint.',
      )
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">
            Agile project management
          </p>

          <h1 className="text-3xl font-bold text-slate-900">
            Sprints
          </h1>

          <p className="text-sm text-slate-500 mt-1">
            Plan, manage and track project sprints.
          </p>
        </div>

        {canManage && selectedProjectInfo?.methodology === 'SCRUM' && (
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2.5 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800"
          >
            + Create Sprint
          </button>
        )}
      </div>

      {/* Project selector */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Project
        </label>

        <select
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          className="w-full md:w-96 border border-slate-300 rounded-xl px-3 py-2.5"
        >
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.project_key
                ? `[${project.methodology}] ${project.project_key} — ${project.name}`
                : `[${project.methodology}] ${project.name}`}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Sprint list */}
      <div className="space-y-4">
        {selectedProjectInfo?.methodology === 'KANBAN' ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
            <h3 className="font-semibold text-slate-800 text-lg">
              Kanban Methodology
            </h3>
            <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
              Work flows continuously through the board without requiring sprints. Sprint planning and sprint controls are not used for Kanban projects.
            </p>
          </div>
        ) : loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-500">
            Loading sprints...
          </div>
        ) : sprints.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
            <h3 className="font-semibold text-slate-800">
              No sprints yet
            </h3>

            <p className="text-sm text-slate-500 mt-1">
              {selectedProjectInfo
                ? `Create the first sprint for ${selectedProjectInfo.name}.`
                : 'Select a project to view its sprints.'}
            </p>
          </div>
        ) : (
          sprints.map((sprint) => (
            <div
              key={sprint.id}
              className="bg-white rounded-2xl border border-slate-200 p-5"
            >
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
                <div
                  className="flex-1 cursor-pointer group"
                  onClick={() => navigate(`/sprints/${sprint.id}`)}
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-xl font-semibold text-slate-900 group-hover:text-blue-600 transition">
                      {sprint.name}
                    </h2>

                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        statusStyles[sprint.status]
                      }`}
                    >
                      {sprint.status}
                    </span>
                  </div>

                  {sprint.goal && (
                    <p className="text-sm text-slate-600 mt-2">
                      {sprint.goal}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-5 mt-4 text-xs text-slate-500">
                    <span>
                      Start:{' '}
                      {sprint.start_date
                        ? new Date(
                            sprint.start_date,
                          ).toLocaleDateString()
                        : 'Not set'}
                    </span>

                    <span>
                      End:{' '}
                      {sprint.end_date
                        ? new Date(
                            sprint.end_date,
                          ).toLocaleDateString()
                        : 'Not set'}
                    </span>

                    <span>
                      Work items:{' '}
                      {sprint.sprint_work_items?.length ?? 0}
                    </span>
                  </div>
                </div>

                {canManage && (
                  <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                    {sprint.status === 'PLANNED' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleStart(sprint.id)
                        }}
                        className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 transition cursor-pointer"
                      >
                        Start
                      </button>
                    )}

                    {sprint.status === 'ACTIVE' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleComplete(sprint.id)
                        }}
                        className="px-3 py-2 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700 transition cursor-pointer"
                      >
                        Complete
                      </button>
                    )}

                    {sprint.status !== 'COMPLETED' &&
                      sprint.status !== 'CANCELLED' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCancel(sprint.id)
                          }}
                          className="px-3 py-2 rounded-lg bg-amber-100 text-amber-700 text-sm hover:bg-amber-200 transition cursor-pointer"
                        >
                          Cancel
                        </button>
                      )}

                    {sprint.status !== 'ACTIVE' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(sprint.id)
                        }}
                        className="px-3 py-2 rounded-lg bg-red-100 text-red-700 text-sm hover:bg-red-200 transition cursor-pointer"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl p-6">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h2 className="text-xl font-bold">
                  Create Sprint
                </h2>

                <p className="text-sm text-slate-500">
                  {selectedProjectInfo?.name}
                </p>
              </div>

              <button
                onClick={() => setShowCreate(false)}
                className="text-slate-400 hover:text-slate-700 text-xl"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={handleCreateSprint}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium mb-1">
                  Sprint name
                </label>

                <input
                  value={name}
                  onChange={(e) =>
                    setName(e.target.value)
                  }
                  placeholder="Sprint 1"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2.5"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Sprint goal
                </label>

                <textarea
                  value={goal}
                  onChange={(e) =>
                    setGoal(e.target.value)
                  }
                  placeholder="What should this sprint accomplish?"
                  rows={3}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Start date
                  </label>

                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) =>
                      setStartDate(e.target.value)
                    }
                    className="w-full border border-slate-300 rounded-xl px-3 py-2.5"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    End date
                  </label>

                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) =>
                      setEndDate(e.target.value)
                    }
                    className="w-full border border-slate-300 rounded-xl px-3 py-2.5"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 text-white"
                >
                  {loading ? 'Creating...' : 'Create Sprint'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
