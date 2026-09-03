import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  FolderKanban,
  Info,
  Layers,
  Sparkles,
  Target,
  User,
  Users,
} from 'lucide-react'
import { useAuth } from '../features/auth/AuthContext'
import { getProjects, getProjectMembers, type Project } from '../features/projects/project.service'
import { getProjectModules } from '../features/project-modules/project-module.service'
import { getProjectMilestones } from '../features/project-milestones/project-milestone.service'
import { getProjectSprints } from '../features/sprints/sprint.service'
import { getWorkItems, type WorkItem } from '../features/work-items/work-item.service'
import { createDailyTarget } from '../features/daily-targets/daily-target.service'

const TARGET_TYPE_INFO = {
  COUNT: 'How many? (e.g. 5 videos, 3 endpoints, 10 test cases)',
  HOURS: 'How much time? (e.g. 6 hours of focused work)',
  PERCENTAGE: 'How much completion? (e.g. 100% of module spec)',
  MILESTONE: 'Was the milestone achieved? (1 = Achieved)',
  CUSTOM: 'Custom operational measurement',
}

export default function ProjectSetDailyTarget() {
  const { projectId } = useParams<{ projectId: string }>()
  const [searchParams] = useSearchParams()
  const initialEmployeeId = searchParams.get('employeeId') || ''

  const navigate = useNavigate()
  const { accessToken } = useAuth()

  const [project, setProject] = useState<Project | null>(null)
  const [members, setMembers] = useState<any[]>([])
  const [modules, setModules] = useState<any[]>([])
  const [milestones, setMilestones] = useState<any[]>([])
  const [sprints, setSprints] = useState<any[]>([])
  const [workItems, setWorkItems] = useState<WorkItem[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Form State (Step 183)
  const [form, setForm] = useState({
    employee_id: initialEmployeeId,
    module_id: '',
    milestone_id: '',
    sprint_id: '',
    work_item_id: '',

    target_type: 'COUNT' as 'COUNT' | 'HOURS' | 'PERCENTAGE' | 'MILESTONE' | 'CUSTOM',
    target_value: '',
    unit: 'ITEMS',

    deadline_date: new Date().toISOString().slice(0, 10),
    deadline_time: '17:00',
    priority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',

    title: '',
    note: '',
  })

  // Load project-specific data (Step 184)
  useEffect(() => {
    if (!accessToken || !projectId) return

    async function load() {
      setLoading(true)
      setError('')
      try {
        const [
          allProjects,
          memberData,
          modData,
          msData,
          sprintData,
          allItems,
        ] = await Promise.all([
          getProjects(accessToken!),
          getProjectMembers(accessToken!, projectId!).catch(() => []),
          getProjectModules(accessToken!, projectId!).catch(() => []),
          getProjectMilestones(accessToken!, projectId!).catch(() => []),
          getProjectSprints(accessToken!, projectId!).catch(() => []),
          getWorkItems(accessToken!).catch(() => []),
        ])

        const matchedProj = (allProjects || []).find((p) => p.id === projectId)
        setProject(matchedProj || null)
        setMembers(memberData || [])
        setModules(modData || [])
        setMilestones(msData || [])
        setSprints(sprintData || [])

        // Filter work items belonging ONLY to this project (Step 189)
        const projItems = (allItems || []).filter((w) => w.project_id === projectId)
        setWorkItems(projItems)

        if (initialEmployeeId) {
          setForm((prev) => ({ ...prev, employee_id: initialEmployeeId }))
        }
      } catch (err: any) {
        setError(err.message || 'Unable to load project data.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [accessToken, projectId, initialEmployeeId])

  // Selected work item details (Step 191)
  const selectedWorkItem = useMemo(() => {
    if (!form.work_item_id) return null
    return workItems.find((w) => w.id === form.work_item_id) || null
  }, [workItems, form.work_item_id])

  // Auto-fill when selecting a work item
  function handleSelectWorkItem(workItemId: string) {
    const item = workItems.find((w) => w.id === workItemId)
    if (!item) {
      setForm((prev) => ({ ...prev, work_item_id: '' }))
      return
    }

    setForm((prev) => ({
      ...prev,
      work_item_id: item.id,
      title: item.title,
      module_id: item.module_id || prev.module_id,
      milestone_id: item.milestone_id || prev.milestone_id,
      // If work item has an assignee and form has none, default to assignee
      employee_id: item.assigned_to || prev.employee_id,
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!accessToken || !projectId) return

    // Step 190 — Employee assignment validation
    if (!form.employee_id) {
      setError('Select an employee.')
      return
    }

    if (!form.work_item_id && !form.title.trim()) {
      setError('Enter a target title when no work item is selected.')
      return
    }

    const tVal = Number(form.target_value)
    if (form.target_value === '' || isNaN(tVal) || tVal < 0) {
      setError('Target value must be zero or greater.')
      return
    }

    if (form.target_type === 'PERCENTAGE' && (tVal < 0 || tVal > 100)) {
      setError('Percentage target must be between 0 and 100.')
      return
    }

    // Step 192 — Inconsistent Assignee Check
    if (selectedWorkItem && selectedWorkItem.assigned_to && selectedWorkItem.assigned_to !== form.employee_id) {
      const assignedMember = members.find((m) => m.user_id === selectedWorkItem.assigned_to)
      const assignedName = assignedMember?.profile
        ? `${assignedMember.profile.first_name} ${assignedMember.profile.last_name || ''}`
        : 'another team member'

      if (
        !window.confirm(
          `This work item is currently assigned to ${assignedName}. Do you want to assign today's target to the selected employee?`,
        )
      ) {
        return
      }
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const finalTitle = form.title.trim() || selectedWorkItem?.title || 'Daily Target'

      await createDailyTarget(accessToken, {
        project_id: projectId,
        employee_id: form.employee_id,
        module_id: form.module_id || null,
        milestone_id: form.milestone_id || null,
        sprint_id: form.sprint_id || null,
        work_item_id: form.work_item_id || null,

        title: finalTitle,
        target_type: form.target_type,
        target_value: tVal,
        unit: form.unit.trim() || 'ITEMS',

        deadline_date: form.deadline_date,
        deadline_time: form.deadline_time || null,
        priority: form.priority,
      })

      setSuccess('Target created successfully!')
      setTimeout(() => {
        navigate(`/projects/${projectId}`)
      }, 1200)
    } catch (err: any) {
      setError(err.message || 'Unable to create target.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-3xl space-y-6">

        {/* BREADCRUMB & HEADER */}
        <div className="space-y-1">
          <Link
            to={`/projects/${projectId}`}
            className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-900 mb-1"
          >
            <ArrowLeft size={14} />
            <span>Back to {project?.name || 'Project'}</span>
          </Link>

          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono block">
            PROJECT EXECUTION DISPATCH
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            SET TODAY'S TARGET
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Assign today's measurable deliverable directly for project milestones and sprints.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 font-semibold">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 font-semibold flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-xs space-y-8">

          {/* PROJECT SUMMARY BANNER (Step 183 - Project is Read-Only) */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-[#801424] text-white flex items-center justify-center font-bold text-sm">
                <FolderKanban size={20} />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                  ACTIVE PROJECT
                </span>
                <h3 className="font-bold text-slate-900 text-base">
                  {project?.name || 'Project'}
                </h3>
              </div>
            </div>
            <span className="rounded-md bg-white px-2.5 py-1 text-xs font-mono font-bold text-slate-700 border border-slate-200 shadow-2xs">
              {project?.project_key}
            </span>
          </div>

          {/* 1. ASSIGNMENT & SCOPE */}
          <section className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
              1. ASSIGNMENT & STRUCTURE
            </h2>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Employee Selector (Step 185 - Only Project Members!) */}
              <div className="md:col-span-2">
                <Field label="Assignee (Project Member) *">
                  <select
                    value={form.employee_id}
                    onChange={(e) => setForm((prev) => ({ ...prev, employee_id: e.target.value }))}
                    className="input"
                    required
                  >
                    <option value="">Select project team member</option>
                    {members.map((member) => (
                      <option key={member.user_id || member.id} value={member.user_id || member.id}>
                        {member.profile?.first_name} {member.profile?.last_name || ''} ({member.role || 'Member'})
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              {/* Module Selector (Step 186) */}
              <Field label="Module (Optional)">
                <select
                  value={form.module_id}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      module_id: e.target.value,
                    }))
                  }
                  className="input"
                >
                  <option value="">Select module</option>
                  {modules.map((mod) => (
                    <option key={mod.id} value={mod.id}>
                      {mod.name}
                    </option>
                  ))}
                </select>
              </Field>

              {/* Milestone Selector (Step 187) */}
              <Field label="Milestone (Optional)">
                <select
                  value={form.milestone_id}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      milestone_id: e.target.value,
                    }))
                  }
                  className="input"
                >
                  <option value="">No milestone</option>
                  {milestones.map((ms) => (
                    <option key={ms.id} value={ms.id}>
                      {ms.name}
                    </option>
                  ))}
                </select>
              </Field>

              {/* Sprint Selector (Step 188) */}
              <Field label="Sprint (Optional)">
                <select
                  value={form.sprint_id}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      sprint_id: e.target.value,
                    }))
                  }
                  className="input"
                >
                  <option value="">No sprint</option>
                  {sprints.map((sprint) => (
                    <option key={sprint.id} value={sprint.id}>
                      {sprint.name}
                    </option>
                  ))}
                </select>
              </Field>

              {/* Work Item Selector (Step 189) */}
              <Field label="Linked Work Item">
                <select
                  value={form.work_item_id}
                  onChange={(e) => handleSelectWorkItem(e.target.value)}
                  className="input"
                >
                  <option value="">Target only — no specific work item</option>
                  {workItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title} ({item.status})
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {/* Live preview for selected existing work item (Step 191) */}
            {selectedWorkItem && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-900">
                    Selected Work: {selectedWorkItem.title}
                  </span>
                  <span className="rounded bg-blue-100 px-2 py-0.5 font-bold text-blue-800 uppercase text-[10px]">
                    {selectedWorkItem.status}
                  </span>
                </div>
                <div className="flex flex-wrap gap-4 text-slate-600">
                  <span>Overall Deadline: {selectedWorkItem.deadline || 'None'}</span>
                  <span>Progress: {selectedWorkItem.progress_percent || 0}%</span>
                </div>
              </div>
            )}
          </section>

          {/* 2. TARGET DELIVERABLE */}
          <section className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
              2. TARGET DELIVERABLE
            </h2>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Field label="Target Focus / Title *">
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g. 3 endpoints of Payment API"
                    className="input"
                    required
                  />
                </Field>
              </div>

              <div>
                <Field label="Target Type">
                  <select
                    value={form.target_type}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        target_type: e.target.value as any,
                        unit:
                          e.target.value === 'HOURS'
                            ? 'hours'
                            : e.target.value === 'PERCENTAGE'
                            ? '%'
                            : prev.unit,
                      }))
                    }
                    className="input"
                  >
                    <option value="COUNT">COUNT (Quantities)</option>
                    <option value="HOURS">HOURS (Focused time)</option>
                    <option value="PERCENTAGE">PERCENTAGE (0–100%)</option>
                    <option value="MILESTONE">MILESTONE (Binary 1 / 0)</option>
                    <option value="CUSTOM">CUSTOM (Custom unit)</option>
                  </select>
                </Field>
                <p className="mt-1 text-[11px] text-slate-400 font-medium italic">
                  {TARGET_TYPE_INFO[form.target_type]}
                </p>
              </div>

              <Field label="Target Quantity / Value *">
                <input
                  type="number"
                  min="0"
                  max={form.target_type === 'PERCENTAGE' ? 100 : undefined}
                  step={form.target_type === 'HOURS' ? '0.25' : '1'}
                  value={form.target_value}
                  onChange={(e) => setForm((prev) => ({ ...prev, target_value: e.target.value }))}
                  placeholder="3"
                  className="input"
                  required
                />
              </Field>

              <Field label="Unit *">
                <input
                  type="text"
                  value={form.unit}
                  onChange={(e) => setForm((prev) => ({ ...prev, unit: e.target.value }))}
                  placeholder="endpoints / screens / test cases"
                  className="input"
                  required
                />
              </Field>

              <Field label="Priority">
                <select
                  value={form.priority}
                  onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value as any }))}
                  className="input"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </Field>

              <Field label="Target Date *">
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="date"
                    value={form.deadline_date}
                    onChange={(e) => setForm((prev) => ({ ...prev, deadline_date: e.target.value }))}
                    className="input pl-10"
                    required
                  />
                </div>
              </Field>

              <Field label="Deadline Time">
                <input
                  type="time"
                  value={form.deadline_time}
                  onChange={(e) => setForm((prev) => ({ ...prev, deadline_time: e.target.value }))}
                  className="input"
                />
              </Field>
            </div>
          </section>

          {/* SUBMIT BUTTON */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => navigate(`/projects/${projectId}`)}
              className="text-xs font-bold text-slate-500 hover:text-slate-900 cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-[#801424] px-6 py-3 text-sm font-bold text-white hover:bg-[#9f1239] disabled:opacity-50 cursor-pointer shadow-xs"
            >
              <Target className="h-4 w-4" />
              {saving ? 'Creating Target...' : 'Create Target'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
        {label}
      </label>
      {children}
    </div>
  )
}
