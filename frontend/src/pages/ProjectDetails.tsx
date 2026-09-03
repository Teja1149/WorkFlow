import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft,
  BriefcaseBusiness,
  Calendar,
  Users,
  FolderKanban,
  AlertCircle,
  Plus,
  Target,
  Trash2,
  UserPlus,
} from 'lucide-react'
import { useAuth } from '../features/auth/AuthContext'
import {
  getProjects,
  getProjectMembers,
  addProjectMember,
  removeProjectMember,
  updateProject,
  type Project,
  type ProjectStatus,
} from '../features/projects/project.service'
import { getEmployees } from '../features/employees/employee.service'
import type { UserProfile } from '../features/auth/auth.types'
import ProjectDailyUpdatesSection from '../features/project-updates/ProjectDailyUpdatesSection'
import {
  createProjectModule,
  deleteProjectModule,
  getProjectModules,
  updateProjectModule,
} from '../features/project-modules/project-module.service'
import type { ProjectModule } from '../features/project-modules/project-module.types'
import { getWorkTypes } from '../features/work-types/work-type.service'
import type { WorkType } from '../features/work-types/work-type.types'
import ProjectExecutionSection from '../features/project-execution/ProjectExecutionSection'
import {
  createProjectMilestone,
  deleteProjectMilestone,
  getProjectMilestones,
  updateProjectMilestone,
} from '../features/project-milestones/project-milestone.service'
import type { ProjectMilestone } from '../features/project-milestones/project-milestone.types'
import {
  createSprint,
  getProjectSprints,
} from '../features/sprints/sprint.service'
import type { Sprint } from '../features/sprints/sprint.types'
import { getProjectDailyTargets } from '../features/daily-targets/daily-target.service'
import HealthBadge from '../components/ui/HealthBadge'
import WorkPlannerModal from '../components/WorkPlannerModal'
import {
  createProjectTarget,
  getProjectTargets,
  getProjectTargetSummary,
  setProjectTarget,
  generateDailyTargetsFromProject,
  type ProjectTarget,
  type ProjectTargetSummary,
  type ProjectTargetType,
} from '../features/project-targets/project-target.service'
import { CheckCircle2, Gauge, Zap, Sparkles, SlidersHorizontal, UserCheck } from 'lucide-react'

export const PROJECT_STATUS_OPTIONS: { value: ProjectStatus; label: string; style: string }[] = [
  { value: 'TODO', label: 'ToDo', style: 'bg-slate-100 text-slate-700 border-slate-200' },
  { value: 'PLANNING', label: 'Planning', style: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'DEVELOPMENT', label: 'Development', style: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'TESTING', label: 'Testing', style: 'bg-purple-50 text-purple-700 border-purple-200' },
  { value: 'DEPLOYMENT', label: 'Deployment', style: 'bg-orange-50 text-orange-700 border-orange-200' },
  { value: 'COMPLETED', label: 'Completed', style: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
]

export default function ProjectDetails() {
  const { id: routeId, projectId: routeProjectId } = useParams<{ id?: string; projectId?: string }>()
  const projectId = routeProjectId || routeId
  const navigate = useNavigate()
  const { accessToken, profile } = useAuth()

  const [project, setProject] = useState<Project | null>(null)
  const [members, setMembers] = useState<any[]>([])
  const [employees, setEmployees] = useState<UserProfile[]>([])
  const [dailyTargets, setDailyTargets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  // Modules State
  const [modules, setModules] = useState<ProjectModule[]>([])
  const [workTypes, setWorkTypes] = useState<WorkType[]>([])
  const [moduleLoading, setModuleLoading] = useState(false)

  const [showModuleForm, setShowModuleForm] = useState(false)
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null)

  const [moduleName, setModuleName] = useState('')
  const [moduleDescription, setModuleDescription] = useState('')
  const [moduleWorkTypeId, setModuleWorkTypeId] = useState('')
  const [moduleError, setModuleError] = useState('')

  // Milestones State
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([])
  const [milestoneLoading, setMilestoneLoading] = useState(false)
  const [showMilestoneForm, setShowMilestoneForm] = useState(false)
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null)
  const [milestoneName, setMilestoneName] = useState('')
  const [milestoneDescription, setMilestoneDescription] = useState('')
  const [milestoneDeadline, setMilestoneDeadline] = useState('')
  const [milestoneError, setMilestoneError] = useState('')

  // Step 1 — Sprints State
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [showSprintForm, setShowSprintForm] = useState(false)
  const [sprintName, setSprintName] = useState('')
  const [sprintGoal, setSprintGoal] = useState('')
  const [sprintStartDate, setSprintStartDate] = useState('')
  const [sprintEndDate, setSprintEndDate] = useState('')
  const [sprintSaving, setSprintSaving] = useState(false)

  // Project Target Engine State
  const [projectTargets, setProjectTargets] = useState<ProjectTarget[]>([])
  const [targetSummary, setTargetSummary] = useState<ProjectTargetSummary | null>(null)
  const [showTargetModal, setShowTargetModal] = useState(false)
  const [showTargetDetailsModal, setShowTargetDetailsModal] = useState(false)
  const [selectedTarget, setSelectedTarget] = useState<ProjectTarget | ProjectTargetSummary | null>(null)

  const [targetName, setTargetName] = useState('Monthly Video Delivery')
  const [targetType, setTargetType] = useState<ProjectTargetType>('COUNT')
  const [targetUnit, setTargetUnit] = useState('Videos')
  const [targetValue, setTargetValue] = useState<number | ''>(10)
  const [targetStartDate, setTargetStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [targetEndDate, setTargetEndDate] = useState(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10))
  const [targetScheduleMode, setTargetScheduleMode] = useState<'AUTOMATIC_DAILY' | 'MILESTONE' | 'MANUAL'>('AUTOMATIC_DAILY')
  const [targetWorkTypeId, setTargetWorkTypeId] = useState('')
  const [targetAllocations, setTargetAllocations] = useState<Record<string, number>>({})
  const [targetMilestonesList, setTargetMilestonesList] = useState<Array<{ name: string; target_value: number; deadline: string }>>([
    { name: 'Batch 1', target_value: 3, deadline: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10) },
    { name: 'Batch 2', target_value: 3, deadline: new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10) },
    { name: 'Batch 3', target_value: 4, deadline: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) },
  ])
  const [targetSaving, setTargetSaving] = useState(false)
  const [generatingDaily, setGeneratingDaily] = useState(false)

  // Step 2 — Load project sprints
  async function loadProjectSprints() {
    if (!accessToken || !projectId) return

    try {
      const data = await getProjectSprints(
        accessToken,
        projectId,
      )

      setSprints(
        Array.isArray(data) ? data : [],
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load sprints.',
      )
    }
  }

  // Step 3 — Create sprint from Project
  async function handleCreateSprint(
    event: React.FormEvent,
  ) {
    event.preventDefault()

    if (!accessToken || !projectId) return

    if (!sprintName.trim()) {
      setError('Sprint name is required.')
      return
    }

    if (
      sprintStartDate &&
      sprintEndDate &&
      sprintEndDate < sprintStartDate
    ) {
      setError(
        'Sprint end date cannot be before the start date.',
      )
      return
    }

    setSprintSaving(true)
    setError('')

    try {
      await createSprint(
        accessToken,
        projectId,
        {
          name: sprintName.trim(),
          goal: sprintGoal.trim() || undefined,
          startDate:
            sprintStartDate || undefined,
          endDate:
            sprintEndDate || undefined,
        },
      )

      setSprintName('')
      setSprintGoal('')
      setSprintStartDate('')
      setSprintEndDate('')
      setShowSprintForm(false)

      await loadProjectSprints()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to create sprint.',
      )
    } finally {
      setSprintSaving(false)
    }
  }

  async function handleStatusChange(newStatus: ProjectStatus) {
    if (!accessToken || !projectId || !project) return
    setUpdatingStatus(true)
    try {
      const updated = await updateProject(accessToken, projectId, { status: newStatus })
      setProject(updated)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update project status.')
    } finally {
      setUpdatingStatus(false)
    }
  }

  async function loadProjectModules() {
    if (!accessToken || !projectId) return

    setModuleLoading(true)

    try {
      const [moduleData, typeData] = await Promise.all([
        getProjectModules(accessToken, projectId),
        getWorkTypes(accessToken),
      ])

      setModules(moduleData || [])
      setWorkTypes(typeData || [])
    } catch (err) {
      setModuleError(
        err instanceof Error
          ? err.message
          : 'Unable to load modules.',
      )
    } finally {
      setModuleLoading(false)
    }
  }

  async function loadData() {
    if (!accessToken || !projectId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const [projList, memList, empList, dtList] = await Promise.all([
        getProjects(accessToken).catch(() => []),
        getProjectMembers(accessToken, projectId).catch(() => []),
        getEmployees(accessToken).catch(() => []),
        getProjectDailyTargets(accessToken, projectId).catch(() => []),
      ])

      const safeProjects = Array.isArray(projList) ? projList : []
      const found = safeProjects.find((p) => p && p.id === projectId)
      if (found) {
        setProject(found)
      } else {
        setError('Project not found.')
      }
      setMembers(Array.isArray(memList) ? memList : [])
      setEmployees(Array.isArray(empList) ? empList : [])
      setDailyTargets(Array.isArray(dtList) ? dtList : [])
      await loadProjectModules()

      getProjectTargets(accessToken, projectId)
        .then((targets) => {
          setProjectTargets(targets)
          if (targets.length > 0) {
            setSelectedTarget(targets[0])
          }
        })
        .catch(() => {})

      getProjectTargetSummary(accessToken, projectId)
        .then((s) => {
          setTargetSummary(s)
          if (s) {
            if (!selectedTarget) setSelectedTarget(s)
            setTargetName(s.name || 'Monthly Video Delivery')
            setTargetValue(s.target_value)
            setTargetUnit(s.unit)
            setTargetType(s.target_type || 'COUNT')
            setTargetEndDate(s.deadline_date)
            setTargetWorkTypeId(s.work_type_id || '')
            const allocs: Record<string, number> = {}
            for (const a of s.allocations || []) {
              allocs[a.employee_id] = a.allocated_value
            }
            setTargetAllocations(allocs)
          }
        })
        .catch(() => setTargetSummary(null))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load project details.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveTarget(e: React.FormEvent) {
    e.preventDefault()
    if (!accessToken || !projectId) return
    setTargetSaving(true)
    try {
      const allocList = Object.entries(targetAllocations)
        .filter(([_, val]) => Number(val) > 0)
        .map(([empId, val]) => ({
          employee_id: empId,
          allocated_value: Number(val),
        }))

      const milestoneList = targetMilestonesList
        .filter((m) => m.name.trim() && Number(m.target_value) > 0)
        .map((m) => ({
          name: m.name.trim(),
          target_value: Number(m.target_value),
          deadline: m.deadline || null,
        }))

      const created = await createProjectTarget(accessToken, {
        project_id: projectId,
        name: targetName.trim() || 'Monthly Video Delivery',
        target_type: targetType,
        unit: targetUnit.trim() || 'Videos',
        target_value: Number(targetValue) || 10,
        period_type: 'MONTHLY',
        period_start: targetStartDate || new Date().toISOString().slice(0, 10),
        period_end: targetEndDate || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        deadline_date: targetEndDate || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        schedule_mode: targetScheduleMode,
        work_type_id: targetWorkTypeId || undefined,
        allocations: allocList,
        milestones: milestoneList,
      })

      const allTargets = await getProjectTargets(accessToken, projectId)
      setProjectTargets(allTargets)
      const updatedSummary = await getProjectTargetSummary(accessToken, projectId)
      setTargetSummary(updatedSummary)
      setSelectedTarget(created)
      setShowTargetModal(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save project target.')
    } finally {
      setTargetSaving(false)
    }
  }

  async function handleGenerateDaily() {
    if (!accessToken || !projectId) return
    setGeneratingDaily(true)
    try {
      const gen = await generateDailyTargetsFromProject(accessToken, projectId)
      await loadData()
      alert(`✓ Generated ${gen.length} daily target(s) based on required pace.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate daily targets.')
    } finally {
      setGeneratingDaily(false)
    }
  }

  async function loadProjectMilestones() {
    if (!accessToken || !projectId) return

    setMilestoneLoading(true)

    try {
      const data = await getProjectMilestones(
        accessToken,
        projectId,
      )

      setMilestones(
        Array.isArray(data) ? data : [],
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load milestones.',
      )
    } finally {
      setMilestoneLoading(false)
    }
  }

  function resetMilestoneForm() {
    setEditingMilestoneId(null)
    setMilestoneName('')
    setMilestoneDescription('')
    setMilestoneDeadline('')
    setShowMilestoneForm(false)
  }

  function startCreateMilestone() {
    resetMilestoneForm()
    setShowMilestoneForm(true)
  }

  function startEditMilestone(
    milestone: ProjectMilestone,
  ) {
    setEditingMilestoneId(milestone.id)
    setMilestoneName(milestone.name)
    setMilestoneDescription(
      milestone.description || '',
    )
    setMilestoneDeadline(milestone.deadline)
    setShowMilestoneForm(true)
  }

  async function saveMilestone(
    e: React.FormEvent,
  ) {
    e.preventDefault()

    if (!accessToken || !projectId) return

    if (!milestoneName.trim()) {
      setError('Milestone name is required.')
      return
    }

    if (!milestoneDeadline) {
      setError('Milestone deadline is required.')
      return
    }

    setMilestoneLoading(true)

    try {
      if (editingMilestoneId) {
        await updateProjectMilestone(
          accessToken,
          editingMilestoneId,
          {
            name: milestoneName.trim(),
            description:
              milestoneDescription.trim(),
            deadline: milestoneDeadline,
          },
        )
      } else {
        await createProjectMilestone(
          accessToken,
          projectId,
          {
            name: milestoneName.trim(),
            description:
              milestoneDescription.trim(),
            deadline: milestoneDeadline,
          },
        )
      }

      resetMilestoneForm()
      await loadProjectMilestones()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save milestone.',
      )
    } finally {
      setMilestoneLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    loadProjectModules()
    loadProjectMilestones()
    loadProjectSprints()
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

  function resetModuleForm() {
    setEditingModuleId(null)
    setModuleName('')
    setModuleDescription('')
    setModuleWorkTypeId('')
    setModuleError('')
    setShowModuleForm(false)
  }

  function startCreateModule() {
    resetModuleForm()
    setShowModuleForm(true)
  }

  function startEditModule(module: ProjectModule) {
    setEditingModuleId(module.id)
    setModuleName(module.name)
    setModuleDescription(module.description || '')
    setModuleWorkTypeId(module.work_type_id || '')
    setModuleError('')
    setShowModuleForm(true)
  }

  async function handleSaveModule(e: React.FormEvent) {
    e.preventDefault()

    if (!accessToken || !projectId) return

    if (!moduleName.trim()) {
      setModuleError('Module name is required.')
      return
    }

    setModuleLoading(true)
    setModuleError('')

    try {
      if (editingModuleId) {
        await updateProjectModule(accessToken, editingModuleId, {
          name: moduleName.trim(),
          description: moduleDescription.trim(),
          work_type_id: moduleWorkTypeId || null,
        })
      } else {
        await createProjectModule(accessToken, projectId, {
          name: moduleName.trim(),
          description: moduleDescription.trim(),
          work_type_id: moduleWorkTypeId || null,
        })
      }

      resetModuleForm()
      await loadProjectModules()
    } catch (err) {
      setModuleError(err instanceof Error ? err.message : 'Unable to save module.')
    } finally {
      setModuleLoading(false)
    }
  }

  async function handleDeleteModule(module: ProjectModule) {
    if (!accessToken) return

    if (!window.confirm(`Delete "${module.name}"?`)) {
      return
    }

    setModuleLoading(true)

    try {
      await deleteProjectModule(accessToken, module.id)

      await loadProjectModules()
    } catch (err) {
      setModuleError(err instanceof Error ? err.message : 'Unable to delete module.')
    } finally {
      setModuleLoading(false)
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

  const canManageTeam =
    profile?.role === 'SUPER_ADMIN' ||
    profile?.role === 'ADMIN' ||
    profile?.role === 'MANAGER'

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
          {canManageTeam && (
            <Link
              to={`/projects/${projectId}/set-target`}
              className="inline-flex items-center gap-2 rounded-xl bg-[#801424] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#9f1239] shadow-xs transition"
            >
              <Target className="h-4 w-4" />
              Set Today's Target
            </Link>
          )}

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Status:</span>
            <select
              value={project.status || 'PLANNING'}
              disabled={updatingStatus}
              onChange={(e) => handleStatusChange(e.target.value as ProjectStatus)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold border outline-none cursor-pointer transition ${
                PROJECT_STATUS_OPTIONS.find((s) => s.value === project.status)?.style ||
                'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}
            >
              {PROJECT_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-white text-slate-900 font-medium">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
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

          {(profile?.role === 'MANAGER' || profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN') && (
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

      {/* Step 2 & 3: PROJECT TARGETS SECTION */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#801424] font-mono flex items-center gap-1.5">
                <Target size={14} />
                PROJECT TARGETS
              </span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 mt-1">
              Project Output Targets
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              High-level output commitments, pacing, team workload distribution, and milestone tracking.
            </p>
          </div>

          {canManageTeam && (
            <div className="flex flex-wrap items-center gap-2">
              {targetSummary && (
                <button
                  type="button"
                  onClick={handleGenerateDaily}
                  disabled={generatingDaily}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#801424]/30 bg-rose-50/50 hover:bg-rose-50 px-3 py-2 text-xs font-bold text-[#801424] shadow-2xs transition cursor-pointer"
                >
                  <Zap size={14} className={generatingDaily ? 'animate-spin' : ''} />
                  <span>Auto-Generate Today's Targets</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowTargetModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#801424] hover:bg-[#9f1239] px-4 py-2 text-xs font-bold text-white shadow-xs transition cursor-pointer"
              >
                <Sparkles size={14} className="text-amber-300" />
                <span>+ Project Work Planner</span>
              </button>
            </div>
          )}
        </div>

        {/* Target Cards Grid */}
        {(projectTargets.length > 0 || targetSummary) ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(projectTargets.length > 0 ? projectTargets : [targetSummary!]).map((t, idx) => {
              const targetNameDisplay = t.name || `${t.period_type || 'Monthly'} Target`
              const completed = t.completed_value ?? (t as any).actual_value ?? 0
              const pending = t.pending_value ?? (t as any).remaining ?? Math.max(0, t.target_value - completed)
              const achieve = t.achievement ?? (t.target_value > 0 ? Math.round((completed / t.target_value) * 100) : 0)
              const deadlineFormatted = t.deadline_date
                ? new Date(t.deadline_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : 'Sep 30'

              return (
                <div
                  key={t.id || idx}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:border-slate-300 transition space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                        {t.period_type || 'MONTHLY'} TARGET
                      </span>
                      <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 mt-0.5">
                        <span>🎬</span>
                        <span>{targetNameDisplay}</span>
                      </h3>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                        t.health === 'GREEN'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : t.health === 'AMBER'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      {t.health === 'GREEN' ? '🟢 ON TRACK' : t.health === 'AMBER' ? '🟡 TIGHT PACE' : '🔴 AT RISK'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-mono font-bold block">
                        Target
                      </span>
                      <span className="font-extrabold text-slate-900 text-sm">
                        {t.target_value} {t.unit}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-emerald-600 uppercase font-mono font-bold block">
                        Completed
                      </span>
                      <span className="font-extrabold text-emerald-700 text-sm">
                        {completed} {t.unit}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-rose-600 uppercase font-mono font-bold block">
                        Pending
                      </span>
                      <span className="font-extrabold text-rose-700 text-sm">
                        {pending} {t.unit}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-[#801424] uppercase font-mono font-bold block">
                        Achievement
                      </span>
                      <span className="font-extrabold text-[#801424] text-sm">
                        {achieve}%
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        t.health === 'GREEN'
                          ? 'bg-emerald-500'
                          : t.health === 'AMBER'
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${Math.min(100, achieve)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
                    <div>
                      <span>Deadline: </span>
                      <strong className="text-slate-800 font-semibold">{deadlineFormatted}</strong>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTarget(t)
                        setShowTargetDetailsModal(true)
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 font-bold text-slate-800 transition cursor-pointer text-xs"
                    >
                      <span>View Details</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
            <Target className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm font-bold text-slate-700">No project target configured yet</p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Set a monthly or milestone target to automatically calculate required pace and allocate workload across team members.
            </p>
            {canManageTeam && (
              <button
                type="button"
                onClick={() => {
                  setTargetName('Monthly Video Delivery')
                  setTargetType('COUNT')
                  setTargetUnit('Videos')
                  setTargetValue(10)
                  setTargetStartDate(new Date().toISOString().slice(0, 10))
                  setTargetEndDate(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10))
                  setTargetScheduleMode('AUTOMATIC_DAILY')
                  setShowTargetModal(true)
                }}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#801424] px-4 py-2 text-xs font-bold text-white hover:bg-[#9f1239] transition cursor-pointer"
              >
                <Plus size={14} />
                + Add Target
              </button>
            )}
          </div>
        )}
      </div>

      {/* Target Details Modal */}
      {showTargetDetailsModal && selectedTarget && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-6 animate-fadeIn max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#801424] font-mono">
                  {selectedTarget.period_type || 'MONTHLY'} TARGET
                </span>
                <h3 className="text-xl font-extrabold text-slate-900 mt-0.5">
                  {project?.name} — {selectedTarget.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTargetDetailsModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Target Summary Numbers */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                  TARGET
                </span>
                <p className="text-2xl font-black text-slate-900 mt-1">
                  {selectedTarget.target_value}
                </p>
                <span className="text-[11px] font-semibold text-slate-500">{selectedTarget.unit}</span>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3.5 text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 font-mono">
                  COMPLETED
                </span>
                <p className="text-2xl font-black text-emerald-800 mt-1">
                  {selectedTarget.completed_value ?? (selectedTarget as any).actual_value ?? 0}
                </p>
                <span className="text-[11px] font-semibold text-emerald-600">{selectedTarget.unit}</span>
              </div>

              <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-3.5 text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 font-mono">
                  PENDING
                </span>
                <p className="text-2xl font-black text-rose-800 mt-1">
                  {selectedTarget.pending_value ?? (selectedTarget as any).remaining ?? Math.max(0, selectedTarget.target_value - (selectedTarget.completed_value || 0))}
                </p>
                <span className="text-[11px] font-semibold text-rose-600">{selectedTarget.unit}</span>
              </div>

              <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-3.5 text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 font-mono">
                  ACHIEVEMENT
                </span>
                <p className="text-2xl font-black text-purple-900 mt-1">
                  {selectedTarget.achievement}%
                </p>
                <span className="text-[11px] font-semibold text-purple-600">delivered</span>
              </div>
            </div>

            {/* Health & Pace Bar */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <span
                  className={`px-2.5 py-1 rounded-full font-bold border ${
                    selectedTarget.health === 'GREEN'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : selectedTarget.health === 'AMBER'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}
                >
                  {selectedTarget.health === 'GREEN' ? '🟢 On Track' : selectedTarget.health === 'AMBER' ? '🟡 Tight Pace' : '🔴 At Risk'}
                </span>
                <span className="text-slate-600">
                  Days Left: <strong className="text-slate-900">{selectedTarget.days_remaining}</strong>
                </span>
                <span className="text-slate-600">
                  Required Pace: <strong className="text-slate-900">{selectedTarget.required_pace} {selectedTarget.unit}/day</strong>
                </span>
              </div>

              {canManageTeam && (
                <button
                  type="button"
                  onClick={handleGenerateDaily}
                  disabled={generatingDaily}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#801424] text-white text-xs font-bold hover:bg-[#9f1239] transition cursor-pointer"
                >
                  <Zap size={13} />
                  <span>Auto-Generate Today</span>
                </button>
              )}
            </div>

            <hr className="border-slate-100" />

            {/* EMPLOYEE ALLOCATION SECTION */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
                EMPLOYEE ALLOCATION
              </h4>

              {selectedTarget.allocations && selectedTarget.allocations.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {selectedTarget.allocations.map((alloc) => (
                    <div
                      key={alloc.employee_id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{alloc.employee_name || 'Team Member'}</span>
                        <span className="font-mono text-slate-500 text-[11px]">
                          {alloc.allocated_value} allocated
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>Done: <strong className="text-emerald-700">{alloc.completed_value || alloc.actual_value || 0}</strong></span>
                        <span>Pending: <strong className="text-rose-700">{alloc.pending_value || alloc.remaining || Math.max(0, alloc.allocated_value - (alloc.completed_value || 0))}</strong></span>
                        <span className="font-bold text-slate-900">{alloc.achievement || 0}%</span>
                      </div>

                      <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full bg-[#801424] rounded-full"
                          style={{ width: `${Math.min(100, alloc.achievement || 0)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No team member allocations set for this target.</p>
              )}
            </div>

            <hr className="border-slate-100" />

            {/* MILESTONES SECTION */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
                MILESTONES
              </h4>

              {selectedTarget.milestones && selectedTarget.milestones.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {selectedTarget.milestones.map((m) => {
                    const mDone = m.completed_value || (m as any).actual_value || 0
                    const isCompleted = m.status === 'COMPLETED' || (m.target_value > 0 && mDone >= m.target_value)

                    return (
                      <div
                        key={m.id}
                        className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">{m.name}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isCompleted
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {isCompleted ? 'COMPLETED' : 'PENDING'}
                          </span>
                        </div>

                        <p className="text-sm font-black text-slate-900 font-mono">
                          {mDone} / {m.target_value}
                        </p>

                        {m.deadline && (
                          <p className="text-[11px] text-slate-400">
                            Deadline: {new Date(m.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No milestone breakdown configured.</p>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowTargetDetailsModal(false)}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* All-in-One PROJECT WORK PLANNER Modal */}
      {showTargetModal && (
        <WorkPlannerModal
          isOpen={showTargetModal}
          onClose={() => setShowTargetModal(false)}
          defaultProjectId={projectId}
          onSuccess={() => {
            loadData()
          }}
        />
      )}

      {/* Step 194 & 196 — TODAY'S EXECUTION */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-slate-100 pb-5">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
              PROJECT DAILY VELOCITY
            </span>
            <h2 className="text-xl font-bold text-slate-900">
              TODAY'S EXECUTION
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Live operational target commitments and delivery health for this project.
            </p>
          </div>

          {canManageTeam && (
            <Link
              to={`/projects/${projectId}/set-target`}
              className="inline-flex items-center gap-2 rounded-xl bg-[#801424] px-4 py-2 text-xs font-bold text-white hover:bg-[#9f1239] shadow-2xs transition"
            >
              <Target className="h-3.5 w-3.5" />
              + Set Today's Target
            </Link>
          )}
        </div>

        {/* Top Mini KPI Stats (Step 196) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Targets</span>
            <p className="text-xl font-extrabold text-slate-900 mt-1">{dailyTargets.length}</p>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3.5 text-center">
            <span className="text-[10px] uppercase font-bold text-emerald-700 font-mono">Completed</span>
            <p className="text-xl font-extrabold text-emerald-900 mt-1">
              {dailyTargets.filter((t) => t.status === 'COMPLETED').length}
            </p>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3.5 text-center">
            <span className="text-[10px] uppercase font-bold text-amber-700 font-mono">Partial</span>
            <p className="text-xl font-extrabold text-amber-900 mt-1">
              {dailyTargets.filter((t) => t.status === 'PARTIAL').length}
            </p>
          </div>
          <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3.5 text-center">
            <span className="text-[10px] uppercase font-bold text-blue-700 font-mono">Pending</span>
            <p className="text-xl font-extrabold text-blue-900 mt-1">
              {dailyTargets.filter((t) => t.status !== 'COMPLETED' && t.status !== 'PARTIAL' && t.status !== 'CANCELLED').length}
            </p>
          </div>
          <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-3.5 text-center">
            <span className="text-[10px] uppercase font-bold text-rose-700 font-mono">Overdue</span>
            <p className="text-xl font-extrabold text-rose-900 mt-1">
              {dailyTargets.filter((t) => t.health === 'RED' || t.health === 'CRITICAL').length}
            </p>
          </div>
          <div className="rounded-xl border border-[#801424]/20 bg-rose-50/40 p-3.5 text-center">
            <span className="text-[10px] uppercase font-bold text-[#801424] font-mono">Achievement</span>
            <p className="text-xl font-extrabold text-[#801424] mt-1">
              {dailyTargets.length === 0
                ? 0
                : Math.round(
                    dailyTargets.reduce((sum, t) => sum + Number(t.achievement_percent || 0), 0) /
                      dailyTargets.length,
                  )}%
            </p>
          </div>
        </div>

        {/* Employee Grouping (Step 196) */}
        {dailyTargets.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs italic">
            No daily targets assigned for this project today. Click "+ Set Today's Target" to assign.
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(
              dailyTargets.reduce((groups: Record<string, any[]>, target) => {
                const empId = target.employee_id || 'unassigned'
                if (!groups[empId]) groups[empId] = []
                groups[empId].push(target)
                return groups
              }, {}),
            ).map(([empId, empTargets]) => {
              const emp = empTargets[0]?.employee || employees.find((e) => e.id === empId)
              const empName = emp ? `${emp.first_name} ${emp.last_name || ''}`.trim() : 'Team Member'
              const empAchievement = Math.round(
                empTargets.reduce((s, t) => s + Number(t.achievement_percent || 0), 0) / empTargets.length,
              )

              return (
                <div key={empId} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-full bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center">
                        {empName.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs">{empName}</h4>
                        <span className="text-[10px] text-slate-400">{empTargets.length} target(s) today</span>
                      </div>
                    </div>
                    <span className="text-xs font-extrabold text-[#801424]">
                      {empAchievement}% achievement
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {empTargets.map((target) => (
                      <div key={target.id} className="py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="min-w-48 flex-1">
                          <span className="font-bold text-slate-800">{target.title}</span>
                          <p className="text-[11px] text-slate-400">
                            {target.project_modules?.name && `${target.project_modules.name} · `}
                            {target.sprints?.name && `${target.sprints.name} · `}
                            Deadline: {target.deadline_time || 'End of day'}
                          </p>
                        </div>

                        <div className="flex items-center gap-4">
                          <span className="font-semibold text-slate-700">
                            {target.actual_value || 0} / {target.target_value} {target.unit}
                          </span>
                          <span className="font-extrabold text-[#801424] w-12 text-right">
                            {target.achievement_percent || 0}%
                          </span>
                          <HealthBadge health={target.health || 'GREEN'} />
                          <span
                            className={`rounded px-2 py-0.5 font-bold uppercase text-[10px] ${
                              target.status === 'COMPLETED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : target.status === 'PARTIAL'
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {target.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
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

      {/* Step 292 — Team Members & Distribution */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase font-mono">
            TEAM DISTRIBUTION
          </h2>
          {canManageTeam && (
            <Link
              to={`/work-distribution?projectId=${projectId}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#801424] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#9f1239] shadow-xs transition"
            >
              <UserPlus size={13} />
              <span>+ Assign Work</span>
            </Link>
          )}
        </div>
        <div className="divide-y divide-slate-100">
          {members.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">No team members assigned yet.</div>
          ) : (
            members.map((m) => {
              const prof = m.profiles || m.user || employees.find((e) => e.id === m.user_id)
              const firstName = prof?.first_name || ''
              const lastName = prof?.last_name || ''
              const fullName = `${firstName} ${lastName}`.trim() || 'Team Member'
              const initial = (firstName[0] || prof?.email?.[0] || 'M').toUpperCase()
              const email = prof?.email || ''
              const role = prof?.role || ''
              const designation = prof?.designation || ''
              const empId = prof?.employee_id || ''

              return (
                <div key={m.id || m.user_id} className="py-3 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#801424] text-white font-bold flex items-center justify-center text-xs shadow-2xs">
                      {initial}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 flex items-center gap-2">
                        <span>{fullName}</span>
                        {empId && (
                          <span className="text-[10px] font-mono font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            {empId}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                        {email && <span>{email}</span>}
                        {email && (designation || role) && <span>•</span>}
                        {(designation || role) && (
                          <span className="font-medium text-slate-600">
                            {designation || role}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {canManageTeam && (
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/projects/${projectId}/set-target?employeeId=${m.user_id}`}
                        className="rounded-lg bg-slate-100 hover:bg-[#801424] hover:text-white px-2.5 py-1 text-xs font-bold text-slate-700 transition inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Target size={12} />
                        <span>Set Target</span>
                      </Link>

                      <button
                        onClick={() => handleRemoveMember(m.user_id)}
                        className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg transition cursor-pointer"
                        title="Remove from project"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Modules / Work Areas Section */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Modules / Work Areas
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Organize project work into modules and assign a work type.
            </p>
          </div>

          {canManageTeam && (
            <button
              onClick={startCreateModule}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 cursor-pointer"
            >
              + Add Module
            </button>
          )}
        </div>

        {moduleError && (
          <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {moduleError}
          </div>
        )}

        {showModuleForm && canManageTeam && (
          <form
            onSubmit={handleSaveModule}
            className="border-b border-slate-100 bg-slate-50 p-6"
          >
            <div className="grid gap-4 md:grid-cols-2">

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Module Name
                </label>

                <input
                  value={moduleName}
                  onChange={(e) =>
                    setModuleName(e.target.value)
                  }
                  placeholder="e.g. Payments"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Work Type
                </label>

                <select
                  value={moduleWorkTypeId}
                  onChange={(e) =>
                    setModuleWorkTypeId(e.target.value)
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                >
                  <option value="">
                    No Work Type
                  </option>

                  {workTypes
                    .filter((type) => type.is_active)
                    .map((type) => (
                      <option
                        key={type.id}
                        value={type.id}
                      >
                        {type.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Description
                </label>

                <textarea
                  value={moduleDescription}
                  onChange={(e) =>
                    setModuleDescription(e.target.value)
                  }
                  rows={3}
                  className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                disabled={moduleLoading}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                {editingModuleId
                  ? 'Save Changes'
                  : 'Create Module'}
              </button>

              <button
                type="button"
                onClick={resetModuleForm}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {moduleLoading ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Loading modules...
          </div>
        ) : modules.length === 0 ? (
          <div className="p-10 text-center">
            <h3 className="font-semibold text-slate-700">
              No modules yet
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Create modules to organize this project's work.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {modules
              .filter((module) => module.is_active)
              .map((module) => (
                <div
                  key={module.id}
                  className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-900">
                        {module.name}
                      </h3>

                      {module.work_types && (
                        <span
                          className="rounded-full px-2.5 py-1 text-xs font-semibold"
                          style={{
                            backgroundColor:
                              `${module.work_types.color || '#2563EB'}18`,
                            color:
                              module.work_types.color || '#2563EB',
                          }}
                        >
                          {module.work_types.name}
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-sm text-slate-500">
                      {module.description ||
                        'No description provided.'}
                    </p>
                  </div>

                  {canManageTeam && (
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          startEditModule(module)
                        }
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        Edit
                      </button>

                      <button
                        onClick={() =>
                          handleDeleteModule(module)
                        }
                        className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Project Milestones Management Section */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 p-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Project Milestones
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Track major project deliverables and their deadlines.
            </p>
          </div>

          {canManageTeam && (
            <button
              onClick={startCreateMilestone}
              className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white cursor-pointer"
            >
              + Add Milestone
            </button>
          )}
        </div>

        {showMilestoneForm && canManageTeam && (
          <form
            onSubmit={saveMilestone}
            className="border-b border-slate-100 bg-slate-50 p-6"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Milestone Name
                </label>

                <input
                  value={milestoneName}
                  onChange={(e) =>
                    setMilestoneName(e.target.value)
                  }
                  placeholder="Payments Release"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Deadline
                </label>

                <input
                  type="date"
                  value={milestoneDeadline}
                  onChange={(e) =>
                    setMilestoneDeadline(e.target.value)
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Description
                </label>

                <textarea
                  value={milestoneDescription}
                  onChange={(e) =>
                    setMilestoneDescription(
                      e.target.value,
                    )
                  }
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
                />
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                disabled={milestoneLoading}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white cursor-pointer"
              >
                {editingMilestoneId
                  ? 'Save Changes'
                  : 'Create Milestone'}
              </button>

              <button
                type="button"
                onClick={resetMilestoneForm}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="divide-y divide-slate-100">
          {milestoneLoading ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Loading milestones...
            </div>
          ) : milestones.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              No milestones created yet.
            </div>
          ) : (
            milestones.map((milestone) => (
              <div
                key={milestone.id}
                className="p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900">
                        {milestone.name}
                      </h3>

                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                        {milestone.status}
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-slate-500">
                      {milestone.description ||
                        'No description'}
                    </p>

                    <p className="mt-2 text-xs font-medium text-slate-500">
                      Deadline: {milestone.deadline}
                    </p>
                  </div>

                  <div className="w-full lg:max-w-xs">
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-slate-500">
                        Progress
                      </span>

                      <span className="font-semibold text-slate-700">
                        {milestone.progress_percent || 0}%
                      </span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-slate-700"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(
                              0,
                              milestone.progress_percent || 0,
                            ),
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  {canManageTeam && (
                    <button
                      onClick={() =>
                        startEditMilestone(
                          milestone,
                        )
                      }
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold cursor-pointer hover:bg-slate-50"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Step 4 — Sprints Management Section */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 p-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Sprints
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Plan and execute work in time-boxed sprint cycles.
            </p>
          </div>

          {canManageTeam && (
            <button
              onClick={() => setShowSprintForm((value) => !value)}
              className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 cursor-pointer"
            >
              + Create Sprint
            </button>
          )}
        </div>

        {showSprintForm && canManageTeam && (
          <form
            onSubmit={handleCreateSprint}
            className="border-b border-slate-100 bg-slate-50 p-6"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Sprint Name
                </label>

                <input
                  value={sprintName}
                  onChange={(e) => setSprintName(e.target.value)}
                  placeholder="Sprint 1"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Goal
                </label>

                <input
                  value={sprintGoal}
                  onChange={(e) => setSprintGoal(e.target.value)}
                  placeholder="Complete payment integration"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Start Date
                </label>

                <input
                  type="date"
                  value={sprintStartDate}
                  onChange={(e) => setSprintStartDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  End Date
                </label>

                <input
                  type="date"
                  value={sprintEndDate}
                  onChange={(e) => setSprintEndDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                disabled={sprintSaving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 cursor-pointer"
              >
                {sprintSaving ? 'Creating...' : 'Create Sprint'}
              </button>

              <button
                type="button"
                onClick={() => setShowSprintForm(false)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="divide-y divide-slate-100">
          {sprints.length === 0 ? (
            <div className="p-10 text-center">
              <p className="font-medium text-slate-700">
                No sprints yet
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Create the first sprint for this project.
              </p>
            </div>
          ) : (
            sprints.map((sprint) => (
              <div
                key={sprint.id}
                className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/sprints/${sprint.id}`}
                      className="font-semibold text-slate-900 hover:text-blue-600"
                    >
                      {sprint.name}
                    </Link>

                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                      {sprint.status}
                    </span>
                  </div>

                  {sprint.goal && (
                    <p className="mt-1 text-sm text-slate-500">
                      {sprint.goal}
                    </p>
                  )}

                  <p className="mt-2 text-xs text-slate-500">
                    {sprint.start_date || 'No start date'}
                    {' → '}
                    {sprint.end_date || 'No end date'}
                  </p>
                </div>

                <Link
                  to={`/sprints/${sprint.id}`}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Open Sprint
                </Link>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Project Real-Time Execution Metrics & Work Breakdown */}
      <ProjectExecutionSection projectId={projectId!} />

      {/* Structured Project Daily Updates */}
      <ProjectDailyUpdatesSection projectId={projectId!} />
    </div>
  )
}
